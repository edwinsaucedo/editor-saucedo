// Prueba del motor de video con FFmpeg local: node tools/test-engine.mjs <carpeta-temporal>
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const E = require('../src/js/engine.js');
const dir = process.argv[2];
fs.mkdirSync(dir, { recursive: true });

// --solo-plan: revisa la lógica sin correr FFmpeg (se usa en GitHub antes de compilar).
if (process.argv.includes('--solo-plan')) {
  const media = [{ kind: 'image', still: 'a.jpg' }, { kind: 'video', path: 'b.mp4', width: 1920, height: 1080, duration: 14 },
    { kind: 'video', path: 'c.mts', width: 1920, height: 1080, duration: 2 }, { kind: 'image', still: 'd.jpg' }];
  let checks = 0;
  for (const [template, mood, target] of [['std', 'suave', 0], ['std', 'dinamico', 0], ['xv', 'suave', 240], ['xv', 'dinamico', 61], ['xv', 'suave', 30]])
    for (const [W, H] of [[1080, 1920], [1920, 1080]]) {
      const plan = E.plan({ template, media, mood, target });
      const job = E.buildJob({ plan, media, tmp: 'tmp', W, H, T: plan.T, enhance: true, style: 'rosa', overlays: [{ path: 'o.png', a: 0, b: 4, fin: .5, fout: .5 }],
        watermark: 'w.png', audio: { path: 's.mp3', start: 3 }, out: 'out.mp4' });
      for (const st of job.steps) {
        const txt = st.args.join(' ');
        if (/NaN|undefined|Infinity/.test(txt)) throw new Error(`${template}/${mood}: argumento inválido en ${st.stage} ${st.n}: ${txt}`);
        for (const m of txt.matchAll(/offset=([\d.]+)/g)) if (+m[1] <= 0) throw new Error('offset no positivo');
        checks++;
      }
      if (template === 'xv' && Math.abs(job.total - Math.max(30, target)) > .2) throw new Error(`duración ${job.total} ≠ ${target}`);
    }
  console.log(`Plan OK (${checks} pasos revisados)`);
  process.exit(0);
}
const ff = (args, label) => {
  const t0 = Date.now();
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error('FALLÓ', label, '\n', args.join(' '), '\n', (r.stderr || '').split('\n').slice(-25).join('\n')); process.exit(1); }
  return Date.now() - t0;
};
const probe = p => E.parseProbe(spawnSync('ffprobe', E.probeArgs(p), { encoding: 'utf8' }).stdout);
const P = n => path.join(dir, n);
// Material de prueba
ff(['-y','-f','lavfi','-i','testsrc2=s=1920x1080:r=30:d=12','-f','lavfi','-i','sine=f=300:d=12','-c:v','libx264','-preset','ultrafast','-c:a','aac','-shortest',P('horizontal.mp4')],'clip h');
ff(['-y','-f','lavfi','-i','testsrc=s=1080x1920:r=60:d=5','-c:v','libx264','-preset','ultrafast',P('vertical.mp4')],'clip v');
ff(['-y','-f','lavfi','-i','testsrc2=s=1440x1080:r=25:d=8','-vf','setsar=4/3','-c:v','libx264','-preset','ultrafast','-flags','+ilme+ildct',P('hdv.mp4')],'clip hdv');
ff(['-y','-f','lavfi','-i','sine=f=440:d=90','-c:a','libmp3lame','-q:a','5',P('cancion.mp3')],'audio');
const mk = (W,H) => {
  ff(['-y','-f','lavfi','-i',`gradients=s=${Math.round(W*1.5)}x${Math.round(H*1.5)}:d=1`,'-frames:v','1',P(`foto_${W}x${H}.jpg`)],'still');
  ff(['-y','-f','lavfi','-i',`color=c=black@0.45:s=${W}x${H},format=rgba`,'-frames:v','1',P(`ov_${W}x${H}.png`)],'ov');
  ff(['-y','-f','lavfi','-i',`color=c=white@0.0:s=${W}x${H},format=rgba,drawbox=x=${W-300}:y=${H-120}:w=260:h=80:color=white@0.8:t=fill`,'-frames:v','1',P(`wm_${W}x${H}.png`)],'wm');
};
const run = (name, template, W, H, mood, target, files) => {
  const media = files.map(f => f.endsWith('.jpg') ? { kind:'image', still: P(f) } : Object.assign({ kind:'video', path: P(f) }, probe(P(f))));
  const plan = E.plan({ template, media, mood, target });
  const tmp = P('tmp_' + name); fs.mkdirSync(tmp, { recursive: true });
  const ov = [{ path: P(`ov_${W}x${H}.png`), a: plan.intro.a, b: plan.intro.b, fin: 0.6, fout: 0.6 }];
  if (plan.outro) ov.push({ path: P(`ov_${W}x${H}.png`), a: plan.outro.a, b: plan.outro.b, fin: 0.8 });
  const job = E.buildJob({ plan, media, tmp, W, H, T: plan.T, enhance: true, style: 'calido', hwaccel: false,
    overlays: ov, watermark: P(`wm_${W}x${H}.png`), audio: { path: P('cancion.mp3'), start: 5 }, out: P(name + '.mp4'), sep: path.sep });
  let ms = 0; const stages = {};
  for (const s of job.steps) { ms += ff(s.args, `${s.stage} ${s.n}`); stages[s.stage] = (stages[s.stage] || 0) + 1; }
  const got = probe(P(name + '.mp4'));
  console.log(name, JSON.stringify(stages), 'plan', job.total.toFixed(2), 's → archivo', got.duration.toFixed(2), 's', got.width + 'x' + got.height, 'audio', got.hasAudio, `(${(ms/1000).toFixed(1)} s de render)`);
  if (Math.abs(got.duration - job.total) > 0.25) { console.error('DURACIÓN NO COINCIDE'); process.exit(1); }
};
mk(1080,1920); mk(1920,1080);
run('savethedate_vertical', 'std', 1080, 1920, 'suave', 0, ['foto_1080x1920.jpg','horizontal.mp4','vertical.mp4','hdv.mp4','foto_1080x1920.jpg']);
run('xv_horizontal', 'xv', 1920, 1080, 'dinamico', 60, ['horizontal.mp4','foto_1920x1080.jpg','vertical.mp4','hdv.mp4']);
console.log('OK');
