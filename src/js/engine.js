/*
 * Motor de video de Editor Saucedo.
 * Arma los comandos de FFmpeg por etapas para que la memoria nunca se dispare,
 * aunque el evento tenga muchos clips en 4K:
 *   1. Toma por toma: cada clip o foto se recorta, se ajusta al formato y se guarda aparte.
 *   2. Grupos: si hay muchas tomas, se unen de 10 en 10 con sus transiciones.
 *   3. Final: se unen los grupos, se ponen títulos, logo y música, y se exporta el MP4.
 * Funciona igual en el programa y en Node (para las pruebas).
 */
(function (root) {
  'use strict';
  const E = {};
  const FPS = 30;
  E.FPS = FPS;
  const q = x => Math.round(x * FPS) / FPS;              // redondea a cuadros completos
  const r3 = x => (Math.round(x * 1000) / 1000).toString();

  /* ---------- Codificadores ---------- */
  E.ENCODERS = {
    h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '21', '-b:v', '0', '-maxrate', '25M', '-bufsize', '50M', '-profile:v', 'high', '-pix_fmt', 'yuv420p'],
    h264_qsv: ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', '22', '-pix_fmt', 'nv12'],
    h264_amf: ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '20', '-qp_p', '22', '-pix_fmt', 'nv12'],
    libx264: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p']
  };
  E.ENCODER_NAMES = { h264_nvenc: 'tarjeta NVIDIA', h264_qsv: 'gráficos Intel', h264_amf: 'tarjeta AMD', libx264: 'procesador' };
  E.ENCODER_ORDER = ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'];
  E.encoderTestArgs = name => ['-hide_banner', '-nostats', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30:d=0.4',
    ...E.ENCODERS[name], '-f', 'null', '-'];
  // Tomas intermedias: rápidas y casi sin pérdida; se vuelven a codificar al final.
  const INTERMEDIATE = ['-r', String(FPS), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p', '-g', String(FPS)];
  const BASE = ['-y', '-hide_banner', '-nostats', '-progress', 'pipe:1'];

  /* ---------- Lectura de archivos (ffprobe) ---------- */
  E.probeArgs = path => ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path];
  E.parseProbe = json => {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    const streams = d.streams || [];
    const v = streams.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
    const a = streams.find(s => s.codec_type === 'audio');
    let w = v ? v.width : 0, h = v ? v.height : 0, rot = 0;
    if (v) {
      const sar = String(v.sample_aspect_ratio || '1:1').split(':').map(Number);
      if (sar[0] > 0 && sar[1] > 0 && sar[0] !== sar[1]) w = Math.round(w * sar[0] / sar[1]);
      if (v.tags && v.tags.rotate) rot = Number(v.tags.rotate) || 0;
      (v.side_data_list || []).forEach(sd => { if (sd.rotation != null) rot = Number(sd.rotation) || 0; });
      if (Math.abs(rot) % 180 === 90) { const t = w; w = h; h = t; }
    }
    const dur = parseFloat((d.format && d.format.duration) || (v && v.duration) || (a && a.duration) || 0) || 0;
    return { hasVideo: !!v, hasAudio: !!a, width: w, height: h, duration: dur, codec: v ? v.codec_name : (a ? a.codec_name : null) };
  };

  /* ---------- Color en video (equivalente aproximado a los estilos de foto) ---------- */
  const VIDEO_STYLE = {
    natural: '',
    calido: 'colorbalance=rm=0.04:bm=-0.05:rh=0.03:bh=-0.04',
    rosa: 'colorbalance=rm=0.02:gm=-0.02:bm=0.02:rh=0.02:bh=0.03',
    byn: 'hue=s=0,eq=contrast=1.12',
    vivo: 'eq=contrast=1.08:saturation=1.35',
    pelicula: 'colorbalance=rs=-0.03:bs=0.05:rh=0.05:bh=-0.04,eq=saturation=0.86:contrast=1.04'
  };
  E.videoColor = (enhance, style) => {
    const p = [];
    if (enhance) p.push('eq=contrast=1.05:saturation=1.10');
    if (VIDEO_STYLE[style]) p.push(VIDEO_STYLE[style]);
    return p.length ? ',' + p.join(',') : '';
  };

  /* ---------- Transiciones ---------- */
  E.MOODS = {
    suave: { T: 0.8, seg: 3.4, list: ['fade'] },
    dinamico: { T: 0.5, seg: 2.4, list: ['smoothleft', 'fade', 'smoothup', 'fade', 'circleopen', 'smoothright', 'fade', 'slideleft'] }
  };

  /* ---------- Línea de tiempo ----------
   * media: [{kind:'image'|'video', duration}]
   * Devuelve las tomas con su largo visible (len) y dónde va cada título. */
  E.plan = opt => {
    const mood = E.MOODS[opt.mood] || E.MOODS.suave;
    const T = q(mood.T), n = opt.media.length;
    if (!n) throw new Error('Agrega al menos una foto o video.');
    let lens = [], use = [], target = 0;
    if (opt.template === 'xv') {
      target = Math.max(30, opt.target || 180);
      const introLen = 5.2, outroLen = 6.5;
      const mid = target - T - introLen - outroLen;
      const k = Math.max(1, Math.round(mid / mood.seg));
      const each = mid / k;
      lens.push(introLen); use.push(0);
      for (let j = 0; j < k; j++) { lens.push(each); use.push(n > 1 ? (1 + j) % n : 0); }
      lens.push(outroLen); use.push(n > 1 ? n - 1 : 0);
    } else {
      const count = Math.min(n, 15);
      for (let i = 0; i < count; i++) {
        lens.push(count === 1 ? 8 : i === 0 ? 4.2 : i === count - 1 ? 5.2 : mood.seg - 0.4);
        use.push(i);
      }
    }
    lens = lens.map(q);
    if (target) {
      // Ajusta la última toma intermedia para que el video dure exactamente lo pedido (al cuadro).
      const diff = Math.round((target - T) * FPS) - lens.reduce((s, l) => s + Math.round(l * FPS), 0);
      lens[lens.length - 2] = q(lens[lens.length - 2] + diff / FPS);
    }
    // Para clips usados varias veces, se toma un pedazo distinto cada vez.
    const uses = {}, seen = {};
    use.forEach(m => { uses[m] = (uses[m] || 0) + 1; });
    let zoom = 0;
    const segments = lens.map((len, i) => {
      const m = use[i], md = opt.media[m], k = seen[m] = (seen[m] || 0) + 1;
      const need = len + T;
      let start = 0;
      if (md.kind === 'video' && md.duration > need) {
        const center = md.duration * (k - 0.5) / uses[m];
        start = Math.min(Math.max(0, center - need / 2), md.duration - need);
      }
      return { m, len, start: Math.round(start * 1000) / 1000, zoomIn: md.kind === 'image' ? (zoom++ % 2 === 0) : false };
    });
    const total = q(lens.reduce((s, l) => s + l, 0) + T);
    const transitions = [];
    for (let i = 1; i < segments.length; i++) transitions.push(mood.list[(i - 1) % mood.list.length]);
    const lastStart = lens.slice(0, -1).reduce((s, l) => s + l, 0);
    return {
      T, total, segments, transitions,
      intro: { a: 0, b: q(Math.min(total, lens[0] + T * 0.5)) },
      outro: segments.length > 1 ? { a: q(lastStart + T * 0.6), b: total } : null
    };
  };

  /* ---------- Etapa 1: una toma ---------- */
  E.segmentArgs = (seg, md, o) => {
    const { W, H, T } = o;
    const L = q(seg.len + T);
    const color = E.videoColor(o.enhance, o.style);
    if (md.kind === 'image') {
      // La foto ya viene encuadrada 1.5x desde el programa (con el color aplicado); aquí solo el acercamiento lento.
      const N = Math.round(L * FPS), Z = 0.08;
      const z = seg.zoomIn ? `1+${Z}*on/${N}` : `${1 + Z}-${Z}*on/${N}`;
      const fc = `[0:v]format=yuv420p,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},` +
        `setsar=1,trim=duration=${r3(L)},setpts=PTS-STARTPTS[v]`;
      return [...BASE, '-loop', '1', '-framerate', String(FPS), '-t', r3(L + 0.2), '-i', md.still,
        '-filter_complex', fc, '-map', '[v]', '-an', ...INTERMEDIATE, seg.out];
    }
    const portraitSrc = md.height > md.width, portraitOut = H > W;
    const pre = `scale='trunc(iw*sar/2)*2':ih,setsar=1,bwdif=mode=send_frame:parity=auto:deint=interlaced,fps=${FPS}`;
    const tail = `,format=yuv420p${color},tpad=stop_mode=clone:stop_duration=4,trim=duration=${r3(L)},setpts=PTS-STARTPTS[v]`;
    let fc;
    if (portraitSrc === portraitOut || !md.width) {
      fc = `[0:v]${pre},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1${tail}`;
    } else {
      // Clip horizontal en video vertical (o al revés): fondo difuminado del mismo clip.
      const w4 = Math.round(W / 8) * 2, h4 = Math.round(H / 8) * 2;
      fc = `[0:v]${pre},split=2[a][b];` +
        `[a]scale=${w4}:${h4}:force_original_aspect_ratio=increase,crop=${w4}:${h4},boxblur=8:2,scale=${W}:${H},eq=brightness=-0.07:saturation=0.9[bg];` +
        `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg];` +
        `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1${tail}`;
    }
    return [...BASE, ...(o.hwaccel ? ['-hwaccel', 'auto'] : []), '-ss', r3(seg.start), '-t', r3(L + 0.5), '-i', md.path,
      '-filter_complex', fc, '-map', '[v]', '-an', ...INTERMEDIATE, seg.out];
  };

  /* ---------- Unir con transiciones ---------- */
  E.joinFilter = (lens, T, transitions) => {
    const parts = lens.map((_, i) => `[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p,setsar=1[s${i}]`);
    if (lens.length === 1) return { fc: parts[0].replace('[s0]', '[j]'), len: lens[0] };
    let acc = lens[0], prev = 's0';
    for (let k = 1; k < lens.length; k++) {
      const out = k === lens.length - 1 ? 'j' : `x${k}`;
      parts.push(`[${prev}][s${k}]xfade=transition=${transitions[k - 1] || 'fade'}:duration=${r3(T)}:offset=${r3(acc - T)}[${out}]`);
      acc = q(acc + lens[k] - T);
      prev = out;
    }
    return { fc: parts.join(';'), len: acc };
  };

  /* ---------- Etapa 2: grupo de tomas ---------- */
  E.BATCH = 10;
  E.batchArgs = (paths, lens, T, transitions, out) => {
    const j = E.joinFilter(lens, T, transitions);
    const args = [...BASE];
    paths.forEach(p => args.push('-i', p));
    args.push('-filter_complex', j.fc, '-map', '[j]', '-an', ...INTERMEDIATE, out);
    return { args, len: j.len };
  };

  /* ---------- Etapa 3: video final ---------- */
  E.finalArgs = o => {
    const args = [...BASE];
    o.inputs.forEach(p => args.push('-i', p));
    let idx = o.inputs.length;
    const total = o.total;
    const ov = (o.overlays || []).map(x => { args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(total), '-i', x.path); return Object.assign({ idx: idx++ }, x); });
    let wm = -1;
    if (o.watermark) { args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(total), '-i', o.watermark); wm = idx++; }
    let au = -1;
    if (o.audio) { args.push('-ss', r3(o.audio.start || 0), '-t', r3(total), '-i', o.audio.path); au = idx++; }
    const j = E.joinFilter(o.lens, o.T, o.transitions);
    let fc = j.fc, cur = 'j';
    ov.forEach((x, i) => {
      let f = `[${x.idx}:v]format=rgba`;
      if (x.fin) f += `,fade=t=in:st=${r3(x.a)}:d=${r3(x.fin)}:alpha=1`;
      if (x.fout) f += `,fade=t=out:st=${r3(x.b - x.fout)}:d=${r3(x.fout)}:alpha=1`;
      fc += `;${f}[ov${i}];[${cur}][ov${i}]overlay=0:0:enable='between(t,${r3(x.a)},${r3(x.b)})'[c${i}]`;
      cur = `c${i}`;
    });
    if (wm >= 0) { fc += `;[${wm}:v]format=rgba[wm];[${cur}][wm]overlay=0:0[cw]`; cur = 'cw'; }
    fc += `;[${cur}]fade=t=in:st=0:d=0.5,fade=t=out:st=${r3(Math.max(0, total - 1))}:d=1,format=yuv420p[vout]`;
    if (au >= 0) fc += `;[${au}:a]aresample=48000,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.8,afade=t=out:st=${r3(Math.max(0, total - 2.5))}:d=2.5[aout]`;
    args.push('-filter_complex', fc, '-map', '[vout]');
    if (au >= 0) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
    args.push('-t', r3(total), '-r', String(FPS), ...(o.encoderArgs || E.ENCODERS.libx264), '-movflags', '+faststart', o.out);
    return args;
  };

  /* ---------- Trabajo completo ----------
   * Devuelve la lista ordenada de pasos para correr; cada paso trae su peso para la barra de progreso. */
  E.buildJob = o => {
    const p = o.plan, T = p.T, sep = o.sep || '/';
    const j = (...xs) => xs.join(sep);
    const steps = [];
    const segOuts = p.segments.map((s, i) => {
      const out = j(o.tmp, `toma_${String(i + 1).padStart(3, '0')}.mp4`);
      const seg = Object.assign({}, s, { out });
      steps.push({ stage: 'toma', n: i + 1, of: p.segments.length, seconds: s.len + T, weight: (s.len + T) * 1.0,
        args: E.segmentArgs(seg, o.media[s.m], o), media: s.m });
      return out;
    });
    let inputs = segOuts, lens = p.segments.map(s => q(s.len + T)), transitions = p.transitions;
    if (segOuts.length > 12) {
      const bIn = [], bLens = [], bTr = [];
      const groups = Math.ceil(segOuts.length / E.BATCH);
      for (let g = 0; g < groups; g++) {
        const a = g * E.BATCH, b = Math.min(segOuts.length, a + E.BATCH);
        const out = j(o.tmp, `grupo_${String(g + 1).padStart(2, '0')}.mp4`);
        const r = E.batchArgs(segOuts.slice(a, b), lens.slice(a, b), T, transitions.slice(a, b - 1), out);
        steps.push({ stage: 'grupo', n: g + 1, of: groups, seconds: r.len, weight: r.len * 0.5, args: r.args });
        bIn.push(out); bLens.push(r.len);
        if (b < segOuts.length) bTr.push(transitions[b - 1]);
      }
      inputs = bIn; lens = bLens; transitions = bTr;
    }
    const total = E.joinFilter(lens, T, transitions).len;
    const finalOpts = { inputs, lens, T, transitions, total, overlays: o.overlays, watermark: o.watermark, audio: o.audio,
      encoderArgs: o.encoderArgs, out: o.out };
    steps.push({ stage: 'final', n: 1, of: 1, seconds: total, weight: total * 1.2, final: true, finalOpts, args: E.finalArgs(finalOpts) });
    return { steps, total };
  };

  E.fmtTime = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };

  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.Engine = E;
})(typeof window !== 'undefined' ? window : globalThis);
