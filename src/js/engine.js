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

  E.fmtTime = s => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };

  /* Nombre corto y estable a partir de un texto (para reconocer trabajo ya hecho y no repetirlo). */
  E.hash = str => {
    let a = 0x811c9dc5, b = 5381;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
      b = (Math.imul(b, 33) + c) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  };

  /* =====================================================================
   * PELÍCULA DEL EVENTO
   * Cada toma se prepara con su sonido; luego cada capítulo (momento) se une
   * con transiciones, música que baja sola cuando hay voz y la marca de agua;
   * al final se pegan los capítulos sin volver a codificar el video y se
   * empareja el volumen de toda la película (dos pasadas de loudnorm).
   * Todo archivo intermedio se nombra por su contenido: si se interrumpe,
   * al volver a crear se salta lo que ya estaba hecho.
   * ===================================================================== */
  E.FILM_MOODS = {
    suave: { T: 0.8, list: ['fade'] },
    dinamico: { T: 0.5, list: ['fade', 'smoothleft', 'fade', 'circleopen', 'fade', 'smoothright', 'fade', 'slideup'] },
    corte: { T: 0, list: [] }
  };
  E.FILM_INTER = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', String(FPS)];
  E.FILM_INTER_GPU = {
    h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '18', '-b:v', '0', '-pix_fmt', 'yuv420p', '-g', String(FPS)],
    h264_qsv: ['-c:v', 'h264_qsv', '-preset', 'fast', '-global_quality', '19', '-pix_fmt', 'nv12', '-g', String(FPS)],
    h264_amf: ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cqp', '-qp_i', '18', '-qp_p', '19', '-pix_fmt', 'nv12', '-g', String(FPS)]
  };
  const PCM = ['-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2'];
  const AFMT = 'aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

  // Una toma: video (o foto, o tarjeta de título) + su sonido, al formato de la película.
  E.filmSegmentArgs = (s, o, out) => {
    const { W, H } = o, L = q(s.len);
    const args = [...BASE];
    let v;
    if (s.kind === 'video') {
      args.push(...(o.hwaccel ? ['-hwaccel', 'auto'] : []), '-ss', r3(s.in || 0), '-t', r3(L + 0.3), '-i', s.path);
      const portraitSrc = s.h > s.w, portraitOut = H > W;
      const pre = `scale='trunc(iw*sar/2)*2':ih,setsar=1,bwdif=mode=send_frame:parity=auto:deint=interlaced,fps=${FPS}`;
      const color = E.videoColor(o.enhance, o.style);
      const tail = `,format=yuv420p${color},tpad=stop_mode=clone:stop_duration=4,trim=duration=${r3(L)},setpts=PTS-STARTPTS[v]`;
      if (portraitSrc === portraitOut || !s.w) {
        v = `[0:v]${pre},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1${tail}`;
      } else {
        const w4 = Math.round(W / 8) * 2, h4 = Math.round(H / 8) * 2;
        v = `[0:v]${pre},split=2[a0][b0];` +
          `[a0]scale=${w4}:${h4}:force_original_aspect_ratio=increase,crop=${w4}:${h4},boxblur=8:2,scale=${W}:${H},eq=brightness=-0.07:saturation=0.9[bg];` +
          `[b0]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1${tail}`;
      }
    } else {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(L + 0.2), '-i', s.still);
      if (s.kind === 'image') {
        const N = Math.round(L * FPS), Z = 0.06;
        const z = s.zoomIn ? `1+${Z}*on/${N}` : `${1 + Z}-${Z}*on/${N}`;
        v = `[0:v]format=yuv420p,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1,trim=duration=${r3(L)},setpts=PTS-STARTPTS[v]`;
      } else {
        v = `[0:v]scale=${W}:${H},format=yuv420p,setsar=1,trim=duration=${r3(L)},setpts=PTS-STARTPTS[v]`;
      }
    }
    let a;
    const vol = Math.max(0, Math.min(2, s.vol == null ? 1 : s.vol));
    if (s.kind === 'video' && s.hasAudio && vol > 0.001) {
      a = `[0:a]${AFMT},volume=${r3(vol)}${o.denoise ? ',afftdn=nf=-28' : ''},apad,atrim=duration=${r3(L)},asetpts=PTS-STARTPTS[a]`;
    } else {
      args.push('-f', 'lavfi', '-t', r3(L), '-i', 'anullsrc=r=48000:cl=stereo');
      a = `[1:a]${AFMT},atrim=duration=${r3(L)},asetpts=PTS-STARTPTS[a]`;
    }
    args.push('-filter_complex', `${v};${a}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), ...(o.interArgs || E.FILM_INTER), ...PCM, '-t', r3(L), out);
    return args;
  };

  // Une tomas (o grupos) con transiciones de video y de sonido.
  E.filmJoinFilter = (lens, T, transitions) => {
    const n = lens.length, p = [];
    lens.forEach((_, i) => { p.push(`[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p,setsar=1[v${i}]`, `[${i}:a]${AFMT},asetpts=PTS-STARTPTS[a${i}]`); });
    if (n === 1) { p.push('[v0]null[jv]', '[a0]anull[ja]'); return { fc: p.join(';'), len: lens[0] }; }
    if (!T) {
      p.push(lens.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${n}:v=1:a=1[jv][ja]`);
      return { fc: p.join(';'), len: q(lens.reduce((s, l) => s + l, 0)) };
    }
    let acc = lens[0], pv = 'v0', pa = 'a0';
    for (let k = 1; k < n; k++) {
      const last = k === n - 1, ov = last ? 'jv' : `xv${k}`, oa = last ? 'ja' : `xa${k}`;
      p.push(`[${pv}][v${k}]xfade=transition=${transitions[k - 1] || 'fade'}:duration=${r3(T)}:offset=${r3(acc - T)}[${ov}]`);
      p.push(`[${pa}][a${k}]acrossfade=d=${r3(T)}:c1=tri:c2=tri[${oa}]`);
      acc = q(acc + lens[k] - T); pv = ov; pa = oa;
    }
    return { fc: p.join(';'), len: acc };
  };

  // Un capítulo terminado: unión + música con "ducking" + marca de agua + fundido de entrada y salida.
  E.filmUnitArgs = (inputs, lens, T, transitions, x, out) => {
    const args = [...BASE];
    inputs.forEach(f => args.push('-i', f));
    const j = E.filmJoinFilter(lens, T, transitions);
    const len = j.len;
    let fc = j.fc, idx = inputs.length, va = 'jv', aa = 'ja';
    if (x.music) {
      args.push('-stream_loop', '-1', '-ss', r3(x.music.start || 0), '-i', x.music.path);
      const mv = Math.max(0, Math.min(1.5, x.music.vol == null ? .6 : x.music.vol));
      fc += `;[${idx}:a]${AFMT},volume=${r3(mv)},atrim=duration=${r3(len)},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=1.5,afade=t=out:st=${r3(Math.max(0, len - 2))}:d=2[mu]` +
        `;[${aa}]asplit=2[sc][vo];[mu][sc]sidechaincompress=threshold=0.015:ratio=12:attack=15:release=700[md]` +
        `;[vo][md]amix=inputs=2:duration=first:normalize=0[am]`;
      aa = 'am'; idx++;
    }
    if (x.watermark) {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(len), '-i', x.watermark);
      const en = x.wmFrom ? `:enable='gte(t,${r3(x.wmFrom)})'` : '';
      fc += `;[${idx}:v]format=rgba[wm];[${va}][wm]overlay=0:0${en}[vw]`;
      va = 'vw'; idx++;
    }
    if (x.fades) {
      fc += `;[${va}]fade=t=in:st=0:d=0.5,fade=t=out:st=${r3(Math.max(0, len - 0.6))}:d=0.6[vf]` +
        `;[${aa}]afade=t=in:st=0:d=0.3,afade=t=out:st=${r3(Math.max(0, len - 0.6))}:d=0.6[af]`;
      va = 'vf'; aa = 'af';
    }
    fc += `;[${va}]format=yuv420p[vo2];[${aa}]${AFMT}[ao2]`;
    args.push('-filter_complex', fc, '-map', '[vo2]', '-map', '[ao2]', '-r', String(FPS), ...(x.encArgs || E.FILM_INTER), ...PCM, '-t', r3(len), out);
    return { args, len };
  };

  /* Arma todos los pasos de la película.
   * o.units: [{ name, segments:[{kind:'video'|'image'|'card', ...}], music }] en orden (portada, momentos, créditos). */
  E.filmBuild = o => {
    const mood = E.FILM_MOODS[o.mood] || E.FILM_MOODS.suave;
    const T = q(mood.T), sep = o.sep || '/';
    const J = name => o.cache + sep + name;
    const steps = [], unitOuts = [], chapters = [];
    const encKey = (o.encArgs || []).join(' '), interKey = (o.interArgs || E.FILM_INTER).join(' ');
    let t = 0, tr = 0;
    o.units.forEach((u, ui) => {
      const segs = u.segments.filter(s => s.len >= 0.5);
      if (!segs.length) return;
      const segFiles = [], lens = [];
      segs.forEach((s, si) => {
        const L = q(s.len);
        const key = E.hash(JSON.stringify([s.kind, s.path || s.still, s.in || 0, L, s.w, s.h, s.hasAudio, s.vol, s.zoomIn, o.W, o.H, o.enhance, o.style, o.denoise, !!o.hwaccel, interKey]));
        const out = J(`toma_${key}.mkv`);
        steps.push({ stage: 'toma', unit: ui, unitName: u.name, n: si + 1, of: segs.length, seconds: L, weight: L, out, seg: s,
          args: E.filmSegmentArgs(Object.assign({}, s, { len: L }), o, out) });
        segFiles.push(out); lens.push(L);
      });
      // Transiciones: la primera después de una tarjeta de título siempre es fundido.
      const trans = [];
      for (let k = 1; k < segs.length; k++) trans.push(segs[k - 1].kind === 'card' ? 'fade' : (mood.list[(tr++) % (mood.list.length || 1)] || 'fade'));
      // Más de 12 tomas: se unen de 10 en 10 para cuidar la memoria.
      let inputs = segFiles, ilens = lens, itrans = trans;
      if (segFiles.length > 12) {
        const gIn = [], gLens = [], gTr = [];
        for (let a = 0, g = 1; a < segFiles.length; a += E.BATCH, g++) {
          const b = Math.min(segFiles.length, a + E.BATCH);
          const sub = segFiles.slice(a, b), subL = lens.slice(a, b), subT = trans.slice(a, b - 1);
          const key = E.hash(JSON.stringify([sub, subL, T, subT, interKey]));
          const out = J(`grupo_${key}.mkv`);
          const r = E.filmUnitArgs(sub, subL, T, subT, { encArgs: o.interArgs || E.FILM_INTER }, out);
          steps.push({ stage: 'grupo', unit: ui, unitName: u.name, n: g, of: Math.ceil(segFiles.length / E.BATCH), seconds: r.len, weight: r.len * .5, out, args: r.args });
          gIn.push(out); gLens.push(r.len);
          if (b < segFiles.length) gTr.push(trans[b - 1]);
        }
        inputs = gIn; ilens = gLens; itrans = gTr;
      }
      // La marca de agua no va sobre la portada ni los créditos, y en cada capítulo empieza después de su título.
      const x = { music: u.music || null, watermark: u.noWatermark ? null : (o.watermark || null), fades: true, encArgs: o.encArgs,
        wmFrom: segs[0].kind === 'card' && segs.length > 1 ? q(segs[0].len) : 0 };
      const key = E.hash(JSON.stringify([inputs, ilens, T, itrans, x.music, x.watermark, x.wmFrom, encKey]));
      const out = J(`capitulo_${key}.mkv`);
      const r = E.filmUnitArgs(inputs, ilens, T, itrans, x, out);
      steps.push({ stage: 'capitulo', unit: ui, unitName: u.name, n: 1, of: 1, seconds: r.len, weight: r.len * 1.1, out, args: r.args, unitFinal: true });
      unitOuts.push(out);
      chapters.push({ title: u.chapter || u.name, start: t, end: t + r.len });
      t = q(t + r.len);
    });
    const list = 'ffconcat version 1.0\n' + unitOuts.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n';
    const meta = ';FFMETADATA1\n' + (o.title ? `title=${E.metaEsc(o.title)}\n` : '') + chapters.map(c =>
      `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.start * 1000)}\nEND=${Math.round(c.end * 1000)}\ntitle=${E.metaEsc(c.title)}\n`).join('');
    return { steps, list, meta, chapters, total: t, listPath: J('lista.ffconcat'), metaPath: J('capitulos.txt') };
  };
  E.metaEsc = s => String(s).replace(/([=;#\\\n])/g, '\\$1');

  // Volumen parejo de toda la película: 1) medir, 2) aplicar y guardar el MP4 final.
  E.LOUD = 'I=-16:TP=-1.5:LRA=11';
  E.filmMeasureArgs = listPath => ['-hide_banner', '-nostats', '-f', 'concat', '-safe', '0', '-i', listPath, '-vn',
    '-af', `loudnorm=${E.LOUD}:print_format=json`, '-f', 'null', '-'];
  E.parseLoudnorm = text => {
    const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(text || '');
    if (!m) return null;
    try { const j = JSON.parse(m[0]); return isFinite(+j.input_i) ? j : null; } catch (e) { return null; }
  };
  E.filmFinalArgs = (listPath, metaPath, measured, out) => {
    let ln = `loudnorm=${E.LOUD}`;
    if (measured && isFinite(+measured.input_i) && +measured.input_i > -70) {
      ln += `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}` +
        `:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
    }
    return [...BASE, '-f', 'concat', '-safe', '0', '-i', listPath, '-f', 'ffmetadata', '-i', metaPath,
      '-map', '0:v', '-map', '0:a', '-map_metadata', '1', '-map_chapters', '1',
      '-c:v', 'copy', '-af', `${ln},aresample=48000`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out];
  };

  // Revisión rápida de una toma: brillo en los cuadros clave y volumen promedio.
  E.scanArgs = (path, hasAudio) => {
    const a = ['-hide_banner', '-nostats', '-v', 'info', '-skip_frame', 'nokey', '-i', path,
      '-map', '0:v:0', '-vf', 'scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'];
    if (hasAudio) a.push('-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-');
    return a;
  };
  E.parseScan = (text, info) => {
    const y = [...String(text).matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map(m => +m[1]);
    const mv = /mean_volume:\s*(-?[\d.]+) dB/.exec(text || '');
    const sorted = y.slice().sort((a, b) => a - b), med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const flags = [];
    if (y.length && y.filter(v => v < 22).length / y.length >= .7) flags.push('negra');
    else if (med != null && med < 42) flags.push('oscura');
    if (info.duration < 2) flags.push('corta');
    if (info.duration > 300) flags.push('larga');
    if (!info.hasAudio || (mv && +mv[1] < -50)) flags.push('sinsonido');
    if (info.height > info.width) flags.push('vertical');
    return { flags, brightness: med, meanVolume: mv ? +mv[1] : null };
  };

  // Hora de grabación desde los datos del archivo (los iPhone guardan la hora local con su zona).
  E.creationTime = probeJson => {
    const d = typeof probeJson === 'string' ? JSON.parse(probeJson) : probeJson;
    const tags = Object.assign({}, (d.format && d.format.tags) || {});
    (d.streams || []).forEach(s => { if (s.tags && s.tags.creation_time && !tags.creation_time) tags.creation_time = s.tags.creation_time; });
    const apple = tags['com.apple.quicktime.creationdate'];
    const raw = apple || tags.creation_time;
    if (!raw) return null;
    const t = Date.parse(String(raw).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return isFinite(t) && t > Date.UTC(2000, 0, 1) ? t : null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.Engine = E;
})(typeof window !== 'undefined' ? window : globalThis);
