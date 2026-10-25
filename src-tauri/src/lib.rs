//! Editor Saucedo — parte nativa.
//! La interfaz (HTML/JS) decide qué hacer; aquí solo se corre FFmpeg, se leen y escriben
//! archivos, se abren los cuadros de "Abrir"/"Guardar" de Windows y se abre el Explorador.

use serde::Serialize;
use std::{
    cmp::Ordering,
    collections::{HashMap, VecDeque},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::InvokeBody, AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

const IMAGE_EXT: &[&str] = &["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "gif", "tif", "tiff", "avif"];
const VIDEO_EXT: &[&str] = &["mp4", "mov", "m4v", "mts", "m2ts", "avi", "mkv", "wmv", "3gp", "mpg", "mpeg", "webm"];
const AUDIO_EXT: &[&str] = &["mp3", "m4a", "aac", "wav", "flac", "ogg", "wma", "opus"];

#[derive(Default)]
struct Jobs(Mutex<HashMap<String, CommandChild>>);

#[derive(Serialize, Clone)]
struct Progress {
    job: String,
    out_time_us: i64,
}

#[derive(Serialize)]
struct RunResult {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[derive(Serialize)]
struct MediaEntry {
    path: String,
    name: String,
    kind: &'static str,
}

fn kind_of(p: &Path) -> Option<&'static str> {
    let ext = p.extension()?.to_str()?.to_ascii_lowercase();
    if IMAGE_EXT.contains(&ext.as_str()) {
        Some("image")
    } else if VIDEO_EXT.contains(&ext.as_str()) {
        Some("video")
    } else if AUDIO_EXT.contains(&ext.as_str()) {
        Some("audio")
    } else {
        None
    }
}

/// Orden "natural": IMG_2 antes que IMG_10.
fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (a, b) = (a.to_lowercase(), b.to_lowercase());
    let (mut ia, mut ib) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (ia.peek().copied(), ib.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, _) => return Ordering::Less,
            (_, None) => return Ordering::Greater,
            (Some(ca), Some(cb)) if ca.is_ascii_digit() && cb.is_ascii_digit() => {
                let mut na = String::new();
                while let Some(c) = ia.peek().copied().filter(|c| c.is_ascii_digit()) {
                    na.push(c);
                    ia.next();
                }
                let mut nb = String::new();
                while let Some(c) = ib.peek().copied().filter(|c| c.is_ascii_digit()) {
                    nb.push(c);
                    ib.next();
                }
                let (ta, tb) = (na.trim_start_matches('0'), nb.trim_start_matches('0'));
                let o = ta.len().cmp(&tb.len()).then_with(|| ta.cmp(tb));
                if o != Ordering::Equal {
                    return o;
                }
            }
            (Some(ca), Some(cb)) => {
                if ca != cb {
                    return ca.cmp(&cb);
                }
                ia.next();
                ib.next();
            }
        }
    }
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 6 {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut entries: Vec<PathBuf> = rd.filter_map(|e| e.ok().map(|e| e.path())).collect();
    entries.sort_by(|a, b| natural_cmp(&a.to_string_lossy(), &b.to_string_lossy()));
    for p in entries {
        let hidden = p.file_name().and_then(|n| n.to_str()).map(|n| n.starts_with('.')).unwrap_or(false);
        if hidden {
            continue;
        }
        if p.is_dir() {
            walk(&p, depth + 1, out);
        } else {
            out.push(p);
        }
    }
}

/// Expande carpetas soltadas o elegidas y devuelve solo fotos, videos y música.
#[tauri::command]
fn list_media(paths: Vec<String>) -> Vec<MediaEntry> {
    let mut files = Vec::new();
    for p in paths {
        let pb = PathBuf::from(&p);
        if pb.is_dir() {
            walk(&pb, 0, &mut files);
        } else {
            files.push(pb);
        }
    }
    files
        .into_iter()
        .filter_map(|p| {
            let kind = kind_of(&p)?;
            Some(MediaEntry {
                name: p.file_name()?.to_string_lossy().into_owned(),
                path: p.to_string_lossy().into_owned(),
                kind,
            })
        })
        .collect()
}

