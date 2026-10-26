/* Títulos de las plantillas de video. Se dibujan aquí (con las letras del programa) y FFmpeg los pone encima del video. */
(function () {
  'use strict';
  const SA = window.SA;
  const { SCRIPT, CAPS, SERIF } = SA.FONTS;

  const THEMES = {
    blanco: { name: 'Blanco', text: '#FFFFFF', accent: '#F1E3C6', soft: 'rgba(255,255,255,.8)' },
    dorado: { name: 'Dorado', text: '#F8EBCB', accent: '#E2B866', soft: 'rgba(248,235,203,.82)' },
    rosa: { name: 'Rosa', text: '#FFF2F4', accent: '#F0B3C2', soft: 'rgba(255,242,244,.82)' },
    celeste: { name: 'Celeste', text: '#FFFFFF', accent: '#BFE3FF', soft: 'rgba(235,246,255,.85)' }
  };
  const TEMPLATES = {
    std: { name: 'Save the Date', file: 'SaveTheDate' },
    xv: { name: 'Videoclip XV', file: 'XV' }
  };

  /* Sombra de las letras, elegida por el usuario: 'auto' (como viene el diseño), 'soft', 'strong' o 'none'.
   * Se pone solo mientras se dibuja un diseño (SA.withShadow), así no se mezcla entre pestañas. */
  SA.SHADOWS = [['auto', 'Como viene'], ['soft', 'Suave'], ['strong', 'Marcada'], ['none', 'Sin sombra']];
  SA.textShadow = 'auto';
  SA.withShadow = (mode, fn) => { const prev = SA.textShadow; SA.textShadow = mode || 'auto'; try { return fn(); } finally { SA.textShadow = prev; } };
  // Aplica la sombra elegida para letras de tamaño `size`. Devuelve false si se deja la del diseño.
  SA.applyTextShadow = (ctx, size) => {
    const m = SA.textShadow;
    if (m === 'none') { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0; return true; }
    if (m === 'soft') { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = size * .22; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = size * .04; return true; }
    if (m === 'strong') { ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = size * .09; ctx.shadowOffsetX = size * .04; ctx.shadowOffsetY = size * .06; return true; }
    return false;
  };

  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${size}px ${family}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (ls || 0) * size + 'px';
  }
  // Ajusta el tamaño para que el texto quepa en maxW.
  function fit(ctx, text, weight, size, family, ls, maxW) {
    let s = size;
    setFont(ctx, weight, s, family, ls);
    while (ctx.measureText(text).width > maxW && s > 12) { s *= .95; setFont(ctx, weight, s, family, ls); }
    return s;
  }
  function draw(ctx, text, cx, y, weight, size, family, ls, color) {
    setFont(ctx, weight, size, family, ls);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.save(); SA.applyTextShadow(ctx, size);
    ctx.fillText(text, cx + (ls || 0) * size / 2, y);
    ctx.restore();
  }
  function ornament(ctx, cx, y, half, u, color) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, 2 * u);
    ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 16 * u, y); ctx.moveTo(cx + 16 * u, y); ctx.lineTo(cx + half, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, y - 7 * u); ctx.lineTo(cx + 7 * u, y); ctx.lineTo(cx, y + 7 * u); ctx.lineTo(cx - 7 * u, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function dateParts(d) {
    if (!d) return null;
    const month = SA.ui.MONTHS[d.m - 1] || '';
    return { day: String(d.d), month, year: String(d.y), line: `${d.d} · ${month} · ${d.y}` };
  }

  /* Filas apiladas y centradas verticalmente: cada fila dice cuánto ocupa y cómo se dibuja. */
  function stack(ctx, rows, cy) {
    rows = rows.filter(Boolean);
    const total = rows.reduce((s, r) => s + r.h, 0);
    let y = cy - total / 2;
    rows.forEach(r => { r.draw(y + r.h * (r.base == null ? .78 : r.base)); y += r.h; });
  }

  // which: 'intro' | 'outro'. data: {names, place, name, phrase, date:{y,m,d}}
  function renderCard(template, which, W, H, data, themeKey) {
    const th = THEMES[themeKey] || THEMES.blanco;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const u = Math.min(W, H) / 1080, vert = H > W, cx = W / 2, maxW = W * .86;
    const dp = dateParts(data.date);

    // Velo oscuro para que el texto se lea sobre cualquier foto.
    if (which === 'intro') {
      if (vert) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.42, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.68)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(cx, H / 2, H * .1, cx, H / 2, W * .62);
        g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.56)'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(cx, H / 2, Math.min(W, H) * .2, cx, H / 2, Math.max(W, H) * .7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 2 * u;
    ctx.textBaseline = 'alphabetic';

    const row = (h, fn, base) => ({ h: h * u, draw: fn, base });
    const textRow = (text, weight, size, family, ls, color, h, upper) => {
      if (!text) return null;
      const t = upper ? text.toLocaleUpperCase('es') : text;
      const s = fit(ctx, t, weight, size * u, family, ls, maxW);
      return { h: Math.max(h * u * (s / (size * u)), s * 1.05), draw: y => draw(ctx, t, cx, y, weight, s, family, ls, color) };
    };
    const orn = (half, h) => row(h, y => ornament(ctx, cx, y - 6 * u, half * u, u, th.accent), .6);

    if (template === 'std' && which === 'intro') {
      stack(ctx, [
        textRow('Save the Date', 400, 176, SCRIPT, 0, th.text, 200),
        textRow(data.names, 600, 88, SERIF, .02, th.text, 104),
        (data.names && dp) ? orn(90, 40) : null,
        dp && textRow(dp.line, 600, 30, CAPS, .32, th.accent, 50, true)
      ], vert ? H * .76 : H * .5);
    } else if (template === 'std') {
      stack(ctx, [
        textRow('Save the Date', 400, 112, SCRIPT, 0, th.accent, 130),
        dp ? textRow(dp.day, 600, 300, SERIF, 0, th.text, 290) : textRow(data.names, 600, 110, SERIF, .02, th.text, 140),
        dp && orn(230, 34),
        dp && textRow(`${dp.month} ${dp.year}`, 700, 44, CAPS, .34, th.text, 70, true),
        dp && orn(230, 40),
        dp && textRow(data.names, 600, 72, SERIF, .02, th.text, 100),
        textRow(data.place, 600, 27, CAPS, .22, th.soft, 50, true),
        textRow('Invitación formal próximamente', 600, 21, CAPS, .28, th.soft, 54, true)
      ], H * .5);
    } else if (which === 'intro') {
      stack(ctx, [
        textRow('Mis XV', 400, 220, SCRIPT, 0, th.text, 230),
        textRow(data.name, 600, 82, SERIF, .1, th.text, 100, true),
        (data.name && dp) ? orn(90, 40) : null,
        dp && textRow(dp.line, 600, 30, CAPS, .32, th.accent, 50, true)
      ], vert ? H * .76 : H * .5);
    } else {
      const phrase = (data.phrase || 'Gracias por acompañarme').trim();
      stack(ctx, [
        textRow(phrase, 400, 124, SCRIPT, 0, th.text, 150),
        orn(150, 46),
        textRow(data.name, 600, 74, SERIF, .1, th.text, 96, true),
        dp && textRow(dp.line, 600, 30, CAPS, .32, th.accent, 54, true),
        textRow(data.place, 600, 26, CAPS, .22, th.soft, 48, true)
      ], H * .5);
    }
    return c;
  }

  // Vista previa: fondo (foto o cuadro del video) + título + marca de agua, a tamaño chico.
  function preview(canvas, bg, template, which, W, H, data, themeKey) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2A2825'; ctx.fillRect(0, 0, W, H);
    if (bg) {
      const vert = H > W, bgVert = bg.height > bg.width;
      if (vert !== bgVert) {
        ctx.save(); ctx.filter = 'blur(12px) brightness(.85)'; SA.color.drawFit(ctx, bg, W, H, 'cover', 1.1); ctx.restore();
        SA.color.drawFit(ctx, bg, W, H, 'contain');
      } else SA.color.drawFit(ctx, bg, W, H, 'cover');
    }
    ctx.drawImage(renderCard(template, which, W, H, data, themeKey), 0, 0);
    SA.drawWatermark(ctx, W, H, SA.settings, SA.VIDEO_WM_SCALE);
  }

  /* Tarjetas de la Película del evento (fondo negro): portada, capítulo y créditos. */
  function renderFilmCard(kind, W, H, data, themeKey) {
    const th = THEMES[themeKey] || THEMES.dorado;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const u = Math.min(W, H) / 1080, cx = W / 2, maxW = W * .84;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(cx, H / 2, 0, cx, H / 2, Math.max(W, H) * .6);
    g.addColorStop(0, '#1C1A17'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    const textRow = (text, weight, size, family, ls, color, h, upper) => {
      if (!text) return null;
      const t = upper ? text.toLocaleUpperCase('es') : text;
      const s = fit(ctx, t, weight, size * u, family, ls, maxW);
      return { h: Math.max(h * u * (s / (size * u)), s * 1.05), draw: y => draw(ctx, t, cx, y, weight, s, family, ls, color) };
    };
    const orn = (half, h) => ({ h: h * u, base: .6, draw: y => ornament(ctx, cx, y - 6 * u, half * u, u, th.accent) });
    const dp = dateParts(data.date);
    if (kind === 'portada') {
      stack(ctx, [
        textRow('Eduardo Saucedo · Video & Fotografía presenta', 600, 22, CAPS, .3, th.soft, 70, true),
        textRow(data.title, 400, 150, SCRIPT, 0, th.text, 190),
        orn(150, 44),
        dp && textRow(dp.line, 600, 30, CAPS, .32, th.accent, 54, true),
        textRow(data.place, 600, 24, CAPS, .24, th.soft, 46, true)
      ], H * .5);
    } else if (kind === 'capitulo') {
      stack(ctx, [
        data.num ? textRow(`Capítulo ${data.num}`, 600, 24, CAPS, .42, th.accent, 60, true) : null,
        textRow(data.name, 400, 150, SCRIPT, 0, th.text, 180),
        orn(110, 40)
      ], H * .5);
    } else {
      const rows = [textRow('Una producción de', 600, 22, CAPS, .36, th.soft, 70, true)];
      const LOGO = SA.logos && (SA.logos.blanco || SA.logo);
      if (LOGO) {
        const ar = (LOGO.naturalWidth || LOGO.width) / (LOGO.naturalHeight || LOGO.height);
        let lw = Math.min(W * .42, 520 * u * ar), lh = lw / ar;
        if (lh > 260 * u) { lh = 260 * u; lw = lh * ar; }
        rows.push({ h: lh + 30 * u, base: 0, draw: y => ctx.drawImage(LOGO, cx - lw / 2, y + 10 * u, lw, lh) });
      } else {
        rows.push(textRow('Saucedo', 400, 170, SCRIPT, 0, th.text, 190));
        rows.push(textRow('Video y Fotografía', 700, 30, CAPS, .3, th.text, 56, true));
      }
      rows.push(orn(150, 50));
      rows.push(textRow(data.title, 600, 30, SERIF, .04, th.accent, 56));
      rows.push(dp && textRow(dp.line, 600, 22, CAPS, .32, th.soft, 44, true));
      stack(ctx, rows, H * .5);
    }
    return c;
  }

  SA.cards = { THEMES, TEMPLATES, renderCard, preview, renderFilmCard };
})();
