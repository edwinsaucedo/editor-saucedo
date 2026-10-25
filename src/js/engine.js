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
    if (!T) {   // cortes directos (por ejemplo, al ritmo de la canción)
      parts.push(lens.map((_, i) => `[s${i}]`).join('') + `concat=n=${lens.length}:v=1:a=0[j]`);
      return { fc: parts.join(';'), len: q(lens.reduce((a, b) => a + b, 0)) };
    }
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

  /* Ajustes avanzados de una toma (edición avanzada de la película). */
  E.SPEEDS = [0.5, 0.75, 1, 1.5, 2];
  const spd = s => { const v = +s.speed || 1; return v < 0.5 ? 0.5 : v > 2 ? 2 : v; };
  // Girar y acercar (recorte al centro), antes de acomodar al formato.
  E.clipPre = s => {
    const parts = [], rot = (((+s.rot || 0) % 360) + 360) % 360, z = +s.zoom || 1;
    if (rot === 90) parts.push('transpose=1'); else if (rot === 180) parts.push('hflip,vflip'); else if (rot === 270) parts.push('transpose=2');
    if (z > 1.001) parts.push(`crop='trunc(iw/${r3(z)}/2)*2':'trunc(ih/${r3(z)}/2)*2'`);
    return parts.length ? ',' + parts.join(',') : '';
  };
  // Estabilizar: ya al tamaño de la película (más rápido que en 4K) y con un acercamiento leve para esconder las orillas.
  E.clipStab = (s, W, H) => s.stab ? `,deshake=rx=32:ry=32:edge=mirror,crop='trunc(iw/1.08/2)*2':'trunc(ih/1.08/2)*2',scale=${W}:${H},setsar=1` : '';
  // Color propio de la toma: b brillo, c contraste, s saturación, w calidez (de -100 a 100).
  E.clipColor = col => {
    if (!col) return '';
    const b = (+col.b || 0) / 100, c = (+col.c || 0) / 100, sa = (+col.s || 0) / 100, w = (+col.w || 0) / 100, p = [];
    if (b || c || sa) p.push(`eq=brightness=${r3(b * .2)}:contrast=${r3(1 + c * .4)}:saturation=${r3(Math.max(0, 1 + sa))}`);
    if (w) p.push(`colorbalance=rm=${r3(w * .12)}:gm=${r3(w * .02)}:bm=${r3(-w * .12)}`);
    return p.length ? ',' + p.join(',') : '';
  };
  // Cuánto se lee del archivo para una toma de L segundos en pantalla.
  E.srcLen = (s, L) => L * spd(s);

  // Una toma: video (o foto, o tarjeta de título) + su sonido, al formato de la película.
  E.filmSegmentArgs = (s, o, out) => {
    const { W, H } = o, L = q(s.len);
    const args = [...BASE];
    let v;
    if (s.kind === 'video') {
      const sp = spd(s), rot = (((+s.rot || 0) % 360) + 360) % 360;
      args.push(...(o.hwaccel ? ['-hwaccel', 'auto'] : []), '-ss', r3(s.in || 0), '-t', r3(L * sp + 0.3), '-i', s.path);
      const sw = rot === 90 || rot === 270 ? s.h : s.w, sh = rot === 90 || rot === 270 ? s.w : s.h;
      const portraitSrc = sh > sw, portraitOut = H > W;
      const pre = `scale='trunc(iw*sar/2)*2':ih,setsar=1,bwdif=mode=send_frame:parity=auto:deint=interlaced${sp !== 1 ? `,setpts=(PTS-STARTPTS)/${r3(sp)}` : ''},fps=${FPS}${E.clipPre(s)}`;
      const color = E.videoColor(o.enhance, o.style) + E.clipColor(s.color);
      const tail = `${E.clipStab(s, W, H)},format=yuv420p${color},tpad=stop_mode=clone:stop_duration=4,trim=duration=${r3(L)},setpts=PTS-STARTPTS[v]`;
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
    let a, next = 1;
    const vol = Math.max(0, Math.min(2, s.vol == null ? 1 : s.vol));
    if (s.kind === 'video' && s.hasAudio && vol > 0.001) {
      const sp = spd(s);
      a = `[0:a]${AFMT}${sp !== 1 ? `,atempo=${r3(sp)}` : ''},volume=${r3(vol)}${o.denoise ? ',afftdn=nf=-28' : ''},apad,atrim=duration=${r3(L)},asetpts=PTS-STARTPTS[a]`;
    } else {
      args.push('-f', 'lavfi', '-t', r3(L), '-i', 'anullsrc=r=48000:cl=stereo');
      a = `[1:a]${AFMT},atrim=duration=${r3(L)},asetpts=PTS-STARTPTS[a]`;
      next = 2;
    }
    // Letrero de la toma ("Los padrinos"): aparece al inicio unos segundos.
    if (s.label) {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(L + 0.2), '-i', s.label);
      const a0 = 0.4, a1 = Math.max(a0 + 1, Math.min(L - 0.3, 5));
      v = v.replace(/\[v\]$/, '[lv]') + `;[${next}:v]format=rgba,fade=t=in:st=${a0}:d=0.4:alpha=1,fade=t=out:st=${r3(a1 - 0.5)}:d=0.5:alpha=1[lb];` +
        `[lv][lb]overlay=0:0:shortest=1:enable='between(t,${a0},${r3(a1)})',format=yuv420p[v]`;
      next++;
    }
    // Marca de agua de esta toma (negra o blanca según su fondo)
    if (s.wm) {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(L + 0.2), '-i', s.wm);
      v = v.replace(/\[v\]$/, '[pv]') + `;[${next}:v]format=rgba[wm];[pv][wm]overlay=0:0:shortest=1,format=yuv420p[v]`;
      next++;
    }
    args.push('-filter_complex', `${v};${a}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), ...(o.interArgs || E.FILM_INTER), ...PCM, '-t', r3(L), out);
    return args;
  };

  // Une tomas (o grupos) con transiciones de video y de sonido.
  // T puede ser un número (igual en todas las uniones) o una lista con la duración de cada unión (0 = corte directo).
  const CUT = 1 / FPS;
  E.joinDur = (T, k) => Array.isArray(T) ? (T[k] || 0) : (T || 0);
  E.filmJoinFilter = (lens, T, transitions) => {
    const n = lens.length, p = [];
    lens.forEach((_, i) => { p.push(`[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p,setsar=1[v${i}]`, `[${i}:a]${AFMT},asetpts=PTS-STARTPTS[a${i}]`); });
    if (n === 1) { p.push('[v0]null[jv]', '[a0]anull[ja]'); return { fc: p.join(';'), len: lens[0] }; }
    const all0 = Array.isArray(T) ? T.slice(0, n - 1).every(x => !x) : !T;
    if (all0) {
      p.push(lens.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${n}:v=1:a=1[jv][ja]`);
      return { fc: p.join(';'), len: q(lens.reduce((s, l) => s + l, 0)) };
    }
    let acc = lens[0], pv = 'v0', pa = 'a0';
    for (let k = 1; k < n; k++) {
      const last = k === n - 1, ov = last ? 'jv' : `xv${k}`, oa = last ? 'ja' : `xa${k}`;
      const d = q(Math.max(CUT, E.joinDur(T, k - 1))), tr = E.joinDur(T, k - 1) ? (transitions[k - 1] || 'fade') : 'fade';
      p.push(`[${pv}][v${k}]xfade=transition=${tr}:duration=${r3(d)}:offset=${r3(acc - d)}[${ov}]`);
      p.push(`[${pa}][a${k}]acrossfade=d=${r3(d)}:c1=tri:c2=tri[${oa}]`);
      acc = q(acc + lens[k] - d); pv = ov; pa = oa;
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
        // Ajustes avanzados en la clave solo si los hay: así las tomas ya hechas con versiones anteriores se aprovechan.
        const adv = [+s.speed || 1, +s.rot || 0, +s.zoom || 1, s.color || null, !!s.stab, s.label || ''];
        const plain = adv[0] === 1 && !adv[1] && adv[2] === 1 && !adv[3] && !adv[4] && !adv[5];
        const key = E.hash(JSON.stringify([s.kind, s.path || s.still, s.in || 0, L, s.w, s.h, s.hasAudio, s.vol, s.zoomIn, s.wm || '', o.W, o.H, o.enhance, o.style, o.denoise, !!o.hwaccel, interKey].concat(plain ? [] : [adv])));
        const out = J(`toma_${key}.mkv`);
        steps.push({ stage: 'toma', unit: ui, unitName: u.name, n: si + 1, of: segs.length, seconds: L, weight: L, out, seg: s,
          args: E.filmSegmentArgs(Object.assign({}, s, { len: L }), o, out) });
        segFiles.push(out); lens.push(L);
      });
      // Transición y duración de cada unión: la que se eligió para la toma o el momento (edición avanzada) o la del estilo.
      // Después de una tarjeta de título, fundido; entre pedazos de una misma toma, un fundido muy corto.
      const trans = [], Ts = [];
      for (let k = 1; k < segs.length; k++) {
        const s = segs[k], prev = segs[k - 1];
        let type, d;
        if (s.join) { type = 'fade'; d = T ? Math.min(T, 0.3) : 0; }
        else if (s.trans && s.trans.type && s.trans.type !== 'auto') { type = s.trans.type; d = type === 'corte' ? 0 : (+s.trans.dur || T || 0.8); }
        else if (prev.kind === 'card') { type = 'fade'; d = T; }
        else { type = mood.list[(tr++) % (mood.list.length || 1)] || 'fade'; d = T; }
        d = type === 'corte' ? 0 : q(Math.min(d, Math.max(0, Math.min(lens[k - 1], lens[k]) * .45)));
        trans.push(type === 'corte' ? 'fade' : type); Ts.push(d);
      }
      const uniform = Ts.every(x => x === T);
      // Más de 12 tomas: se unen de 10 en 10 para cuidar la memoria. En 4K cada toma ocupa 4 veces más
      // memoria al unirla, así que se unen de 3 en 3 (y los grupos otra vez de 3 en 3, las veces que haga falta).
      const big = o.W * o.H > 4.2e6, MAXIN = big ? 3 : 12, BATCH = big ? 3 : E.BATCH;
      let inputs = segFiles, ilens = lens, itrans = trans, iD = Ts;
      for (let level = 1; inputs.length > MAXIN; level++) {
        const gIn = [], gLens = [], gTr = [], gD = [], ng = Math.ceil(inputs.length / BATCH);
        for (let a = 0, g = 1; a < inputs.length; a += BATCH, g++) {
          const b = Math.min(inputs.length, a + BATCH);
          if (b - a === 1) { gIn.push(inputs[a]); gLens.push(ilens[a]); }
          else {
            const sub = inputs.slice(a, b), subL = ilens.slice(a, b), subT = itrans.slice(a, b - 1), subD = uniform ? T : iD.slice(a, b - 1);
            const key = E.hash(JSON.stringify([sub, subL, subD, subT, interKey]));
            const out = J(`grupo_${key}.mkv`);
            const r = E.filmUnitArgs(sub, subL, subD, subT, { encArgs: o.interArgs || E.FILM_INTER }, out);
            steps.push({ stage: 'grupo', unit: ui, unitName: u.name, n: g, of: ng, level, seconds: r.len, weight: r.len * .5, out, args: r.args });
            gIn.push(out); gLens.push(r.len);
          }
          if (b < inputs.length) { gTr.push(itrans[b - 1]); gD.push(iD[b - 1]); }
        }
        inputs = gIn; ilens = gLens; itrans = gTr; iD = gD;
      }
      const iT = uniform ? T : iD;
      // La marca de agua no va sobre la portada ni los créditos, y en cada capítulo empieza después de su título.
      const x = { music: u.music || null, watermark: u.noWatermark ? null : (o.watermark || null), fades: true, encArgs: o.encArgs,
        wmFrom: segs[0].kind === 'card' && segs.length > 1 ? q(segs[0].len) : 0 };
      const key = E.hash(JSON.stringify([inputs, ilens, iT, itrans, x.music, x.watermark, x.wmFrom, encKey]));
      const out = J(`capitulo_${key}.mkv`);
      const r = E.filmUnitArgs(inputs, ilens, iT, itrans, x, out);
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

  /* =====================================================================
   * PLANTILLAS (estilo CapCut)
   * Igual que el motor de arriba, pero cada toma lleva su propia marca de agua
   * (negra o blanca según el fondo), las capas de texto pueden ser animadas
   * (secuencias PNG dibujadas en el programa), hay efectos finales (grano, VHS,
   * viñeta) y los cortes pueden caer en el ritmo de la canción.
   * ===================================================================== */
  E.FORMATS = {
    v: { W: 1080, H: 1920, name: 'vertical', label: 'Vertical 9:16' },
    h: { W: 1920, H: 1080, name: 'horizontal', label: 'Horizontal 16:9' },
    sq: { W: 1080, H: 1080, name: 'cuadrado', label: 'Cuadrado 1:1' }
  };

  // Largo de cada toma ajustado al ritmo: tantos tiempos de la canción como pida la plantilla.
  E.beatUnit = (period, beats, lo, hi) => {
    let u = period * (beats || 4);
    lo = lo || 1.4; hi = hi || 4.8;
    while (u < lo) u *= 2;
    while (u > hi) u /= 2;
    return u;
  };

  /* ---------- Acortar la película ----------
   * Partes que se usan de una toma (quitando los cortes) en segundos del archivo. */
  E.keptRanges = (c, minPiece) => {
    const a0 = c.in || 0, b0 = c.out || c.duration || 0, m = minPiece == null ? 0.5 : minPiece;
    const cuts = (c.cuts || []).filter(r => r[1] > a0 && r[0] < b0).map(r => [Math.max(a0, r[0]), Math.min(b0, r[1])]).sort((x, y) => x[0] - y[0]);
    const out = []; let t = a0;
    cuts.forEach(([a, b]) => { if (a - t >= m) out.push([t, a]); t = Math.max(t, b); });
    if (b0 - t >= m) out.push([t, b0]);
    return out;
  };
  /* Elige qué quitar para acortar: ventanas de `win` segundos con el puntaje más bajo (oscuro, quieto, sin sonido,
   * borroso). Cada toma conserva al menos `minKeep` segundos y los huecos chicos entre partes quitadas también se quitan.
   * clips: [{ id, in, out, duration, cuts, hl, speed }] · need: segundos (en pantalla) que hay que quitar.
   * Devuelve { cuts: { id: [[a, b], ...] }, removed } con los cortes nuevos (además de los que ya tenía). */
  E.planShorten = (clips, need, opt) => {
    opt = opt || {};
    const win = opt.win || 6, minKeep = opt.minKeep || 3, gap = opt.gap || 4;
    const wins = [], keepLeft = {};
    clips.forEach(c => {
      const sp = +c.speed || 1, S = E.hlScores(c.hl, c.in || 0, c.out || c.duration);
      const at = t => S.s[Math.max(0, Math.min(S.s.length - 1, Math.floor((t - S.ini) / S.step)))] ?? 0.5;
      let kept = 0;
      E.keptRanges(c).forEach(([a, b]) => {
        kept += b - a;
        for (let t = a; t + win <= b + 1e-6; t += win) {
          let sum = 0, n = 0;
          for (let x = t; x < t + win; x += S.step) { sum += at(x); n++; }
          wins.push({ id: c.id, a: t, b: t + win, sc: n ? sum / n : 0.5, sp });
        }
      });
      keepLeft[c.id] = kept / sp;
    });
    // Suavizado con las ventanas vecinas de la misma toma: así se quitan tramos completos y no pedacitos sueltos.
    const raw = wins.map(w => w.sc);
    wins.forEach((w, i) => {
      const p = i > 0 && wins[i - 1].id === w.id && Math.abs(wins[i - 1].b - w.a) < 1e-6 ? raw[i - 1] : raw[i];
      const n = i + 1 < wins.length && wins[i + 1].id === w.id && Math.abs(wins[i + 1].a - w.b) < 1e-6 ? raw[i + 1] : raw[i];
      w.sc = .6 * raw[i] + .2 * p + .2 * n;
    });
    wins.sort((x, y) => x.sc - y.sc || x.a - y.a);
    const picked = {}; let removed = 0;
    for (const w of wins) {
      if (removed >= need) break;
      const len = (w.b - w.a) / w.sp;
      if (keepLeft[w.id] - len < minKeep) continue;
      (picked[w.id] = picked[w.id] || []).push([w.a, w.b]);
      keepLeft[w.id] -= len; removed += len;
    }
    const cuts = {};
    clips.forEach(c => {
      const list = (picked[c.id] || []).sort((x, y) => x[0] - y[0]);
      if (!list.length) return;
      const sp = +c.speed || 1, merged = [];
      list.forEach(r => {
        const last = merged[merged.length - 1];
        // se juntan si están pegadas o si lo que queda en medio es muy corto para verse
        const g = (r[0] - last?.[1]) / sp;
        if (last && r[0] - last[1] < gap && keepLeft[c.id] - g >= minKeep) { removed += g; keepLeft[c.id] -= g; last[1] = r[1]; } else merged.push(r.slice());
      });
      cuts[c.id] = merged.map(r => [Math.round(r[0] * 10) / 10, Math.round(r[1] * 10) / 10]);
    });
    return { cuts, removed };
  };

  /* opt: { media:[{kind,duration}], mode:'shots'|'song', intro, outro, shot, T, target, trans:[...],
   *        beat:{period, offset} | null, beats, maxShots } */
  E.tplPlan = opt => {
    const T = q(opt.T || 0), n = opt.media.length;
    if (!n) throw new Error('Agrega al menos una foto o un video.');
    const beat = opt.beat && opt.beat.period > 0.25 ? opt.beat : null;
    const shot = beat ? E.beatUnit(beat.period, opt.beats, opt.shotMin, opt.shotMax) : (opt.shot || 3);
    // Si hay ritmo, el primer corte cae en un tiempo fuerte después del inicio de la canción.
    const snap = (len, minLen) => {
      if (!beat) return len;
      const off = beat.offset || 0;
      const k = Math.max(1, Math.round((len - off) / shot));
      return Math.max(minLen || shot, off + k * shot);
    };
    let lens = [], use = [];
    if (opt.mode === 'song') {
      const target = Math.max(15, opt.target || 60);
      const intro = snap(opt.intro || 4), outro = opt.outro || 5;
      const mid = Math.max(shot, target - T - intro - outro);
      const k = Math.max(1, Math.round(mid / shot));
      lens.push(intro); use.push(0);
      for (let j = 0; j < k; j++) { lens.push(beat ? shot : mid / k); use.push(n > 1 ? (1 + j) % n : 0); }
      lens.push(Math.max(2, target - T - intro - (beat ? shot * k : mid))); use.push(n > 1 ? n - 1 : 0);
      lens = lens.map(q);
      const diff = Math.round((target - T) * FPS) - lens.reduce((s, l) => s + Math.round(l * FPS), 0);
      lens[lens.length - 1] = q(lens[lens.length - 1] + diff / FPS);
    } else {
      const count = Math.min(n, opt.maxShots || 15);
      for (let i = 0; i < count; i++) {
        let len = count === 1 ? Math.max(6, opt.intro || 4) : i === 0 ? snap(opt.intro || 4) : i === count - 1 ? (opt.outro || 5) : shot;
        lens.push(len); use.push(i);
      }
      lens = lens.map(q);
    }
    const uses = {}, seen = {};
    use.forEach(m => { uses[m] = (uses[m] || 0) + 1; });
    let zoom = 0;
    const segments = lens.map((len, i) => {
      const m = use[i], md = opt.media[m], k = seen[m] = (seen[m] || 0) + 1, need = len + T;
      let start = md.start || 0;
      const avail = (md.end || md.duration || 0) - start;
      if (md.kind === 'video' && avail > need) start += Math.min(Math.max(0, avail * (k - .5) / uses[m] - need / 2), avail - need);
      return { m, len, start: Math.round(start * 1000) / 1000, zoomIn: md.kind === 'image' ? (zoom++ % 2 === 0) : false };
    });
    const total = q(lens.reduce((s, l) => s + l, 0) + T);
    const list = opt.trans && opt.trans.length ? opt.trans : ['fade'];
    const transitions = segments.slice(1).map((_, i) => list[i % list.length]);
    const cuts = []; let acc = 0;
    lens.slice(0, -1).forEach(l => { acc += l; cuts.push(q(acc)); });
    const lastStart = cuts.length ? cuts[cuts.length - 1] : 0;
    return {
      T, total, segments, transitions, cuts, shot,
      intro: { a: 0, b: q(Math.min(total, lens[0] + T * 0.5)) },
      outro: segments.length > 1 ? { a: q(lastStart + T * 0.6), b: total } : null
    };
  };

  // Una toma de plantilla: encuadre, color del estilo, acercamiento en fotos y su marca de agua.
  E.tplSegmentArgs = (seg, md, o) => {
    const { W, H } = o, L = q(seg.len + (o.T || 0));
    const args = [...BASE];
    let v;
    if (md.kind === 'image') {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(L + 0.2), '-i', md.still);
      const Z = md.zoom != null ? md.zoom : (o.zoom != null ? o.zoom : 0.08);
      if (Z > 0) {
        const N = Math.round(L * FPS), z = seg.zoomIn ? `1+${Z}*on/${N}` : `${1 + Z}-${Z}*on/${N}`;
        v = `[0:v]format=yuv420p,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1,trim=duration=${r3(L)},setpts=PTS-STARTPTS`;
      } else {
        v = `[0:v]scale=${W}:${H},format=yuv420p,setsar=1,trim=duration=${r3(L)},setpts=PTS-STARTPTS`;
      }
    } else {
      args.push(...(o.hwaccel ? ['-hwaccel', 'auto'] : []), '-ss', r3(seg.start || 0), '-t', r3(L + 0.5), '-i', md.path);
      // Giro, acercamiento y color de la toma (los que se pusieron en la película) también en el resumen y el reel.
      const side = md.rot === 90 || md.rot === 270, mw = side ? md.height : md.width, mh = side ? md.width : md.height;
      const pre = `scale='trunc(iw*sar/2)*2':ih,setsar=1,bwdif=mode=send_frame:parity=auto:deint=interlaced,fps=${FPS}${E.clipPre({ rot: md.rot, zoom: md.vzoom })}`;
      const tail = `,format=yuv420p${E.clipColor(md.color)}${o.look || ''},tpad=stop_mode=clone:stop_duration=4,trim=duration=${r3(L)},setpts=PTS-STARTPTS`;
      const srcAr = mw && mh ? mw / mh : W / H, outAr = W / H;
      const differ = Math.abs(Math.log(srcAr / outAr)) > 0.35;
      const blur = o.fit === 'blur' ? differ || srcAr !== outAr : o.fit === 'cover' ? false : differ;
      if (!blur) {
        v = `[0:v]${pre},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1${tail}`;
      } else {
        const w4 = Math.round(W / 8) * 2, h4 = Math.round(H / 8) * 2;
        v = `[0:v]${pre},split=2[a0][b0];` +
          `[a0]scale=${w4}:${h4}:force_original_aspect_ratio=increase,crop=${w4}:${h4},boxblur=8:2,scale=${W}:${H},eq=brightness=-0.07:saturation=0.9[bg];` +
          `[b0]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1${tail}`;
      }
    }
    if (seg.wm) {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(L + 0.2), '-i', seg.wm);
      v += `[pv];[1:v]format=rgba[wm];[pv][wm]overlay=0:0:shortest=1,format=yuv420p[v]`;
    } else v += '[v]';
    args.push('-filter_complex', v, '-map', '[v]', '-an', ...INTERMEDIATE, '-t', r3(L), seg.out);
    return args;
  };

  // Video final de plantilla: unión, capas (fijas, animadas o parpadeantes), efecto final y música.
  E.tplFinalArgs = o => {
    const args = [...BASE];
    o.inputs.forEach(p => args.push('-i', p));
    let idx = o.inputs.length;
    const total = o.total;
    // Las capas fijas que empiezan después del inicio solo se leen durante su ventana (más rápido).
    const layers = (o.layers || []).map(x => {
      const win = !x.seq && !x.blink && x.a > 0.01;
      if (x.seq) args.push('-framerate', String(FPS), '-start_number', '0', '-i', x.path);
      else if (win) args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(Math.max(0.1, x.b - x.a + 0.1)), '-i', x.path);
      else args.push('-loop', '1', '-framerate', String(FPS), '-t', r3(total), '-i', x.path);
      return Object.assign({ idx: idx++, win }, x);
    });
    let au = -1;
    if (o.audio) { args.push('-ss', r3(o.audio.start || 0), '-t', r3(total), '-i', o.audio.path); au = idx++; }
    const j = E.joinFilter(o.lens, o.T, o.transitions);
    let fc = j.fc, cur = 'j';
    if (o.post) { fc += `;[j]${o.post}[pp]`; cur = 'pp'; }
    layers.forEach((x, i) => {
      let f = `[${x.idx}:v]format=rgba`;
      if (x.seq || x.win) f += `,setpts=PTS-STARTPTS+${r3(x.a)}/TB`;
      if (x.fin) f += `,fade=t=in:st=${r3(x.a)}:d=${r3(x.fin)}:alpha=1`;
      if (x.fout) f += `,fade=t=out:st=${r3(Math.max(x.a, x.b - x.fout))}:d=${r3(x.fout)}:alpha=1`;
      const en = x.blink ? `between(t,${r3(x.a)},${r3(x.b)})*lt(mod(t,1),0.55)` : `between(t,${r3(x.a)},${r3(x.b)})`;
      fc += `;${f}[ly${i}];[${cur}][ly${i}]overlay=0:0:eof_action=pass:enable='${en}'[c${i}]`;
      cur = `c${i}`;
    });
    const fadeIn = o.fadeIn == null ? 0.4 : o.fadeIn;
    fc += `;[${cur}]${fadeIn ? `fade=t=in:st=0:d=${r3(fadeIn)},` : ''}fade=t=out:st=${r3(Math.max(0, total - 1))}:d=1,format=yuv420p[vout]`;
    if (au >= 0) fc += `;[${au}:a]${AFMT},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st=${r3(Math.max(0, total - 2.5))}:d=2.5[aout]`;
    args.push('-filter_complex', fc, '-map', '[vout]');
    if (au >= 0) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
    args.push('-t', r3(total), '-r', String(FPS), ...(o.encoderArgs || E.ENCODERS.libx264), '-movflags', '+faststart', o.out);
    return args;
  };

  /* Trabajo completo de plantilla.
   * o: { plan, media, tmp, sep, W, H, look, fit, zoom, hwaccel, wmFor(seg, i) -> ruta|null, layers, post, fadeIn, audio, encoderArgs, out } */
  E.tplJob = o => {
    const p = o.plan, T = p.T, sep = o.sep || '/';
    const J = n => o.tmp + sep + n;
    const steps = [];
    const segOuts = p.segments.map((s, i) => {
      const out = J(`toma_${String(i + 1).padStart(3, '0')}.mp4`);
      const seg = Object.assign({}, s, { out, wm: o.wmFor ? o.wmFor(s, i) : null });
      steps.push({ stage: 'toma', n: i + 1, of: p.segments.length, seconds: s.len + T, weight: s.len + T, media: s.m,
        args: E.tplSegmentArgs(seg, o.media[s.m], Object.assign({}, o, { T })) });
      return out;
    });
    let inputs = segOuts, lens = p.segments.map(s => q(s.len + T)), transitions = p.transitions;
    if (segOuts.length > 12) {
      const bIn = [], bLens = [], bTr = [], groups = Math.ceil(segOuts.length / E.BATCH);
      for (let g = 0; g < groups; g++) {
        const a = g * E.BATCH, b = Math.min(segOuts.length, a + E.BATCH);
        const out = J(`grupo_${String(g + 1).padStart(2, '0')}.mp4`);
        const r = E.batchArgs(segOuts.slice(a, b), lens.slice(a, b), T, transitions.slice(a, b - 1), out);
        steps.push({ stage: 'grupo', n: g + 1, of: groups, seconds: r.len, weight: r.len * .5, args: r.args });
        bIn.push(out); bLens.push(r.len);
        if (b < segOuts.length) bTr.push(transitions[b - 1]);
      }
      inputs = bIn; lens = bLens; transitions = bTr;
    }
    const total = E.joinFilter(lens, T, transitions).len;
    const finalOpts = { inputs, lens, T, transitions, total, layers: o.layers, post: o.post, fadeIn: o.fadeIn, audio: o.audio, encoderArgs: o.encoderArgs, out: o.out };
    steps.push({ stage: 'final', n: 1, of: 1, seconds: total, weight: total * 1.2, final: true, finalOpts, args: E.tplFinalArgs(finalOpts) });
    return { steps, total };
  };

  /* ---------- Ritmo de la canción ----------
   * samples: Float32Array mono; sr: muestras por segundo. Devuelve tiempos de los golpes. */
  E.songDecodeArgs = (path, start, dur, out) => ['-y', '-hide_banner', '-v', 'error', '-ss', r3(start || 0), '-t', r3(dur), '-i', path,
    '-vn', '-ac', '1', '-ar', '11025', '-f', 'f32le', out];
  E.detectBeats = (x, sr) => {
    const hop = Math.max(32, Math.round(sr * 0.0116)), win = hop * 2;
    const n = Math.floor((x.length - win) / hop);
    if (n < 200) return null;
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0; const o0 = i * hop;
      for (let k = 0; k < win; k++) { const v = x[o0 + k]; s += v * v; }
      env[i] = Math.log(1e-9 + s / win);
    }
    const fps = sr / hop, on = new Float32Array(n), w = Math.round(fps * 0.4);
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    // Quita el promedio local para quedarnos con los golpes
    const sm = new Float32Array(n); let acc = 0;
    for (let i = 0; i < n; i++) { acc += on[i]; if (i > w) acc -= on[i - w - 1]; sm[i] = acc / Math.min(i + 1, w + 1); }
    for (let i = 0; i < n; i++) on[i] = Math.max(0, on[i] - sm[i]);
    const minLag = Math.round(fps * 60 / 190), maxLag = Math.round(fps * 60 / 65);
    let best = -1, bestLag = 0;
    const ac = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag + 1; lag++) {
      let s = 0;
      for (let i = 0; i + lag < n; i++) s += on[i] * on[i + lag];
      ac[lag] = s / (n - lag);
    }
    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpm = 60 * fps / lag, wgt = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2));
      const v = ac[lag] * wgt;
      if (v > best) { best = v; bestLag = lag; }
    }
    if (!bestLag) return null;
    const a = ac[bestLag - 1] || 0, b = ac[bestLag], c = ac[bestLag + 1] || 0;
    const den = a - 2 * b + c, frac = den ? 0.5 * (a - c) / den : 0;
    const lagF = bestLag + Math.max(-0.5, Math.min(0.5, frac));
    // Fase: dónde caen los golpes
    let bestP = 0, bestS = -1;
    for (let p = 0; p < bestLag; p++) {
      let s = 0;
      for (let t = p; t < n; t += lagF) { const i = Math.round(t); s += Math.max(on[i] || 0, on[i - 1] || 0, on[i + 1] || 0); }
      if (s > bestS) { bestS = s; bestP = p; }
    }
    // Afinar: busca el golpe real cerca de cada tiempo previsto y ajusta una recta (evita que se vaya desfasando).
    let per = lagF, ph = bestP;
    for (let it = 0; it < 3; it++) {
      let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
      for (let k = 0, t = ph; t < n; k++, t = ph + k * per) {
        const c = Math.round(t), r = Math.max(2, Math.round(per * 0.12));
        let bi = -1, bv = 0;
        for (let i = Math.max(0, c - r); i <= Math.min(n - 1, c + r); i++) if (on[i] > bv) { bv = on[i]; bi = i; }
        if (bi < 0 || bv <= 0) continue;
        sx += k; sy += bi; sxx += k * k; sxy += k * bi; cnt++;
      }
      if (cnt < 8) break;
      const d = cnt * sxx - sx * sx; if (!d) break;
      per = (cnt * sxy - sx * sy) / d; ph = (sy - per * sx) / cnt;
      while (ph < 0) ph += per;
    }
    let zero = 0; for (let i = 0; i < n; i++) zero += on[i] * on[i];
    const lead = hop / sr;   // la ventana de energía detecta el golpe un poco antes
    const beats = [];
    for (let t = ph; t < n; t += per) beats.push(Math.round((t / fps + lead) * 1000) / 1000);
    return { bpm: Math.round(60 * fps / per * 10) / 10, period: per / fps, offset: ph / fps + lead, beats, confidence: zero ? ac[bestLag] / (zero / n) : 0 };
  };

  /* ---------- Mejores momentos (resumen y reel) ----------
   * Revisión por segundo: brillo, cambio entre cuadros clave (movimiento), nitidez y volumen. */
  E.hlArgs = (path, hasAudio) => {
    const a = ['-hide_banner', '-nostats', '-v', 'info', '-skip_frame', 'nokey', '-i', path, '-map', '0:v:0',
      '-vf', 'scale=160:-2,signalstats,blurdetect,metadata=print:key=lavfi.signalstats.YAVG,metadata=print:key=lavfi.signalstats.YDIF,metadata=print:key=lavfi.blur',
      '-f', 'null', '-'];
    if (hasAudio) a.push('-map', '0:a:0', '-af', 'aresample=8000,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level', '-f', 'null', '-');
    return a;
  };
  E.hlParse = text => {
    const cur = {}, v = {}, a = [];
    String(text).split('\n').forEach(line => {
      const m = /\[(Parsed_a?metadata_\d+) @ [^\]]+\]\s*(.*)$/.exec(line);
      if (!m) return;
      const tag = m[1], body = m[2];
      const pt = /pts_time:([\d.]+)/.exec(body);
      if (pt) { cur[tag] = +pt[1]; return; }
      const kv = /^lavfi\.([\w.]+)=(-?[\d.]+|-?inf)/.exec(body);
      if (!kv || cur[tag] == null) return;
      const t = cur[tag], val = kv[2].includes('inf') ? -90 : +kv[2];
      if (kv[1] === 'astats.Overall.RMS_level') a.push([t, val]);
      else {
        const k = Math.round(t * 10) / 10, rec = v[k] = v[k] || { t: k };
        if (kv[1] === 'signalstats.YAVG') rec.y = val;
        else if (kv[1] === 'signalstats.YDIF') rec.d = val;
        else if (kv[1] === 'blur') rec.b = val;
      }
    });
    return { v: Object.values(v).sort((x, y) => x.t - y.t).map(r => [r.t, r.y ?? 0, r.d ?? 0, r.b ?? 0]), a };
  };
  // Puntaje por medio segundo dentro de [ini, fin]: bien iluminado, nítido, con movimiento y con sonido (aplausos, gritos, risas).
  E.hlScores = (hl, ini, fin) => {
    const step = 0.5, out = [];
    if (!hl || !hl.v || !hl.v.length) { for (let t = ini; t < fin; t += step) out.push(0.5); return { step, ini, s: out }; }
    // Muestra más cercana a t. Como t siempre avanza, cada lista guarda dónde se quedó (rápido en videos de horas).
    const at = new Map();
    const near = (arr, t) => {
      let i = at.get(arr) || 0;
      while (i + 1 < arr.length && Math.abs(arr[i + 1][0] - t) <= Math.abs(arr[i][0] - t)) i++;
      at.set(arr, i); return arr[i];
    };
    const ds = hl.v.map(r => r[2]).sort((a, b) => a - b), bs = hl.v.map(r => r[3]).sort((a, b) => a - b);
    const pct = (arr, q2) => arr[Math.min(arr.length - 1, Math.floor(q2 * arr.length))] || 0;
    const d50 = pct(ds, .5), d95 = pct(ds, .95) || 1, b20 = pct(bs, .2), b80 = pct(bs, .8) || 1;
    const as = hl.a.map(r => r[1]).sort((a, b) => a - b), a50 = pct(as, .5), a90 = pct(as, .9);
    for (let t = ini; t < fin; t += step) {
      const r = near(hl.v, t), y = r[1], d = r[2], b = r[3];
      const expo = y < 30 ? 0 : 1 - Math.min(1, Math.abs(y - 120) / 110);
      const sharp = b80 > b20 ? 1 - Math.min(1, Math.max(0, (b - b20) / (b80 - b20))) : 0.6;
      const motion = d > d95 * 1.2 ? 0.2 : Math.min(1, d / Math.max(1, d50 * 2));
      let aud = 0.4;
      if (hl.a.length) { const ar = near(hl.a, t); aud = a90 > a50 ? Math.min(1, Math.max(0, (ar[1] - a50) / (a90 - a50))) : 0.4; }
      let sc = .35 * expo + .25 * sharp + .2 * motion + .2 * aud;
      if (t - ini < 1 || fin - t < 1) sc -= 0.3;   // el arranque y el final de una toma suelen moverse
      out.push(sc);
    }
    return { step, ini, s: out };
  };
  /* moments: [{ id, clips:[{ id, kind, duration, in, out, hl }] }] → elige tomas de largo `shot`
   * repartiendo `target` segundos entre momentos, en orden cronológico. */
  E.pickHighlights = (moments, target, shot) => {
    const live = moments.filter(m => m.clips.length);
    if (!live.length) return [];
    const weight = live.map(m => Math.sqrt(m.clips.reduce((s, c) => s + (c.kind === 'image' ? 4 : (c.out - c.in)), 0) + 1));
    const W = weight.reduce((a, b) => a + b, 0);
    const slots = Math.max(live.length, Math.round(target / shot));
    const alloc = weight.map(w => Math.max(1, Math.round(slots * w / W)));
    const st = live.map(m => {
      const cands = [];
      m.clips.forEach((c, ci) => {
        if (c.kind === 'image') { cands.push({ ci, start: 0, sc: 0.55, img: true }); return; }
        const len = c.out - c.in;
        if (len < shot * 0.8) return;
        const S = E.hlScores(c.hl, c.in, c.out), k = Math.max(1, Math.round(shot / S.step)), cuts = c.cuts || [];
        for (let i = 0; i + k <= S.s.length; i++) {
          const a = c.in + i * S.step;
          if (cuts.some(r => r[0] < a + shot && r[1] > a)) continue;   // lo que se quitó no sale en el resumen
          let s = 0; for (let j = i; j < i + k; j++) s += S.s[j];
          cands.push({ ci, start: a, sc: s / k });
        }
      });
      cands.sort((a, b) => b.sc - a.sc);
      return { m, cands, picks: [], per: {} };
    });
    // Estricto: pocas tomas por archivo y separadas (variedad). Relajado: cuando hay poco material,
    // se toman más pedazos del mismo archivo, sin que se encimen.
    const take = (s, strict) => {
      for (const cd of s.cands) {
        const c = s.m.clips[cd.ci], len = c.out - c.in;
        const maxPer = cd.img ? 1 : strict ? Math.max(1, Math.ceil(len / 18)) : Math.max(1, Math.floor(len / shot));
        if ((s.per[cd.ci] || 0) >= maxPer) continue;
        const gap = strict ? shot + 2 : shot;
        if (s.picks.some(p => p.ci === cd.ci && Math.abs(p.start - cd.start) < gap)) continue;
        s.picks.push(cd); s.per[cd.ci] = (s.per[cd.ci] || 0) + 1;
        return true;
      }
      return false;
    };
    st.forEach((s, i) => { while (s.picks.length < alloc[i] && take(s, true)); });
    st.forEach((s, i) => { while (s.picks.length < alloc[i] && take(s, false)); });
    // Lo que un momento no alcanzó a llenar se reparte entre los que todavía tienen material.
    let short = slots - st.reduce((a, s) => a + s.picks.length, 0);
    const order = st.map((s, i) => i).sort((a, b) => weight[b] - weight[a]);
    while (short > 0) {
      let any = false;
      for (const i of order) if (short > 0 && take(st[i], false)) { short--; any = true; }
      if (!any) break;
    }
    return st.map(s => {
      s.picks.sort((a, b) => a.ci - b.ci || a.start - b.start);
      return { id: s.m.id, picks: s.picks.map(p => ({ clip: s.m.clips[p.ci].id, start: Math.round(p.start * 10) / 10, score: p.sc })) };
    });
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