/// Corre ffmpeg o ffprobe (incluidos en el programa) y avisa el avance a la interfaz.
#[tauri::command]
async fn run_tool(app: AppHandle, jobs: State<'_, Jobs>, tool: String, job: String, args: Vec<String>, capture: Option<bool>) -> Result<RunResult, String> {
    let capture = capture.unwrap_or(false);
    if tool != "ffmpeg" && tool != "ffprobe" {
        return Err("Herramienta no permitida".into());
    }
    let (mut rx, child) = app
        .shell()
        .sidecar(&tool)
        .map_err(|e| format!("No se encontró {tool}: {e}"))?
        .args(args)
        .spawn()
        .map_err(|e| format!("No se pudo iniciar {tool}: {e}"))?;
    jobs.0.lock().unwrap().insert(job.clone(), child);

    let mut stdout = String::new();
    let mut tail: VecDeque<String> = VecDeque::new();
    let mut full = String::new();
    let mut code = None;
    while let Some(ev) = rx.recv().await {
        match ev {
            CommandEvent::Stdout(bytes) => {
                let s = String::from_utf8_lossy(&bytes);
                if tool == "ffmpeg" && !capture {
                    for line in s.lines() {
                        if let Some(v) = line.trim().strip_prefix("out_time_us=") {
                            if let Ok(n) = v.parse::<i64>() {
                                let _ = app.emit("ff-progress", Progress { job: job.clone(), out_time_us: n });
                            }
                        }
                    }
                } else {
                    stdout.push_str(&s);
                    if !s.ends_with('\n') {
                        stdout.push('\n');
                    }
                }
            }
            CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                if capture && full.len() < 16 * 1024 * 1024 {
                    full.push_str(&text);
                    if !text.ends_with('\n') {
                        full.push('\n');
                    }
                }
                for line in text.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    tail.push_back(line.to_string());
                    if tail.len() > 40 {
                        tail.pop_front();
                    }
                }
            }
            CommandEvent::Error(e) => tail.push_back(e),
            CommandEvent::Terminated(p) => {
                code = p.code;
                break;
            }
            _ => {}
        }
    }
    jobs.0.lock().unwrap().remove(&job);
    let stderr = if capture { full } else { tail.into_iter().collect::<Vec<_>>().join("\n") };
    Ok(RunResult { code, stdout, stderr })
}

#[tauri::command]
fn cancel_job(jobs: State<'_, Jobs>, job: String) -> bool {
    match jobs.0.lock().unwrap().remove(&job) {
        Some(child) => child.kill().is_ok(),
        None => false,
    }
}

/// Lee un archivo completo como bytes (fotos, miniaturas, música para escuchar).
#[tauri::command]
fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| format!("No se pudo leer {path}: {e}"))
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let hex = |c: u8| (c as char).to_digit(16);
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Escribe bytes en disco. La ruta llega en el encabezado x-path (codificada) y los datos sin convertir.
#[tauri::command]
fn write_file(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let raw = request
        .headers()
        .get("x-path")
        .and_then(|v| v.to_str().ok())
        .ok_or("Falta la ruta del archivo")?;
    let path = PathBuf::from(percent_decode(raw));
    let InvokeBody::Raw(data) = request.body() else {
        return Err("Datos no válidos".into());
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear la carpeta {}: {e}", parent.display()))?;
    }
    fs::write(&path, data).map_err(|e| format!("No se pudo guardar {}: {e}", path.display()))
}

/// Fecha de modificación de cada archivo (milisegundos), para ordenar por hora cuando el archivo no trae la suya.
#[tauri::command]
fn file_times(paths: Vec<String>) -> Vec<Option<f64>> {
    paths
        .iter()
        .map(|p| {
            fs::metadata(p)
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as f64)
        })
        .collect()
}

/// Permite que el reproductor de la pantalla abra ese video directamente desde el disco.
#[tauri::command]
fn allow_preview(app: AppHandle, path: String) -> Result<(), String> {
    app.asset_protocol_scope().allow_file(&path).map_err(|e| e.to_string())
}

/// Carpeta de trabajo de una película (se conserva para poder reanudar).
#[tauri::command]
fn film_cache_dir(app: AppHandle, id: String) -> Result<String, String> {
    let safe: String = id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
    let dir = jobs_root(&app)?.join(format!("pelicula-{safe}"));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn make_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("No se pudo crear la carpeta {path}: {e}"))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

