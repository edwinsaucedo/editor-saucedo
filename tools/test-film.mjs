// Prueba de la Película del evento con FFmpeg local: node tools/test-film.mjs <carpeta> <material-de-prueba>
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const E = require('../src/js/engine.js');
const dir = path.resolve(process.argv[2]), M = path.resolve(process.argv[3]);
// --h265: el archivo final en H.265 (más ligero), como cuando se elige "Más ligero" en el programa.
const ENC = process.argv.includes('--h265') ? E.ENCODERS.libx265 : E.ENCODERS.libx264, HEVC = E.isHevcArgs(ENC);
fs.mkdirSync(dir, { recursive: true });
const ff = (args, label, tool = 'ffmpeg') => {
  const r = spawnSync(tool, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error('FALLÓ', label, '\n', args.join(' '), '\n', (r.stderr || '').split('\n').slice(-30).join('\n')); process.exit(1); }
  return r;
};
const P = n => path.join(dir, n);
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080,drawbox=x=660:y=480:w=600:h=120:color=white:t=fill', '-frames:v', '1', P('tarjeta.png')], 'tarjeta');
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white@0:s=1920x1080,format=rgba,drawbox=x=1600:y=960:w=260:h=80:color=white@0.8:t=fill', '-frames:v', '1', P('marca.png')], 'marca');
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'gradients=s=2880x1620:d=1', '-frames:v', '1', P('foto.jpg')], 'foto');
const probe = f => E.parseProbe(ff(E.probeArgs(f), 'probe', 'ffprobe').stdout);
const H = Object.assign({ kind: 'video', path: path.join(M, 'horizontal.mp4') }, probe(path.join(M, 'horizontal.mp4')));
const V = Object.assign({ kind: 'video', path: path.join(M, 'vertical.mp4') }, probe(path.join(M, 'vertical.mp4')));
const D = Object.assign({ kind: 'video', path: path.join(M, 'hdv.mp4') }, probe(path.join(M, 'hdv.mp4')));
const vid = (m, i, len, vol) => ({ kind: 'video', path: m.path, in: i, len, w: m.width, h: m.height, hasAudio: m.hasAudio, vol });
const card = len => ({ kind: 'card', still: P('tarjeta.png'), len });
const song = { path: path.join(M, 'cancion.mp3'), start: 5, vol: .5 };
// Revisión rápida
const sc = spawnSync('ffmpeg', E.scanArgs(H.path, true), { encoding: 'utf8' });
console.log('revisión horizontal:', JSON.stringify(E.parseScan(sc.stderr, H)), '| vertical:', JSON.stringify(E.parseScan(spawnSync('ffmpeg', E.scanArgs(V.path, false), { encoding: 'utf8' }).stderr, V)));
const fiesta = [card(3)]; for (let k = 0; k < 13; k++) fiesta.push(vid(H, (k * 0.7) % 9, 2.2, 1));
for (const mood of ['suave', 'corte']) {
  const cache = P('cache_' + mood); fs.mkdirSync(cache, { recursive: true });
  const units = [
    { name: 'Portada', segments: [card(5)], music: song },
    { name: 'Llegada', segments: [card(3), vid(H, 1, 4, 1), vid(V, 0, 3.5, 1), { kind: 'image', still: P('foto.jpg'), len: 4, zoomIn: true }], music: song },
    { name: 'Vals', segments: [card(3), vid(D, 0, 5, 1.2), vid(H, 5, 4, 1)], music: null },
    { name: 'Fiesta', segments: fiesta, music: song },
    { name: 'Créditos', segments: [card(5)], music: song }
  ];
  const job = E.filmBuild({ W: 1920, H: 1080, mood, enhance: true, style: 'calido', denoise: true, hwaccel: false, cache, sep: path.sep,
    title: 'XV Ana Sofía', watermark: P('marca.png'), encArgs: ENC, units });
  const t0 = Date.now(); let skipped = 0;
  for (const s of job.steps) { if (fs.existsSync(s.out + '.ok')) { skipped++; continue; } ff(s.args, `${s.stage} ${s.unitName} ${s.n}`); fs.writeFileSync(s.out + '.ok', ''); }
  fs.writeFileSync(job.listPath, job.list); fs.writeFileSync(job.metaPath, job.meta);
  const m = E.parseLoudnorm(spawnSync('ffmpeg', E.filmMeasureArgs(job.listPath), { encoding: 'utf8' }).stderr);
  const out = P(`pelicula_${mood}.mp4`);
  ff(E.filmFinalArgs(job.listPath, job.metaPath, m, out, HEVC), 'final');
  const pr = JSON.parse(ff(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', out], 'probe final', 'ffprobe').stdout);
  const dur = +pr.format.duration, vs = pr.streams.find(x => x.codec_type === 'video');
  console.log('  video:', vs.codec_name, vs.codec_tag_string, `${vs.width}x${vs.height}`, `${(fs.statSync(out).size / 1048576).toFixed(2)} MB`);
  const after = E.parseLoudnorm(spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', out, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr);
  console.log(mood, `pasos ${job.steps.length} (grupos: ${job.steps.filter(s => s.stage === 'grupo').length})`, `plan ${job.total.toFixed(2)} s → archivo ${dur.toFixed(2)} s`,
    `capítulos ${pr.chapters.length}: ${pr.chapters.map(c => c.tags.title).join(', ')}`, `volumen medido ${m && m.input_i} → final ${after && after.input_i} LUFS`, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (Math.abs(dur - job.total) > .3) { console.error('DURACIÓN NO COINCIDE'); process.exit(1); }
  // Segunda vez: todo debe saltarse (reanudar)
  const again = E.filmBuild({ W: 1920, H: 1080, mood, enhance: true, style: 'calido', denoise: true, hwaccel: false, cache, sep: path.sep, title: 'XV Ana Sofía', watermark: P('marca.png'), encArgs: ENC, units });
  console.log('  reanudar: pasos ya hechos', again.steps.filter(s => fs.existsSync(s.out + '.ok')).length, 'de', again.steps.length);
}
console.log('OK');
