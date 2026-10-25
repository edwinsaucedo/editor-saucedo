// Prueba del motor de plantillas, ritmo y mejores momentos: node tools/test-templates.mjs <carpeta> <material>
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const E = require('../src/js/engine.js');
const dir = path.resolve(process.argv[2]), M = path.resolve(process.argv[3]);
fs.mkdirSync(dir, { recursive: true });
const ff = (args, label, tool = 'ffmpeg') => {
  const r = spawnSync(tool, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error('FALLÓ', label, '\n', args.join(' '), '\n', (r.stderr || '').split('\n').slice(-25).join('\n')); process.exit(1); }
  return r;
};
const P = n => path.join(dir, n);
// 1. Ritmo: pista de golpes a 100 BPM con ruido
{
  const sr = 11025, secs = 30, x = new Float32Array(sr * secs);
  for (let i = 0; i < x.length; i++) x[i] = (Math.random() - .5) * 0.05;
  for (let b = 0.37; b < secs; b += 0.6) for (let k = 0; k < 400; k++) { const i = Math.round(b * sr) + k; if (i < x.length) x[i] += Math.sin(k * 0.3) * Math.exp(-k / 80); }
  const r = E.detectBeats(x, sr);
  console.log('ritmo sintético: esperado 100 BPM, inicio 0.37 s →', r.bpm, 'BPM, inicio', r.offset.toFixed(2), 's');
  if (Math.abs(r.bpm - 100) > 2) { console.error('RITMO MAL'); process.exit(1); }
}
// Ritmo en la canción de prueba (tono continuo: no debe fallar, aunque no tenga golpes)
ff(E.songDecodeArgs(path.join(M, 'cancion.mp3'), 0, 30, P('cancion.raw')), 'decodificar');
const buf = fs.readFileSync(P('cancion.raw')); const song = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
console.log('ritmo canción de prueba:', JSON.stringify(E.detectBeats(song, 11025) && { bpm: E.detectBeats(song, 11025).bpm }));
// 2. Plantilla: cortes al ritmo, cuadrado, capa animada, capa que parpadea, VHS y marca por toma
const probe = f => E.parseProbe(ff(E.probeArgs(f), 'probe', 'ffprobe').stdout);
const H = Object.assign({ kind: 'video', path: path.join(M, 'horizontal.mp4') }, probe(path.join(M, 'horizontal.mp4')));
const V = Object.assign({ kind: 'video', path: path.join(M, 'vertical.mp4') }, probe(path.join(M, 'vertical.mp4')));
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'gradients=s=1620x1620:d=1', '-frames:v', '1', P('foto_sq.jpg')], 'foto');
const media = [H, { kind: 'image', still: P('foto_sq.jpg') }, V, H];
fs.mkdirSync(P('seq'), { recursive: true });
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white@0:s=1080x1080:d=2,format=rgba,drawbox=x=100+t*200:y=480:w=200:h=120:color=white@0.9:t=fill', '-start_number', '0', P('seq/capa_%04d.png')], 'secuencia');
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white@0:s=1080x1080,format=rgba,drawbox=x=960:y=40:w=60:h=60:color=red:t=fill', '-frames:v', '1', P('punto.png')], 'punto');
ff(['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white@0:s=1080x1080,format=rgba,drawbox=x=800:y=960:w=240:h=80:color=white@0.8:t=fill', '-frames:v', '1', P('marca_blanca.png')], 'marca');
for (const [name, T, post, fmt] of [['vhs_cortes', 0, 'rgbashift=rh=-4:bh=4,noise=alls=18:allf=t+u,eq=saturation=1.25', 'sq'], ['cine_suave', 0.6, 'noise=alls=10:allf=t+u,vignette=angle=PI/5', 'h']]) {
  const { W, H: HH } = E.FORMATS[fmt];
  const plan = E.tplPlan({ media, mode: 'song', target: 24, intro: 3, outro: 4, T, trans: ['fadewhite', 'zoomin', 'smoothleft'], beat: { period: 0.6, offset: 0.37 }, beats: 4 });
  const tmp = P('tmp_' + name); fs.mkdirSync(tmp, { recursive: true });
  const job = E.tplJob({ plan, media, tmp, sep: path.sep, W, H: HH, T: plan.T, look: E.videoColor(true, 'vivo'), fit: 'auto', hwaccel: false,
    wmFor: (s, i) => (fmt === 'sq' ? P('marca_blanca.png') : null),
    layers: fmt === 'sq' ? [{ path: P('seq/capa_%04d.png'), seq: true, a: 0.5, b: 2.5 }, { path: P('punto.png'), a: 0, b: plan.total, blink: true }] : [],
    post, audio: { path: path.join(M, 'cancion.mp3'), start: 3 }, out: P(name + '.mp4') });
  const t0 = Date.now();
  for (const s of job.steps) ff(s.args, `${name} ${s.stage} ${s.n}`);
  const got = probe(P(name + '.mp4'));
  console.log(name, `tomas ${plan.segments.length} (cada una ${plan.shot.toFixed(2)} s = 4 tiempos)`, `plan ${job.total.toFixed(2)} → ${got.duration.toFixed(2)} s`, `${got.width}x${got.height}`, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (Math.abs(got.duration - job.total) > .25) { console.error('DURACIÓN'); process.exit(1); }
  console.log('  cortes en', plan.cuts.map(c => c.toFixed(2)).join(' '));
}
// 3. Mejores momentos
const hlText = spawnSync('ffmpeg', E.hlArgs(H.path, true), { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr;
const hl = E.hlParse(hlText);
console.log('revisión por segundo: cuadros clave', hl.v.length, 'audio', hl.a.length, 'ej.', JSON.stringify(hl.v[1]));
const picks = E.pickHighlights([{ id: 'vals', clips: [{ id: 'a', kind: 'video', duration: 12, in: 0, out: 12, hl }, { id: 'f', kind: 'image' }] },
  { id: 'fiesta', clips: [{ id: 'b', kind: 'video', duration: 12, in: 2, out: 12, hl }] }], 12, 2.4);
console.log('elegidas:', JSON.stringify(picks));
console.log('OK');
