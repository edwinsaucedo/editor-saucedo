/* Textos y gráficos animados de las plantillas.
 * Cada diseño dibuja un cuadro en el tiempo t (segundos desde que aparece la capa).
 * Todo escala con u = lado corto / 1080, así sirve igual en vertical, horizontal y cuadrado. */
(function () {
  'use strict';
  const SA = window.SA;
  const A = SA.anim = {};
  const F = { script: '"SA Script","Brush Script MT",cursive', serif: '"SA Serif",Georgia,serif', caps: '"SA Caps","Arial Narrow",Arial,sans-serif',
    body: '"SA Body",Verdana,sans-serif', vhs: '"SA VHS","Courier New",monospace' };
  A.F = F;

  /* ---------- Movimiento ---------- */
  A.clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  A.prog = (t, a, b) => A.clamp((t - a) / (b - a));
  A.eo = x => 1 - Math.pow(1 - x, 3);
  A.eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  A.back = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  A.rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };

  /* ---------- Texto ---------- */
  A.setFont = (ctx, w, size, fam, ls) => { ctx.font = `${w} ${size}px ${fam}`; if ('letterSpacing' in ctx) ctx.letterSpacing = (ls || 0) * size + 'px'; };
  A.fit = (ctx, text, w, size, fam, ls, maxW) => {
    let s = size; A.setFont(ctx, w, s, fam, ls);
    while (ctx.measureText(text).width > maxW && s > 10) { s *= .95; A.setFont(ctx, w, s, fam, ls); }
    return s;
  };
  // o: { w, s, f, ls, color, align, alpha, shadow, glow, stroke, maxW }
  A.text = (ctx, text, x, y, o) => {
    if (!text) return 0;
    ctx.save();
    const size = o.maxW ? A.fit(ctx, text, o.w || 400, o.s, o.f, o.ls, o.maxW) : (A.setFont(ctx, o.w || 400, o.s, o.f, o.ls), o.s);
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    const dx = (o.align || 'center') === 'center' ? (o.ls || 0) * size / 2 : 0;
    if (o.shadow) { ctx.shadowColor = o.shadowColor || 'rgba(0,0,0,.55)'; ctx.shadowBlur = o.shadow; ctx.shadowOffsetY = o.shadow * .12; }
    if (o.glow) { ctx.shadowColor = o.glow[0]; ctx.shadowBlur = o.glow[1]; for (let i = 0; i < (o.glow[2] || 2); i++) { ctx.fillStyle = o.glow[0]; ctx.fillText(text, x + dx, y); } ctx.shadowBlur = o.glow[1] * .35; }
    if (o.stroke) { ctx.lineWidth = o.stroke[1]; ctx.strokeStyle = o.stroke[0]; ctx.lineJoin = 'round'; ctx.strokeText(text, x + dx, y); }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(text, x + dx, y);
    const w = ctx.measureText(text).width;
    ctx.restore();
    return { size, w };
  };
  A.wrap = (ctx, text, maxW) => {
    const words = String(text).split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  };
  A.typed = (text, t, cps) => String(text).slice(0, Math.max(0, Math.floor(t * (cps || 16))));

  /* ---------- Gráficos ---------- */
  A.scrim = (ctx, W, H, kind, k) => {
    k = k == null ? 1 : k;
    ctx.save();
    if (kind === 'bottom') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.42, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.7 * k})`);
      ctx.fillStyle = g;
    } else if (kind === 'center') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .65);
      g.addColorStop(0, `rgba(0,0,0,${.45 * k})`); g.addColorStop(1, `rgba(0,0,0,${.2 * k})`);
      ctx.fillStyle = g;
    } else ctx.fillStyle = `rgba(0,0,0,${.45 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };
  A.rule = (ctx, cx, y, half, u, color, alpha, diamond) => {
    if (half <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, 2 * u);
    ctx.beginPath();
    if (diamond) { ctx.moveTo(cx - half, y); ctx.lineTo(cx - 16 * u, y); ctx.moveTo(cx + 16 * u, y); ctx.lineTo(cx + half, y); }
    else { ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); }
    ctx.stroke();
    if (diamond) { ctx.beginPath(); ctx.moveTo(cx, y - 7 * u); ctx.lineTo(cx + 7 * u, y); ctx.lineTo(cx, y + 7 * u); ctx.lineTo(cx - 7 * u, y); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  A.roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  // Etiqueta redondeada ("chip"). Devuelve su ancho.
  A.chip = (ctx, x, y, text, u, o) => {
    o = o || {};
    const s = (o.s || 30) * u;
    A.setFont(ctx, o.w || 700, s, o.f || F.caps, o.ls || .04);
    const tw = ctx.measureText(text).width, padX = s * .7, icon = o.pin ? s * .9 : 0, w = tw + padX * 2 + icon, h = s * 1.9;
    ctx.save(); ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = o.bg || 'rgba(255,255,255,.92)'; A.roundRect(ctx, x, y - h / 2, w, h, h / 2); ctx.fill();
    if (o.pin) A.pin(ctx, x + padX + s * .3, y, s * .55, o.color || '#111');
    ctx.fillStyle = o.color || '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX + icon, y + s * .04);
    ctx.restore();
    return w;
  };
  A.pin = (ctx, x, y, r, color) => {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    ctx.arc(x, y - r * .35, r * .62, Math.PI * .85, Math.PI * 2.15); ctx.lineTo(x, y + r * .75); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y - r * .35, r * .24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  A.confetti = (ctx, W, H, t, seed, colors, u) => {
    const r = A.rng(seed || 7), n = 90;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, sp = (160 + r() * 260) * u, ph = r() * H, sw = 20 * u + r() * 40 * u, rot = r() * 6, size = (10 + r() * 14) * u;
      const y = ((ph + t * sp) % (H + 60 * u)) - 30 * u, x = x0 + Math.sin(t * 2 + i) * sw;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot + t * (1 + r() * 3));
      ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = .9;
      if (i % 3) ctx.fillRect(-size / 2, -size / 4, size, size / 2); else { ctx.beginPath(); ctx.arc(0, 0, size / 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  };
  // Neón: el texto parpadea al encender y luego queda brillando.
  A.neonOn = (t, start, seed) => {
    const x = t - start; if (x < 0) return 0;
    if (x > .9) return 1;
    const pattern = [0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1];
    return pattern[Math.min(pattern.length - 1, Math.floor(x / .06 + (seed || 0)) % pattern.length)];
  };
  A.neon = (ctx, text, x, y, size, fam, color, on, u, w) => {
    if (!on) { A.text(ctx, text, x, y, { w: w || 400, s: size, f: fam, color: 'rgba(255,255,255,.08)' }); return; }
    ctx.save();
    A.setFont(ctx, w || 400, size, fam, 0); ctx.textAlign = 'center';
    ctx.shadowColor = color;
    for (const [blur, a] of [[60 * u, .9], [30 * u, .9], [12 * u, 1]]) { ctx.shadowBlur = blur; ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillText(text, x, y); }
    ctx.shadowBlur = 4 * u; ctx.globalAlpha = 1; ctx.fillStyle = '#FFF6FB'; ctx.fillText(text, x, y);
    ctx.restore();
  };
  A.dateLine = (d, style) => {
    if (!d) return '';
    const M = SA.ui.MONTHS, m = M[d.m - 1] || '';
    if (style === 'num') return `${String(d.d).padStart(2, '0')} · ${String(d.m).padStart(2, '0')} · ${d.y}`;
    if (style === 'long') return `${d.d} de ${m} de ${d.y}`;
    if (style === 'vhs') return `${m.slice(0, 3).toUpperCase()}. ${String(d.d).padStart(2, '0')} ${d.y}`;
    if (style === 'my') return `${m} ${d.y}`;
    return `${d.d} · ${m} · ${d.y}`;
  };


  /* ---------- Partículas y adornos de las plantillas nuevas ---------- */
  // Nieve que cae con vaivén (copos de distintos tamaños, los grandes más rápidos y nítidos).
  A.snow = (ctx, W, H, t, seed, u, n) => {
    const r = A.rng(seed || 17), N = n || 140;
    ctx.save(); ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < N; i++) {
      const z = r(), size = (2 + z * 7) * u, sp = (35 + z * 110) * u, x0 = r() * W, ph = r() * (H + 40 * u), sw = (10 + r() * 30) * u, f = .5 + r();
      const y = ((ph + t * sp) % (H + 40 * u)) - 20 * u, x = x0 + Math.sin(t * f + i) * sw;
      ctx.globalAlpha = .45 + z * .5; ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = z > .7 ? 0 : 6 * u;
      ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  // Estrella de cuatro puntas (destellos).
  A.star4 = (ctx, x, y, r, color, alpha) => {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * .22 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.shadowColor = color; ctx.shadowBlur = r * .8; ctx.fill(); ctx.restore();
  };
  // Globos que suben (fiesta infantil).
  A.balloons = (ctx, W, H, t, seed, u, colors, n) => {
    const r = A.rng(seed || 23), N = n || 14;
    for (let i = 0; i < N; i++) {
      const bw = (70 + r() * 60) * u, bh = bw * 1.22, x0 = r() * W, sp = (90 + r() * 120) * u, delay = r() * 2.2, ph = r();
      const y = H + bh - (t - delay) * sp - ph * H * .25;
      if (y < -bh * 2.2 || t < delay) continue;
      const x = x0 + Math.sin(t * 1.3 + i) * 18 * u, col = colors[i % colors.length];
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(x, y + bh / 2);
      ctx.quadraticCurveTo(x + 14 * u * Math.sin(t * 2 + i), y + bh / 2 + 70 * u, x - 6 * u, y + bh / 2 + 150 * u); ctx.stroke();
      const g = ctx.createRadialGradient(x - bw * .18, y - bh * .2, bw * .05, x, y, bw * .65);
      g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(.25, col); g.addColorStop(1, col);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + bh / 2 - 2 * u); ctx.lineTo(x - 9 * u, y + bh / 2 + 12 * u); ctx.lineTo(x + 9 * u, y + bh / 2 + 12 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };
  A.heart = (ctx, x, y, s, color, alpha) => {
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha; ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y + s * .3);
    ctx.bezierCurveTo(x, y, x - s * .5, y, x - s * .5, y + s * .3);
    ctx.bezierCurveTo(x - s * .5, y + s * .6, x, y + s * .75, x, y + s);
    ctx.bezierCurveTo(x, y + s * .75, x + s * .5, y + s * .6, x + s * .5, y + s * .3);
    ctx.bezierCurveTo(x + s * .5, y, x, y, x, y + s * .3);
    ctx.fill(); ctx.restore();
  };
  // Corazones que suben despacio.
  A.hearts = (ctx, W, H, t, seed, u, colors, n) => {
    const r = A.rng(seed || 31), N = n || 22;
    for (let i = 0; i < N; i++) {
      const s = (24 + r() * 46) * u, x0 = r() * W, sp = (40 + r() * 70) * u, ph = r() * H;
      const y = H - ((ph + t * sp) % (H + 100 * u)), x = x0 + Math.sin(t * .9 + i) * 26 * u;
      A.heart(ctx, x, y, s, colors[i % colors.length], .35 + r() * .45);
    }
  };
  // Papel picado: tira de banderitas con figuras recortadas, colgando de un hilo.
  const PICADO = ['#E4007C', '#FF7F00', '#FFD100', '#00A651', '#00AEEF', '#8E24AA'];
  const flagCache = {};
  A.picadoFlag = (w, h, color, variant) => {
    const k = [Math.round(w), Math.round(h), color, variant].join('|'); if (flagCache[k]) return flagCache[k];
    const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
    const x = c.getContext('2d');
    x.fillStyle = color; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, h * .9);
    const teeth = 6; for (let i = teeth; i >= 0; i--) x.lineTo(w * i / teeth, h * (i % 2 ? 1 : .9));
    x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-out';
    const cx = w / 2, cy = h * .5;
    // borde de puntitos
    for (let i = 1; i < 8; i++) { x.beginPath(); x.arc(w * i / 8, h * .08, w * .025, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(w * i / 8, h * .8, w * .022, 0, Math.PI * 2); x.fill(); }
    if (variant % 3 === 0) {          // flor
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; x.beginPath(); x.ellipse(cx + Math.cos(a) * w * .14, cy + Math.sin(a) * w * .14, w * .09, w * .045, a, 0, Math.PI * 2); x.fill(); }
      x.beginPath(); x.arc(cx, cy, w * .06, 0, Math.PI * 2); x.fill();
    } else if (variant % 3 === 1) {   // estrella de rombos
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; x.save(); x.translate(cx + Math.cos(a) * w * .16, cy + Math.sin(a) * w * .16); x.rotate(Math.PI / 4); x.fillRect(-w * .06, -w * .06, w * .12, w * .12); x.restore(); }
      x.beginPath(); x.arc(cx, cy, w * .08, 0, Math.PI * 2); x.fill();
    } else {                          // corazón y gotas
      A.heart(x, cx, cy - w * .14, w * .32, '#000', 1);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.beginPath(); x.arc(cx + Math.cos(a) * w * .3, cy + Math.sin(a) * w * .3, w * .03, 0, Math.PI * 2); x.fill(); }
    }
    for (const fx of [.12, .88]) { x.save(); x.translate(w * fx, h * .45); x.rotate(Math.PI / 4); x.fillRect(-w * .035, -w * .035, w * .07, w * .07); x.restore(); }
    return (flagCache[k] = c);
  };
  A.picado = (ctx, W, H, t, u, y0, sag, n, sway) => {
    const N = n || 7, fw = W / N * .9, fh = fw * 1.25;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3 * u; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const x = W * i / 40, y = y0 + sag * 4 * (i / 40) * (1 - i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    for (let i = 0; i < N; i++) {
      const cx = W * (i + .5) / N, cy = y0 + sag * 4 * ((i + .5) / N) * (1 - (i + .5) / N);
      const flag = A.picadoFlag(fw, fh, PICADO[i % PICADO.length], i);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((sway == null ? 1 : sway) * Math.sin(t * 2.2 + i * .9) * .07);
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 8 * u; ctx.shadowOffsetY = 4 * u;
      ctx.drawImage(flag, -fw / 2, 0); ctx.restore();
    }
    ctx.restore();
    return fh;
  };
  A.PICADO = PICADO;

  /* ---------- Fondos de muestra (galería sin fotos todavía) ---------- */
  A.sampleBg = (W, H, seed) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), r = A.rng(seed || 3);
    const g = x.createLinearGradient(0, 0, W, H);
    const pal = [['#3B2A3F', '#B4654A'], ['#1F3346', '#C98A5A'], ['#40263A', '#E0A06C'], ['#22313A', '#8FA7A0']][(seed || 0) % 4];
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const rr = (8 + r() * 40) * Math.min(W, H) / 400, cx = r() * W, cy = r() * H;
      const gg = x.createRadialGradient(cx, cy, 0, cx, cy, rr); gg.addColorStop(0, `rgba(255,${200 + r() * 55 | 0},${150 + r() * 80 | 0},.55)`); gg.addColorStop(1, 'rgba(255,220,180,0)');
      x.fillStyle = gg; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    return c;
  };
})();