fn jobs_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_cache_dir().map_err(|e| e.to_string())?.join("trabajos"))
}

/// Carpeta temporal para un render; se borra al terminar.
#[tauri::command]
fn new_job_dir(app: AppHandle) -> Result<String, String> {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let dir = jobs_root(&app)?.join(format!("t{ms}"));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn remove_job_dir(app: AppHandle, path: String) -> Result<(), String> {
    let root = jobs_root(&app)?;
    let p = PathBuf::from(&path);
    if !p.starts_with(&root) || p == root {
        return Err("Solo se borran carpetas temporales del programa".into());
    }
    fs::remove_dir_all(&p).map_err(|e| e.to_string())
}

fn clean_old_jobs(app: &AppHandle) {
    let Ok(root) = jobs_root(app) else { return };
    let Ok(rd) = fs::read_dir(&root) else { return };
    let now = SystemTime::now();
    for e in rd.flatten() {
        // Las películas se guardan 15 días para poder reanudar; lo demás, 2 días.
        let days = if e.file_name().to_string_lossy().starts_with("pelicula-") { 15 } else { 2 };
        let limit = now - Duration::from_secs(days * 24 * 3600);
        let old = e.metadata().and_then(|m| m.modified()).map(|t| t < limit).unwrap_or(false);
        if old {
            let _ = fs::remove_dir_all(e.path());
        }
    }
}

#[tauri::command]
fn app_paths(app: AppHandle) -> Result<serde_json::Value, String> {
    let docs = app.path().document_dir().or_else(|_| app.path().home_dir()).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "documents": docs.to_string_lossy(),
        "sep": std::path::MAIN_SEPARATOR.to_string(),
        "os": std::env::consts::OS,
    }))
}

#[tauri::command]
async fn pick_files(app: AppHandle, kind: String, multiple: bool) -> Vec<String> {
    let mut d = app.dialog().file();
    d = match kind.as_str() {
        "images" => d.add_filter("Fotos", IMAGE_EXT),
        "media" => {
            let all: Vec<&str> = IMAGE_EXT.iter().chain(VIDEO_EXT.iter()).copied().collect();
            d.add_filter("Fotos y videos", &all)
        }
        "audio" => d.add_filter("Música", AUDIO_EXT),
        "logo" => d.add_filter("Logo (PNG)", &["png", "webp", "jpg", "jpeg"]),
        "project" => d.add_filter("Película de Editor Saucedo", &["json"]),
        _ => d,
    };
    let to_s = |f: tauri_plugin_dialog::FilePath| f.into_path().ok().map(|p| p.to_string_lossy().into_owned());
    if multiple {
        d.blocking_pick_files().map(|v| v.into_iter().filter_map(to_s).collect()).unwrap_or_default()
    } else {
        d.blocking_pick_file().and_then(to_s).into_iter().collect()
    }
}

#[tauri::command]
async fn pick_folder(app: AppHandle, start: Option<String>) -> Option<String> {
    let mut d = app.dialog().file();
    if let Some(s) = start.filter(|s| Path::new(s).exists()) {
        d = d.set_directory(s);
    }
    d.blocking_pick_folder().and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().into_owned())
}

/// Abre un archivo con su programa (el video con el reproductor) o la carpeta en el Explorador.
#[tauri::command]
fn open_path(path: String, reveal: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut c = std::process::Command::new("explorer");
        if reveal {
            c.raw_arg(format!("/select,\"{}\"", path));
        } else {
            c.raw_arg(format!("\"{}\"", path));
        }
        c.spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let target = if reveal { Path::new(&path).parent().map(|p| p.to_path_buf()).unwrap_or_default() } else { PathBuf::from(&path) };
        let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener).arg(target).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Jobs::default())
        .setup(|app| {
            clean_old_jobs(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_tool,
            cancel_job,
            read_file,
            write_file,
            make_dir,
            path_exists,
            new_job_dir,
            remove_job_dir,
            app_paths,
            list_media,
            file_times,
            allow_preview,
            film_cache_dir,
            pick_files,
            pick_folder,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Editor Saucedo");
}
