/* Puente con la parte nativa del programa (archivos, FFmpeg, ventanas de Windows). */
(function () {
  'use strict';
  const SA = window.SA = window.SA || {};
  const T = window.__TAURI__;
  const B = SA.bridge = {};
  B.available = !!(T && T.core);
  const invoke = (cmd, args, opts) => {
    if (!B.available) return Promise.reject(new Error('Esta pantalla solo funciona dentro del programa Editor Saucedo.'));
    return T.core.invoke(cmd, args, opts);
  };

  B.paths = { documents: '', sep: '\\', os: 'windows' };
  B.init = async () => { if (B.available) B.paths = await invoke('app_paths'); return B.paths; };
  B.join = (...parts) => {
    const sep = B.paths.sep;
    return parts.filter(p => p != null && p !== '').map((p, i) => {
      p = String(p);
      if (i > 0) p = p.replace(/^[\\/]+/, '');
      if (i < parts.length - 1) p = p.replace(/[\\/]+$/, '');
      return p;
    }).join(sep);
  };
  B.baseName = p => String(p).split(/[\\/]/).pop();
  B.safeName = s => String(s || '').replace(/&/g, 'y').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

  B.readBlob = async (path, type) => {
    const buf = await invoke('read_file', { path });
    return new Blob([buf], { type: type || '' });
  };
  B.writeBytes = (path, data) => invoke('write_file', data instanceof Uint8Array ? data : new Uint8Array(data),
    { headers: { 'x-path': encodeURIComponent(path) } });
  B.writeBlob = async (path, blob) => B.writeBytes(path, new Uint8Array(await blob.arrayBuffer()));
  B.listMedia = paths => invoke('list_media', { paths });
  B.pick = (kind, multiple = true) => invoke('pick_files', { kind, multiple });
  B.pickFolder = start => invoke('pick_folder', { start: start || null });
  B.mkdir = path => invoke('make_dir', { path });
  B.exists = path => invoke('path_exists', { path });
  B.newJobDir = () => invoke('new_job_dir');
  B.removeJobDir = path => invoke('remove_job_dir', { path }).catch(() => {});
  B.open = (path, reveal = false) => invoke('open_path', { path, reveal });
  B.writeText = (path, text) => B.writeBytes(path, new TextEncoder().encode(text));
  B.readText = async path => new TextDecoder().decode(await invoke('read_file', { path }));
  B.fileTimes = paths => invoke('file_times', { paths });
  B.filmCacheDir = id => invoke('film_cache_dir', { id });
  // Dirección para el reproductor de video (lee directo del disco, sin copiar el archivo).
  B.previewSrc = async path => {
    await invoke('allow_preview', { path });
    return T.core.convertFileSrc(path);
  };

  // Nombre libre en la carpeta: "video.mp4", "video (2).mp4"…
  B.freeName = async (dir, base, ext) => {
    let name = `${base}.${ext}`, k = 2;
    while (await B.exists(B.join(dir, name))) name = `${base} (${k++}).${ext}`;
    return B.join(dir, name);
  };

  /* FFmpeg / ffprobe con avance */
  let seq = 0;
  const handlers = new Map();
  if (B.available) T.event.listen('ff-progress', e => { const h = handlers.get(e.payload.job); if (h) h(e.payload.out_time_us / 1e6); });
  // capture: devuelve todo lo que FFmpeg escribe (para la revisión y para medir el volumen).
  B.run = async (tool, args, onTime, capture) => {
    const job = `j${++seq}-${Date.now()}`;
    if (onTime) handlers.set(job, onTime);
    if (!capture) B.current = job;
    try { return await invoke('run_tool', { tool, job, args, capture: !!capture }); }
    finally { handlers.delete(job); if (B.current === job) B.current = null; }
  };
  B.cancel = () => B.current ? invoke('cancel_job', { job: B.current }) : Promise.resolve(false);
  B.probe = async path => {
    const r = await B.run('ffprobe', window.Engine.probeArgs(path));
    if (r.code !== 0 || !r.stdout.trim()) throw new Error(r.stderr || 'No se pudo leer el archivo');
    return window.Engine.parseProbe(r.stdout);
  };
  // Prueba una sola vez qué codificador sirve en esta computadora (tarjeta de video primero).
  let encP = null;
  B.detectEncoder = () => encP || (encP = (async () => {
    for (const name of window.Engine.ENCODER_ORDER) {
      try { const r = await B.run('ffmpeg', window.Engine.encoderTestArgs(name)); if (r.code === 0) return name; } catch (e) {}
    }
    return 'libx264';
  })());

  /* Arrastrar archivos a la ventana: el programa entrega las rutas completas */
  B.onDrop = handlers2 => {
    if (!B.available) return;
    const wv = T.webview && T.webview.getCurrentWebview && T.webview.getCurrentWebview();
    if (wv && wv.onDragDropEvent) {
      wv.onDragDropEvent(ev => {
        const p = ev.payload || {};
        if (p.type === 'enter' || p.type === 'over') handlers2.enter && handlers2.enter();
        else if (p.type === 'leave') handlers2.leave && handlers2.leave();
        else if (p.type === 'drop') handlers2.drop(p.paths || []);
      });
    } else {
      T.event.listen('tauri://drag-enter', () => handlers2.enter && handlers2.enter());
      T.event.listen('tauri://drag-leave', () => handlers2.leave && handlers2.leave());
      T.event.listen('tauri://drag-drop', e => handlers2.drop((e.payload && e.payload.paths) || []));
    }
  };
})();
