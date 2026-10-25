/* Plantillas de video: diseños de texto (animados o fijos) y la receta de cada plantilla. */
(function () {
  'use strict';
  const SA = window.SA, A = SA.anim, F = A.F;
  const { prog, eo, back, clamp } = A;
  const U = (W, H) => Math.min(W, H) / 1080;
  const cyIn = (W, H) => H > W * 1.2 ? H * .73 : H > W * .9 ? H * .64 : H * .52;
  const vert = (W, H) => H > W * 1.2;
  const up = (u, p, dist) => (1 - eo(p)) * (dist || 40) * u;
  const dl = A.dateLine;

  /* ======================= DISEÑOS ======================= */
  const D = {};

  // Clásicos (los de la versión anterior), fijos: el fundido lo pone FFmpeg.
  D.clasicoIn = { static: true, draw: (ctx, W, H, t, dur, d, th) => ctx.drawImage(SA.cards.renderCard('std', 'intro', W, H, { names: d.title, date: d.date, place: d.place }, th.key), 0, 0) };
  D.clasicoOut = { static: true, draw: (ctx, W, H, t, dur, d, th) => ctx.drawImage(SA.cards.renderCard('std', 'outro', W, H, { names: d.title, date: d.date, place: d.place }, th.key), 0, 0) };
  D.xvIn = { static: true, draw: (ctx, W, H, t, dur, d, th) => ctx.drawImage(SA.cards.renderCard('xv', 'intro', W, H, { name: d.title, date: d.date }, th.key), 0, 0) };
  D.xvOut = { static: true, draw: (ctx, W, H, t, dur, d, th) => ctx.drawImage(SA.cards.renderCard('xv', 'outro', W, H, { name: d.title, date: d.date, phrase: d.subtitle, place: d.place }, th.key), 0, 0) };

  // Cine: nombres que se acomodan (el espacio entre letras se cierra) y barras de cine.
  D.cineIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', .55 * prog(t, 0, .6));
    const p1 = prog(t, .2, 1), p2 = prog(t, .3, 2.6), p3 = prog(t, 1.4, 2.2);
    A.text(ctx, (d.subtitle || 'Una historia de').toUpperCase(), W / 2, cy - 90 * u + up(u, p1, 20), { w: 600, s: 26 * u, f: F.caps, ls: .5, color: th.soft, alpha: p1, maxW: W * .8 });
    A.text(ctx, d.title, W / 2, cy + 20 * u, { w: 600, s: 104 * u, f: F.serif, ls: .45 - .37 * eo(p2), color: th.text, alpha: prog(t, .3, 1.4), shadow: 20 * u, maxW: W * .88 });
    A.text(ctx, dl(d.date).toUpperCase(), W / 2, cy + 100 * u, { w: 600, s: 26 * u, f: F.caps, ls: .42, color: th.accent, alpha: p3 });
  } };
  D.cineOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.1 * prog(t, 0, .8));
    A.text(ctx, 'PRÓXIMAMENTE', W / 2, cy - 120 * u, { w: 600, s: 24 * u, f: F.caps, ls: .6, color: th.soft, alpha: prog(t, .3, 1) });
    A.text(ctx, dl(d.date, 'num'), W / 2, cy + 10 * u, { w: 600, s: 110 * u, f: F.serif, ls: .08 + .2 * (1 - eo(prog(t, .5, 2.2))), color: th.text, alpha: prog(t, .5, 1.4), maxW: W * .9 });
    A.text(ctx, d.title, W / 2, cy + 90 * u, { w: 600, s: 50 * u, f: F.serif, ls: .06, color: th.accent, alpha: prog(t, 1.1, 1.8), maxW: W * .85 });
    A.text(ctx, (d.place || '').toUpperCase(), W / 2, cy + 150 * u, { w: 600, s: 22 * u, f: F.caps, ls: .3, color: th.soft, alpha: prog(t, 1.5, 2.2), maxW: W * .85 });
  } };
  D.letterbox = { static: true, draw: (ctx, W, H) => {
    const bar = W > H ? Math.max(0, (H - W / 2.39) / 2) : H * (H > W ? .085 : .07);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  } };

  // Neón: el letrero parpadea al encender.
  D.neonIn = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), cy = cyIn(W, H);
    A.scrim(ctx, W, H, 'full', 1.15 * prog(t, 0, .4));
    A.neon(ctx, d.subtitle || 'Mis XV', W / 2, cy - 40 * u, Math.min(210 * u, W * .2), F.script, '#FF3FA4', A.neonOn(t, .15, 0), u);
    A.neon(ctx, (d.title || '').toUpperCase(), W / 2, cy + 70 * u, Math.min(72 * u, W * .9 / Math.max(4, (d.title || '').length) * 1.5), F.caps, '#38E1FF', A.neonOn(t, .9, 3), u, 700);
    A.text(ctx, dl(d.date).toUpperCase(), W / 2, cy + 135 * u, { w: 600, s: 24 * u, f: F.caps, ls: .4, color: '#FFFFFF', alpha: .85 * prog(t, 1.7, 2.3) });
  } };
  D.neonOut = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.5 * prog(t, 0, .5));
    A.neon(ctx, d.phrase || 'Gracias', W / 2, cy - 30 * u, Math.min(170 * u, W * .17), F.script, '#FF3FA4', A.neonOn(t, .2, 1), u);
    A.neon(ctx, (d.title || '').toUpperCase(), W / 2, cy + 80 * u, 60 * u, F.caps, '#38E1FF', A.neonOn(t, .8, 5), u, 700);
  } };

  // Boda elegante: los nombres se escriben de izquierda a derecha.
  D.eleganteIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H);
    A.scrim(ctx, W, H, vert(W, H) ? 'bottom' : 'center', prog(t, 0, .8));
    A.text(ctx, (d.subtitle || 'Nuestra boda').toUpperCase(), W / 2, cy - 110 * u, { w: 600, s: 24 * u, f: F.caps, ls: .5, color: th.soft, alpha: prog(t, .2, 1) });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * eo(prog(t, .4, 2.2)) * 1.05, H); ctx.clip();
    A.text(ctx, d.title, W / 2, cy + 10 * u, { s: 150 * u, f: F.script, color: th.text, shadow: 18 * u, maxW: W * .86 });
    ctx.restore();
    A.rule(ctx, W / 2, cy + 60 * u, 170 * u * eo(prog(t, 1.4, 2.4)), u, th.accent, 1, true);
    A.text(ctx, dl(d.date).toUpperCase(), W / 2, cy + 115 * u, { w: 600, s: 26 * u, f: F.caps, ls: .4, color: th.accent, alpha: prog(t, 2, 2.6) });
  } };
  D.eleganteOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .8));
    A.text(ctx, d.phrase || 'Los esperamos', W / 2, cy - 70 * u + up(u, prog(t, .3, 1.3)), { s: 120 * u, f: F.script, color: th.text, alpha: prog(t, .3, 1.3), maxW: W * .86 });
    A.rule(ctx, W / 2, cy - 10 * u, 150 * u * eo(prog(t, .9, 1.8)), u, th.accent, 1, true);
    A.text(ctx, dl(d.date, 'long'), W / 2, cy + 60 * u, { w: 600, s: 58 * u, f: F.serif, color: th.text, alpha: prog(t, 1.1, 1.9), maxW: W * .88 });
    A.text(ctx, (d.place || '').toUpperCase(), W / 2, cy + 120 * u, { w: 600, s: 24 * u, f: F.caps, ls: .3, color: th.soft, alpha: prog(t, 1.5, 2.2), maxW: W * .86 });
  } };

  // Cuenta regresiva: el número rebota al entrar.
  D.cuentaIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5, n = String(d.extra || '30').trim(), s = back(prog(t, .1, .75));
    A.scrim(ctx, W, H, 'full', 1.1 * prog(t, 0, .4));
    ctx.save(); ctx.translate(W / 2, cy - 30 * u); ctx.scale(s, s);
    A.text(ctx, n, 0, 0, { w: 800, s: 400 * u, f: F.caps, color: th.text, shadow: 30 * u, alpha: prog(t, .1, .35) });
    ctx.restore();
    A.text(ctx, Number(n) === 1 ? 'DÍA PARA' : 'DÍAS PARA', W / 2, cy + 70 * u + up(u, prog(t, .6, 1.2)), { w: 700, s: 44 * u, f: F.caps, ls: .3, color: th.accent, alpha: prog(t, .6, 1.2) });
    A.text(ctx, d.title, W / 2, cy + 175 * u, { s: 110 * u, f: F.script, color: th.text, alpha: prog(t, 1.1, 1.8), shadow: 16 * u, maxW: W * .88 });
  } };
  D.cuentaOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .6));
    A.text(ctx, '¡NOS VEMOS EL', W / 2, cy - 110 * u, { w: 700, s: 40 * u, f: F.caps, ls: .25, color: th.soft, alpha: prog(t, .2, .8) });
    const s = back(prog(t, .5, 1.1));
    ctx.save(); ctx.translate(W / 2, cy + 20 * u); ctx.scale(s, s);
    A.text(ctx, dl(d.date, 'num'), 0, 0, { w: 800, s: 120 * u, f: F.caps, color: th.text, shadow: 24 * u, maxW: W * .9, alpha: prog(t, .5, .7) });
    ctx.restore();
    A.text(ctx, (d.place || '').toUpperCase(), W / 2, cy + 100 * u, { w: 600, s: 26 * u, f: F.caps, ls: .3, color: th.accent, alpha: prog(t, 1.2, 1.8), maxW: W * .86 });
  } };

  // Agradecimiento: máquina de escribir.
  const typeBlock = (ctx, W, H, t, text, u, th, cy, size, cps) => {
    A.setFont(ctx, 600, size, F.serif, .01);
    const lines = A.wrap(ctx, text, W * .8), lh = size * 1.2, n = Math.floor(t * cps), y0 = cy - (lines.length - 1) * lh / 2;
    let used = 0;
    lines.forEach((line, i) => {
      const startAt = used, show = line.slice(0, Math.max(0, Math.min(line.length, n - startAt)));
      used += line.length + 1;
      A.setFont(ctx, 600, size, F.serif, .01);
      const x0 = W / 2 - ctx.measureText(line).width / 2;
      if (show) A.text(ctx, show, x0, y0 + i * lh, { w: 600, s: size, f: F.serif, ls: .01, color: th.text, align: 'left', shadow: 14 * u });
      if (n >= startAt && n < used && Math.floor(t * 2.5) % 2 === 0) {
        A.setFont(ctx, 600, size, F.serif, .01);
        A.text(ctx, '|', x0 + ctx.measureText(show).width + 4 * u, y0 + i * lh, { w: 400, s: size, f: F.serif, color: th.accent, align: 'left' });
      }
    });
  };
  D.graciasIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H) - 30 * u, text = d.subtitle || 'Gracias por acompañarnos en este día';
    A.scrim(ctx, W, H, 'full', 1.1 * prog(t, 0, .5));
    typeBlock(ctx, W, H, Math.max(0, t - .3), text, u, th, cy, 74 * u, 20);
    const p = prog(t, .3 + text.length / 20, .9 + text.length / 20);
    A.text(ctx, d.title, W / 2, cy + 150 * u, { s: 100 * u, f: F.script, color: th.accent, alpha: p, maxW: W * .85, shadow: 14 * u });
  } };
  D.graciasOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.3 * prog(t, 0, .6));
    A.text(ctx, d.title, W / 2, cy, { s: 130 * u, f: F.script, color: th.text, alpha: prog(t, .2, 1), maxW: W * .86, shadow: 16 * u });
    A.text(ctx, A.typed(dl(d.date).toUpperCase(), Math.max(0, t - .9), 18), W / 2, cy + 80 * u, { w: 600, s: 26 * u, f: F.caps, ls: .4, color: th.accent });
  } };

  // Bautizo / primera comunión: entrada suave hacia arriba, colores claros.
  D.bautizoIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H), p = prog(t, .2, 1.4), p2 = prog(t, .8, 1.9);
    A.scrim(ctx, W, H, vert(W, H) ? 'bottom' : 'center', prog(t, 0, .8));
    A.text(ctx, d.subtitle || 'Mi bautizo', W / 2, cy - 30 * u + up(u, p), { s: 160 * u, f: F.script, color: th.text, alpha: p, shadow: 18 * u, maxW: W * .88 });
    A.text(ctx, (d.title || '').toUpperCase(), W / 2, cy + 60 * u + up(u, p2), { w: 600, s: 64 * u, f: F.serif, ls: .14, color: th.text, alpha: p2, maxW: W * .86 });
    A.rule(ctx, W / 2, cy + 100 * u, 120 * u * eo(prog(t, 1.4, 2.2)), u, th.accent, 1, true);
    A.text(ctx, dl(d.date).toUpperCase(), W / 2, cy + 150 * u, { w: 600, s: 24 * u, f: F.caps, ls: .4, color: th.accent, alpha: prog(t, 1.8, 2.4) });
  } };
  D.bautizoOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.1 * prog(t, 0, .7));
    A.text(ctx, d.phrase || 'Gracias por acompañarme', W / 2, cy - 30 * u + up(u, prog(t, .3, 1.3)), { s: 110 * u, f: F.script, color: th.text, alpha: prog(t, .3, 1.3), maxW: W * .86 });
    A.text(ctx, (d.title || '').toUpperCase(), W / 2, cy + 60 * u, { w: 600, s: 52 * u, f: F.serif, ls: .14, color: th.accent, alpha: prog(t, 1, 1.8), maxW: W * .86 });
  } };

  // Cumpleaños: confeti y texto que rebota.
  const CONF = ['#FFD166', '#EF476F', '#06D6A0', '#4CC9F0', '#FFFFFF', '#F78C6B'];
  D.cumpleIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H) - 20 * u;
    A.scrim(ctx, W, H, 'full', .9 * prog(t, 0, .4));
    A.confetti(ctx, W, H, t, 11, CONF, u);
    const s1 = back(prog(t, .2, .7)), s2 = back(prog(t, .7, 1.25));
    ctx.save(); ctx.translate(W / 2, cy - 60 * u); ctx.scale(s1, s1);
    A.text(ctx, (d.subtitle || '¡Feliz cumpleaños!').toUpperCase(), 0, 0, { w: 800, s: 76 * u, f: F.caps, ls: .02, color: '#FFFFFF', shadow: 24 * u, maxW: W * .9, alpha: prog(t, .2, .35) });
    ctx.restore();
    ctx.save(); ctx.translate(W / 2, cy + 80 * u); ctx.scale(s2, s2);
    A.text(ctx, d.title, 0, 0, { s: 170 * u, f: F.script, color: th.accent, shadow: 22 * u, maxW: W * .9, alpha: prog(t, .7, .85) });
    ctx.restore();
  } };
  D.cumpleOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .5));
    A.confetti(ctx, W, H, t + 3, 21, CONF, u);
    const s = back(prog(t, .3, .9));
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(s, s);
    A.text(ctx, d.phrase || 'Gracias por celebrar conmigo', 0, 0, { s: 110 * u, f: F.script, color: '#FFFFFF', shadow: 20 * u, maxW: W * .88, alpha: prog(t, .3, .45) });
    ctx.restore();
    A.text(ctx, (d.title || '').toUpperCase(), W / 2, cy + 90 * u, { w: 800, s: 50 * u, f: F.caps, ls: .12, color: th.accent, alpha: prog(t, 1, 1.5), maxW: W * .86 });
  } };

  // Graduación: año grande en dorado y línea que se extiende.
  D.gradIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5, year = String(d.extra || (d.date && d.date.y) || '').trim();
    A.scrim(ctx, W, H, 'full', 1.1 * prog(t, 0, .5));
    A.text(ctx, 'GENERACIÓN', W / 2, cy - 140 * u + up(u, prog(t, .2, .9)), { w: 700, s: 48 * u, f: F.caps, ls: .45, color: th.text, alpha: prog(t, .2, .9) });
    const s = .7 + .3 * eo(prog(t, .5, 1.3));
    ctx.save(); ctx.translate(W / 2, cy + 60 * u); ctx.scale(s, s);
    A.text(ctx, year, 0, 0, { w: 800, s: 250 * u, f: F.caps, color: th.accent, shadow: 24 * u, alpha: prog(t, .5, 1) });
    ctx.restore();
    A.rule(ctx, W / 2, cy + 110 * u, 260 * u * eo(prog(t, 1.1, 1.9)), u, th.accent, 1);
    A.text(ctx, d.title, W / 2, cy + 180 * u, { w: 600, s: 60 * u, f: F.serif, color: th.text, alpha: prog(t, 1.5, 2.2), maxW: W * .88 });
    A.text(ctx, (d.subtitle || '').toUpperCase(), W / 2, cy + 235 * u, { w: 600, s: 24 * u, f: F.caps, ls: .3, color: th.soft, alpha: prog(t, 1.8, 2.4), maxW: W * .88 });
  } };
  D.gradOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5, s = back(prog(t, .2, .8));
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .5));
    ctx.save(); ctx.translate(W / 2, cy - 20 * u); ctx.scale(s, s);
    A.text(ctx, d.phrase || '¡LO LOGRAMOS!', 0, 0, { w: 800, s: 120 * u, f: F.caps, color: th.text, shadow: 24 * u, maxW: W * .9, alpha: prog(t, .2, .35) });
    ctx.restore();
    A.text(ctx, d.title, W / 2, cy + 80 * u, { w: 600, s: 56 * u, f: F.serif, color: th.accent, alpha: prog(t, .9, 1.5), maxW: W * .86 });
  } };

  // Vlog: título en minúsculas palabra por palabra y etiquetas que entran de lado.
  const wordsPop = (ctx, W, H, t, text, u, x, y, size, maxW, color, delay) => {
    A.setFont(ctx, 800, size, F.caps, -.01);
    const lines = A.wrap(ctx, text, maxW), lh = size * 1.02;
    let k = 0;
    lines.forEach((line, li) => {
      let cx = x;
      line.split(' ').forEach(w => {
        const p = prog(t, delay + k * .12, delay + k * .12 + .35), s = .6 + .4 * back(p);
        A.setFont(ctx, 800, size, F.caps, -.01);
        const ww = ctx.measureText(w + ' ').width;
        ctx.save(); ctx.translate(cx + ww / 2, y + li * lh - size * .3); ctx.scale(s, s);
        A.text(ctx, w, -ww / 2, size * .3, { w: 800, s: size, f: F.caps, ls: -.01, color, align: 'left', alpha: clamp(p * 3), shadow: 16 * u });
        ctx.restore();
        cx += ww; k++;
      });
    });
    return lines.length * lh;
  };
  D.vlogIn = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), x = 70 * u, size = Math.min(130 * u, W * .12);
    const g = ctx.createLinearGradient(0, H * .45, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.6 * prog(t, 0, .5)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    A.setFont(ctx, 800, size, F.caps, -.01);
    const lines = A.wrap(ctx, (d.title || 'mi vlog').toLowerCase(), W - x * 2).length;
    const top = H - 150 * u - lines * size * 1.02;
    wordsPop(ctx, W, H, t, (d.title || 'mi vlog').toLowerCase(), u, x, top, size, W - x * 2, '#FFFFFF', .2);
    let cx = x;
    const p1 = eo(prog(t, .9, 1.4)), p2 = eo(prog(t, 1.1, 1.6));
    if (d.date) cx += A.chip(ctx, x - (1 - p1) * 300 * u, H - 95 * u, dl(d.date).toUpperCase(), u, { s: 26, alpha: p1 }) + 14 * u;
    if (d.place) A.chip(ctx, cx - (1 - p2) * 300 * u, H - 95 * u, d.place.toUpperCase(), u, { s: 26, alpha: p2, pin: true });
  } };
  D.vlogOut = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H);
    A.scrim(ctx, W, H, 'full', .9 * prog(t, 0, .5));
    const size = Math.min(120 * u, W * .11);
    wordsPop(ctx, W, H, t, d.phrase || 'gracias por ver', u, 70 * u, H * .5, size, W - 140 * u, '#FFFFFF', .15);
    if (d.extra) A.chip(ctx, 70 * u, H * .5 + size * 1.3, d.extra, u, { s: 30, alpha: prog(t, .8, 1.3), bg: '#FFFFFF' });
  } };
  D.recDot = { static: true, draw: (ctx, W, H) => {
    const u = U(W, H), x = W - 70 * u, y = 80 * u;
    A.setFont(ctx, 700, 30 * u, F.caps, .1); const tw = ctx.measureText('REC').width;
    ctx.fillStyle = '#FF3B30'; ctx.beginPath(); ctx.arc(x - tw - 26 * u, y - 11 * u, 12 * u, 0, Math.PI * 2); ctx.fill();
    A.text(ctx, 'REC', x, y, { w: 700, s: 30 * u, f: F.caps, ls: .1, color: '#FFFFFF', align: 'right', shadow: 8 * u });
  } };

  // Retro VHS
  D.vhsHud = { static: true, draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), m = 60 * u;
    ctx.save(); ctx.globalAlpha = .07; ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 4 * u) ctx.fillRect(0, y, W, 1.5 * u);
    ctx.restore();
    A.text(ctx, 'PLAY ▶', m, m + 40 * u, { s: 56 * u, f: F.vhs, color: '#FFFFFF', align: 'left', shadow: 6 * u, shadowColor: 'rgba(0,0,0,.6)' });
    A.text(ctx, dl(d.date, 'vhs') || 'SP', m, H - m, { s: 56 * u, f: F.vhs, color: '#FFFFFF', align: 'left', shadow: 6 * u, shadowColor: 'rgba(0,0,0,.6)' });
    A.text(ctx, 'SP', W - m, m + 40 * u, { s: 56 * u, f: F.vhs, color: '#FFFFFF', align: 'right', shadow: 6 * u, shadowColor: 'rgba(0,0,0,.6)' });
  } };
  D.vhsIn = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), cy = H * .5, txt = A.typed((d.title || '').toUpperCase(), Math.max(0, t - .3), 14), size = Math.min(150 * u, W * .9 / Math.max(6, (d.title || '').length) * 1.7);
    A.scrim(ctx, W, H, 'full', .6 * prog(t, 0, .3));
    const j = (Math.floor(t * 12) % 3 - 1) * 3 * u;
    A.text(ctx, txt, W / 2 - 6 * u + j, cy, { s: size, f: F.vhs, color: 'rgba(255,40,80,.75)' });
    A.text(ctx, txt, W / 2 + 6 * u, cy, { s: size, f: F.vhs, color: 'rgba(40,220,255,.75)' });
    A.text(ctx, txt, W / 2, cy, { s: size, f: F.vhs, color: '#FFFFFF' });
    A.text(ctx, (d.subtitle || '').toUpperCase(), W / 2, cy + 90 * u, { s: 54 * u, f: F.vhs, color: '#FFFFFF', alpha: prog(t, 1.4, 1.6), maxW: W * .9 });
  } };
  D.vhsOut = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.3 * prog(t, 0, .4));
    A.text(ctx, 'STOP ■', W / 2, cy - 40 * u, { s: 110 * u, f: F.vhs, color: '#FFFFFF', alpha: Math.floor(t * 2) % 2 || t > 2 ? 1 : .2 });
    A.text(ctx, (d.title || '').toUpperCase(), W / 2, cy + 60 * u, { s: 60 * u, f: F.vhs, color: '#FFFFFF', alpha: prog(t, .6, .8), maxW: W * .9 });
  } };

  // Nostalgia 35 mm: fecha a máquina y destellos de luz en los cortes.
  D.filmIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H);
    A.scrim(ctx, W, H, vert(W, H) ? 'bottom' : 'center', prog(t, 0, .8));
    A.text(ctx, A.typed(dl(d.date, 'long'), Math.max(0, t - .2), 16), W / 2, cy - 80 * u, { s: 44 * u, f: F.vhs, color: th.accent, shadow: 8 * u });
    A.text(ctx, d.title, W / 2, cy + 30 * u, { w: 600, s: 110 * u, f: F.serif, ls: .1 + .25 * (1 - eo(prog(t, .8, 2.6))), color: th.text, alpha: prog(t, .8, 1.8), shadow: 18 * u, maxW: W * .88 });
    A.text(ctx, d.subtitle, W / 2, cy + 100 * u, { s: 70 * u, f: F.script, color: th.soft, alpha: prog(t, 1.6, 2.4), maxW: W * .85 });
  } };
  D.filmOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .8));
    A.text(ctx, d.title, W / 2, cy - 10 * u, { w: 600, s: 90 * u, f: F.serif, ls: .08, color: th.text, alpha: prog(t, .3, 1.2), maxW: W * .86 });
    A.text(ctx, A.typed('fin.', Math.max(0, t - 1.2), 6), W / 2, cy + 80 * u, { s: 56 * u, f: F.vhs, color: th.accent });
  } };
  D.leak = { draw: (ctx, W, H, t, dur) => {
    const p = t / dur, a = Math.sin(Math.PI * clamp(p)) * .42, x = W * (-.2 + 1.4 * p);
    ctx.save(); ctx.globalAlpha = a;
    for (const [dx, col, r] of [[0, '255,150,60', .5], [W * .25, '255,80,90', .35], [-W * .2, '255,220,140', .32]]) {
      const R = Math.max(W, H) * r, g = ctx.createRadialGradient(x + dx, H * .4, 0, x + dx, H * .4, R);
      g.addColorStop(0, `rgba(${col},.85)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  } };

  // Impacto: cada palabra golpea la pantalla.
  const slam = (ctx, W, H, t, words, u, base, gap) => {
    const sizes = words.map(w => Math.min(260 * u, W * .92 / Math.max(2, w.length) * 1.55));
    const total = sizes.reduce((s, x) => s + x * .95, 0);
    let y = H / 2 - total / 2 + sizes[0] * .8;
    words.forEach((w, i) => {
      const t0 = base + i * gap, p = prog(t, t0, t0 + .22);
      if (p > 0) {
        const s = 1 + 1.1 * (1 - eo(p)), r = A.rng(i + 5), rot = (r() - .5) * .06 * (1 - p);
        ctx.save(); ctx.translate(W / 2, y - sizes[i] * .35); ctx.rotate(rot); ctx.scale(s, s);
        A.text(ctx, w, 0, sizes[i] * .35, { w: 800, s: sizes[i], f: F.caps, ls: -.02, color: '#FFFFFF', alpha: clamp(p * 2.5), shadow: 26 * u, shadowColor: 'rgba(0,0,0,.7)' });
        ctx.restore();
        const fl = 1 - prog(t, t0 + .2, t0 + .32);
        if (fl > 0 && p >= 1) { ctx.save(); ctx.globalAlpha = .35 * fl; ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      }
      y += sizes[i] * .95;
    });
  };
  D.impactoIn = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H); A.scrim(ctx, W, H, 'full', .7);
    slam(ctx, W, H, t, (d.title || 'LA MEJOR NOCHE').toUpperCase().split(/\s+/).slice(0, 5), u, .15, .3);
  } };
  D.impactoOut = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H); A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .3));
    const words = (d.subtitle || d.title || '').toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
    if (d.date) words.push(dl(d.date, 'num'));
    slam(ctx, W, H, t, words, u, .1, .28);
  } };

  // Portada de revista
  D.revistaIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), m = 60 * u, p1 = prog(t, 0, .8);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(0,0,0,${.45 * p1})`); g.addColorStop(.35, 'rgba(0,0,0,0)'); g.addColorStop(.7, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.55 * p1})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const mast = (d.title || 'SOFÍA').toUpperCase();
    const ms = A.fit(ctx, mast, 600, 300 * u, F.serif, -.02, W - m * 2);
    A.text(ctx, mast, W / 2, m + ms * .78 - (1 - eo(p1)) * 60 * u, { w: 600, s: ms, f: F.serif, ls: -.02, color: '#FFFFFF', alpha: p1, shadow: 18 * u });
    const issue = ['EDICIÓN ESPECIAL', d.date ? dl(d.date, 'my').toUpperCase() : '', d.place ? d.place.toUpperCase() : ''].filter(Boolean).join('  ·  ');
    A.text(ctx, issue, W / 2, m + ms * .78 + 44 * u, { w: 700, s: 20 * u, f: F.caps, ls: .3, color: '#FFFFFF', alpha: prog(t, .5, 1.1), maxW: W - m * 2 });
    const by = H - m - 40 * u;
    A.text(ctx, d.subtitle || 'Mis XV años', m, by - 120 * u + up(u, prog(t, .8, 1.5)), { s: 110 * u, f: F.script, color: th.accent, align: 'left', alpha: prog(t, .8, 1.5), shadow: 14 * u, maxW: W * .7 });
    A.text(ctx, (d.extra || 'UNA NOCHE PARA RECORDAR').toUpperCase(), m, by - 40 * u, { w: 800, s: 34 * u, f: F.caps, ls: .06, color: '#FFFFFF', align: 'left', alpha: prog(t, 1.1, 1.7), maxW: W * .62 });
    A.text(ctx, 'FOTOS EXCLUSIVAS', m, by, { w: 600, s: 22 * u, f: F.caps, ls: .3, color: '#FFFFFF', align: 'left', alpha: prog(t, 1.3, 1.9) });
    const r = A.rng(9), bx = W - m - 150 * u, bh = 80 * u, pa = prog(t, 1.4, 2);
    ctx.save(); ctx.globalAlpha = pa; ctx.fillStyle = '#FFF'; ctx.fillRect(bx - 10 * u, by - bh - 10 * u, 170 * u, bh + 40 * u);
    ctx.fillStyle = '#111'; let xx = bx;
    while (xx < bx + 150 * u) { const w = (1 + Math.floor(r() * 3)) * 2 * u; ctx.fillRect(xx, by - bh, w, bh); xx += w + (1 + Math.floor(r() * 3)) * 2 * u; }
    ctx.restore();
  } };
  D.revistaOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.3 * prog(t, 0, .6));
    A.text(ctx, (d.title || '').toUpperCase(), W / 2, cy - 20 * u, { w: 600, s: 130 * u, f: F.serif, ls: -.01, color: '#FFFFFF', alpha: prog(t, .2, 1), maxW: W * .9 });
    A.text(ctx, 'FIN DE LA EDICIÓN', W / 2, cy + 60 * u, { w: 700, s: 24 * u, f: F.caps, ls: .45, color: th.accent, alpha: prog(t, .8, 1.4) });
  } };

  // Polaroid: tarjeta final sobre papel.
  D.polaroidOut = { draw: (ctx, W, H, t, dur, d) => {
    const u = U(W, H), cy = H * .5;
    ctx.save(); ctx.globalAlpha = prog(t, 0, .8); ctx.drawImage(SA.tpl.paper(W, H), 0, 0); ctx.restore();
    const ink = '#2B2620';
    A.text(ctx, d.phrase || 'Gracias', W / 2, cy - 20 * u, { s: 150 * u, f: F.script, color: ink, alpha: prog(t, .4, 1.3), maxW: W * .86 });
    A.text(ctx, d.title, W / 2, cy + 70 * u, { s: 70 * u, f: F.script, color: '#6B5B4A', alpha: prog(t, 1, 1.8), maxW: W * .86 });
    A.text(ctx, dl(d.date).toUpperCase(), W / 2, cy + 130 * u, { w: 600, s: 22 * u, f: F.caps, ls: .4, color: '#6B5B4A', alpha: prog(t, 1.4, 2) });
  } };

  // Minimal
  D.minimalIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H) + 20 * u;
    A.scrim(ctx, W, H, vert(W, H) ? 'bottom' : 'center', .7 * prog(t, 0, .8));
    A.text(ctx, (d.title || '').toLowerCase(), W / 2, cy, { w: 600, s: 64 * u, f: F.serif, ls: .04, color: th.text, alpha: prog(t, .3, 1.3), maxW: W * .86 });
    A.rule(ctx, W / 2, cy + 36 * u, 40 * u * eo(prog(t, .9, 1.6)), u, th.text, .8);
    A.text(ctx, dl(d.date).toUpperCase(), W / 2, cy + 80 * u, { w: 600, s: 20 * u, f: F.caps, ls: .5, color: th.soft, alpha: prog(t, 1.2, 1.9) });
  } };
  D.minimalOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', prog(t, 0, .8));
    A.text(ctx, d.phrase || 'gracias', W / 2, cy, { w: 600, s: 64 * u, f: F.serif, ls: .06, color: th.text, alpha: prog(t, .4, 1.3) });
  } };

  // Promo del negocio: el logo oficial entra con rebote.
  const drawLogo = (ctx, W, H, cx, cy, w, alpha, s) => {
    const L = SA.logos.blanco || SA.logo; if (!L) return 0;
    const ar = (L.naturalWidth || L.width) / (L.naturalHeight || L.height), h = w / ar;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx, cy); ctx.scale(s || 1, s || 1);
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 20 * U(W, H);
    ctx.drawImage(L, -w / 2, -h / 2, w, h); ctx.restore();
    return h;
  };
  D.promoIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .45, lw = Math.min(W * .78, 900 * u);
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .5));
    const lh = drawLogo(ctx, W, H, W / 2, cy, lw, prog(t, .15, .5), .85 + .15 * back(prog(t, .15, .8)));
    A.setFont(ctx, 700, 32 * u, F.caps, .12);
    const lines = A.wrap(ctx, (d.subtitle || 'Video y fotografía para XV años, bodas y eventos').toUpperCase(), W * .82);
    lines.forEach((ln, i) => A.text(ctx, ln, W / 2, cy + lh / 2 + 70 * u + i * 46 * u + up(u, prog(t, .9 + i * .15, 1.5 + i * .15)), { w: 700, s: 32 * u, f: F.caps, ls: .12, color: '#FFFFFF', alpha: prog(t, .9 + i * .15, 1.5 + i * .15) }));
  } };
  D.promoOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.5 * prog(t, 0, .4));
    const s = back(prog(t, .2, .7));
    ctx.save(); ctx.translate(W / 2, cy - 120 * u); ctx.scale(s, s);
    A.text(ctx, 'AGENDA TU FECHA', 0, 0, { w: 800, s: 92 * u, f: F.caps, color: '#FFFFFF', shadow: 20 * u, maxW: W * .9, alpha: prog(t, .2, .35) });
    ctx.restore();
    if (d.extra) {
      A.setFont(ctx, 800, 54 * u, F.caps, .04); const tw = ctx.measureText(d.extra).width;
      A.chip(ctx, W / 2 - (tw + 54 * u * 1.4) / 2, cy - 10 * u, d.extra, u, { s: 54, w: 800, bg: th.accent, color: '#1E1D1A', alpha: prog(t, .7, 1.1) });
    }
    A.text(ctx, d.place, W / 2, cy + 80 * u, { w: 700, s: 34 * u, f: F.caps, ls: .06, color: '#FFFFFF', alpha: prog(t, 1, 1.4), maxW: W * .86 });
    drawLogo(ctx, W, H, W / 2, cy + 220 * u, Math.min(W * .5, 520 * u), prog(t, 1.2, 1.8));
  } };

  // Antes y después
  D.adIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.1 * prog(t, 0, .4));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * eo(prog(t, .2, 1)), H); ctx.clip();
    A.text(ctx, 'ANTES', W / 2, cy - 40 * u, { w: 800, s: 150 * u, f: F.caps, color: 'rgba(255,255,255,.55)', maxW: W * .86 });
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * eo(prog(t, .7, 1.5)), H); ctx.clip();
    A.text(ctx, 'Y DESPUÉS', W / 2, cy + 110 * u, { w: 800, s: 150 * u, f: F.caps, color: '#FFFFFF', maxW: W * .86 });
    ctx.restore();
    A.text(ctx, (d.subtitle || 'Edición profesional de fotografía').toUpperCase(), W / 2, cy + 190 * u, { w: 700, s: 26 * u, f: F.caps, ls: .25, color: th.accent, alpha: prog(t, 1.4, 2), maxW: W * .88 });
  } };
  D.adOut = D.promoOut;

  // Save the Date moderno: letras grandes que rebotan y etiquetas.
  D.modernoIn = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = cyIn(W, H) - 80 * u;
    A.scrim(ctx, W, H, 'full', .8 * prog(t, 0, .4));
    ['SAVE', 'THE', 'DATE'].forEach((w, i) => {
      const p = prog(t, .1 + i * .18, .45 + i * .18), s = .5 + .5 * back(p);
      ctx.save(); ctx.translate(W / 2, cy - 120 * u + i * 118 * u); ctx.scale(s, s);
      A.text(ctx, w, 0, 0, { w: 800, s: 130 * u, f: F.caps, ls: .02, color: i === 1 ? th.accent : '#FFFFFF', alpha: clamp(p * 3), shadow: 20 * u });
      ctx.restore();
    });
    A.text(ctx, d.title, W / 2, cy + 230 * u, { s: 110 * u, f: F.script, color: '#FFFFFF', alpha: prog(t, .9, 1.5), shadow: 16 * u, maxW: W * .88 });
    if (d.date) { A.setFont(ctx, 800, 30 * u, F.caps, .04); const tx = dl(d.date, 'num'), tw = ctx.measureText(tx).width; A.chip(ctx, W / 2 - (tw + 42 * u) / 2, cy + 300 * u, tx, u, { s: 30, w: 800, alpha: prog(t, 1.3, 1.7), bg: th.accent, color: '#1E1D1A' }); }
  } };
  D.modernoOut = { draw: (ctx, W, H, t, dur, d, th) => {
    const u = U(W, H), cy = H * .5;
    A.scrim(ctx, W, H, 'full', 1.2 * prog(t, 0, .4));
    const parts = d.date ? [String(d.date.d).padStart(2, '0'), String(d.date.m).padStart(2, '0'), String(d.date.y).slice(-2)] : ['', '', ''];
    parts.forEach((x, i) => {
      const p = prog(t, .2 + i * .2, .5 + i * .2), s = .4 + .6 * back(p);
      ctx.save(); ctx.translate(W / 2 + (i - 1) * Math.min(300 * u, W * .3), cy - 30 * u); ctx.scale(s, s);
      A.text(ctx, x, 0, 0, { w: 800, s: Math.min(220 * u, W * .2), f: F.caps, color: i === 1 ? th.accent : '#FFFFFF', alpha: clamp(p * 3), shadow: 20 * u });
      ctx.restore();
    });
    A.text(ctx, (d.place || '').toUpperCase(), W / 2, cy + 80 * u, { w: 700, s: 30 * u, f: F.caps, ls: .25, color: '#FFFFFF', alpha: prog(t, 1.1, 1.6), maxW: W * .86 });
  } };

  /* ======================= PAPEL Y FOTOS ESPECIALES ======================= */
  const paperCache = {};
  SA.tpl = {
    paper(W, H) {
      const k = W + 'x' + H; if (paperCache[k]) return paperCache[k];
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.fillStyle = '#EDE6DA'; x.fillRect(0, 0, W, H);
      const id = x.getImageData(0, 0, W, H), dd = id.data, r = A.rng(4);
      for (let i = 0; i < dd.length; i += 4) { const n = (r() - .5) * 14; dd[i] += n; dd[i + 1] += n; dd[i + 2] += n; }
      x.putImageData(id, 0, 0);
      const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,40,20,.25)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      return (paperCache[k] = c);
    },
    // Foto dentro de una polaroid sobre papel, girada un poco, con texto a mano abajo.
    polaroid(ctx, img, W, H, i, caption) {
      ctx.drawImage(SA.tpl.paper(W, H), 0, 0);
      const u = U(W, H), cw = Math.min(W * .74, H * .62), ph = cw * .92, pw = cw * .86, ch = ph + cw * .26 + cw * .07;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate((i % 2 ? 1 : -1) * (.025 + (i % 3) * .01));
      ctx.shadowColor = 'rgba(40,25,10,.35)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 14 * u;
      ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.shadowColor = 'transparent';
      ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, -ch / 2 + cw * .07, pw, ph); ctx.clip();
      ctx.translate(-pw / 2, -ch / 2 + cw * .07); SA.color.drawFit(ctx, img, pw, ph, 'cover'); ctx.restore();
      if (caption) A.text(ctx, caption, 0, ch / 2 - cw * .08, { s: cw * .085, f: F.script, color: '#2B2620', maxW: pw });
      ctx.restore();
    }
  };

  /* ======================= PLANTILLAS ======================= */
  const f = (key, label, ph, def, type) => ({ key, label, ph, def, type });
  const NOMBRES = f('title', 'Nombres', 'Ana & Luis'), NOMBRE_XV = f('title', 'Nombre', 'Ana Sofía'),
    FECHA = f('date', 'Fecha', '', '', 'date'), LUGAR = f('place', 'Lugar (opcional)', 'Ciudad o salón');
  const CINE_LOOK = 'colorbalance=rs=-0.04:bs=0.06:rh=0.06:bh=-0.05,eq=contrast=1.06:saturation=1.05';
  const VHS_POST = 'rgbashift=rh=-4:bh=4,noise=alls=16:allf=t+u,eq=saturation=1.25:contrast=1.05,gblur=sigma=0.5';

  SA.TEMPLATES = [
    { id: 'std-clasico', name: 'Save the Date clásico', cats: ['eventos', 'bodas', 'simples'], level: 'Simple', theme: 'dorado',
      desc: 'Zoom lento en las fotos, título en letra manuscrita y cierre con la fecha.', fields: [NOMBRES, FECHA, LUGAR],
      mode: 'shots', intro: 4.2, shot: 3, outro: 5.2, beats: 4, T: .8, trans: ['fade'], layers: [{ at: 'intro', d: D.clasicoIn }, { at: 'outro', d: D.clasicoOut }] },
    { id: 'std-cine', name: 'Save the Date de cine', cats: ['eventos', 'bodas', 'llamativas'], level: 'Pro', theme: 'blanco', photoStyle: 'calido',
      desc: 'Barras de cine, grano de película, color cálido y nombres que se acomodan letra por letra.', fields: [NOMBRES, f('subtitle', 'Frase de arriba', 'Una historia de', 'Una historia de'), FECHA, LUGAR],
      mode: 'shots', intro: 4.6, shot: 3.2, outro: 5.6, beats: 4, T: .9, trans: ['fade', 'fadeblack'], look: CINE_LOOK, post: 'noise=alls=8:allf=t+u,vignette=angle=PI/5',
      preview: 'contrast(1.06) saturate(1.05) sepia(.08)', grain: true, vignette: true,
      layers: [{ at: 'all', d: D.letterbox }, { at: 'intro', d: D.cineIn }, { at: 'outro', d: D.cineOut }] },
    { id: 'std-moderno', name: 'Save the Date moderno', cats: ['eventos', 'bodas', 'llamativas'], level: 'Pro', theme: 'dorado',
      desc: 'Letras grandes que rebotan, cortes al ritmo y la fecha en números enormes.', fields: [NOMBRES, FECHA, LUGAR],
      mode: 'shots', intro: 4, shot: 2.4, outro: 4.6, beats: 4, T: .25, trans: ['fadewhite', 'smoothleft', 'zoomin', 'smoothright'], look: 'eq=contrast=1.08:saturation=1.15',
      layers: [{ at: 'intro', d: D.modernoIn }, { at: 'outro', d: D.modernoOut }] },
    { id: 'xv-clasico', name: 'Videoclip XV clásico', cats: ['xv'], level: 'Simple', theme: 'rosa',
      desc: 'Portada "Mis XV", tomas repartidas en toda la canción y cierre de agradecimiento.', fields: [NOMBRE_XV, f('subtitle', 'Frase final', '', 'Gracias por acompañarme'), FECHA, LUGAR],
      mode: 'song', durations: ['full', 180, 120, 60], intro: 5.2, shot: 3.4, outro: 6.5, beats: 8, T: .8, trans: ['fade'], layers: [{ at: 'intro', d: D.xvIn }, { at: 'outro', d: D.xvOut }] },
    { id: 'xv-neon', name: 'XV neón', cats: ['xv', 'llamativas'], level: 'Pro', theme: 'rosa',
      desc: 'Letrero de neón que parpadea al encender, destellos en los cortes y colores intensos.', fields: [NOMBRE_XV, f('subtitle', 'Letrero', '', 'Mis XV'), f('phrase', 'Letrero final', '', 'Gracias'), FECHA],
      mode: 'song', durations: ['full', 120, 60, 30], intro: 4.5, shot: 2.4, outro: 5, beats: 4, T: .25, trans: ['fadewhite', 'zoomin', 'fade', 'smoothleft'],
      look: 'eq=contrast=1.12:saturation=1.35', post: 'vignette=angle=PI/4', photoStyle: 'vivo', preview: 'contrast(1.12) saturate(1.35)', vignette: true,
      layers: [{ at: 'intro', d: D.neonIn }, { at: 'outro', d: D.neonOut }] },
    { id: 'boda-elegante', name: 'Boda elegante', cats: ['bodas'], level: 'Simple', theme: 'dorado', photoStyle: 'calido',
      desc: 'Nombres que se escriben solos, disolvencias lentas y color cálido.', fields: [NOMBRES, f('subtitle', 'Frase de arriba', '', 'Nuestra boda'), f('phrase', 'Frase final', '', 'Los esperamos'), FECHA, LUGAR],
      mode: 'song', durations: ['full', 180, 120, 60], intro: 5, shot: 3.8, outro: 6, beats: 8, T: 1, trans: ['fade', 'dissolve'],
      look: 'colorbalance=rm=0.03:bm=-0.03,eq=contrast=0.97:saturation=0.95', post: 'vignette=angle=PI/5', preview: 'sepia(.12) saturate(.95)', vignette: true,
      layers: [{ at: 'intro', d: D.eleganteIn }, { at: 'outro', d: D.eleganteOut }] },
    { id: 'cuenta', name: 'Cuenta regresiva', cats: ['eventos', 'xv', 'bodas', 'llamativas'], level: 'Pro', theme: 'dorado',
      desc: '"Faltan 30 días": el número rebota, cortes rápidos y cierre con la fecha.', fields: [f('extra', 'Días que faltan', '30', '30'), f('title', 'Para qué', 'mis XV'), FECHA, LUGAR],
      mode: 'shots', intro: 4, shot: 2.2, outro: 4.5, beats: 4, T: .3, trans: ['fadewhite', 'smoothleft', 'smoothright'], look: 'eq=contrast=1.06:saturation=1.1',
      layers: [{ at: 'intro', d: D.cuentaIn }, { at: 'outro', d: D.cuentaOut }] },
    { id: 'gracias', name: 'Agradecimiento', cats: ['eventos', 'xv', 'bodas', 'simples'], level: 'Simple', theme: 'dorado',
      desc: 'Mensaje que se escribe como en máquina de escribir y firma al final.', fields: [f('subtitle', 'Mensaje', '', 'Gracias por acompañarnos en este día'), f('title', 'Firma', 'Ana & Luis'), FECHA],
      mode: 'shots', intro: 5.5, shot: 3.4, outro: 5, beats: 8, T: .9, trans: ['fade'], layers: [{ at: 'intro', d: D.graciasIn }, { at: 'outro', d: D.graciasOut }] },
    { id: 'bautizo', name: 'Bautizo o primera comunión', cats: ['eventos'], level: 'Simple', theme: 'celeste',
      desc: 'Colores claros, letra delicada y entrada suave.', fields: [f('title', 'Nombre', 'Santiago'), f('subtitle', 'Título', '', 'Mi bautizo'), FECHA, LUGAR],
      mode: 'shots', intro: 4.6, shot: 3.4, outro: 5.2, beats: 8, T: 1, trans: ['fade'], look: 'eq=brightness=0.03:saturation=0.92', preview: 'brightness(1.05) saturate(.92)',
      layers: [{ at: 'intro', d: D.bautizoIn }, { at: 'outro', d: D.bautizoOut }] },
    { id: 'cumple', name: 'Cumpleaños', cats: ['eventos', 'llamativas'], level: 'Pro', theme: 'dorado', photoStyle: 'vivo',
      desc: 'Confeti, letras que rebotan y cortes al ritmo.', fields: [f('title', 'Nombre', 'Sofi'), f('subtitle', 'Saludo', '', '¡Feliz cumpleaños!'), FECHA],
      mode: 'song', durations: [60, 30, 'full'], intro: 4.2, shot: 2.4, outro: 4.6, beats: 4, T: .3, trans: ['zoomin', 'fadewhite', 'smoothup'], look: 'eq=contrast=1.08:saturation=1.3', preview: 'saturate(1.3)',
      layers: [{ at: 'intro', d: D.cumpleIn }, { at: 'outro', d: D.cumpleOut }] },
    { id: 'graduacion', name: 'Graduación', cats: ['eventos'], level: 'Simple', theme: 'dorado',
      desc: '"Generación 2027" en grande, línea dorada y transiciones laterales.', fields: [f('title', 'Nombre', 'Ana Sofía'), f('subtitle', 'Escuela o carrera', 'Ingeniería en TI'), f('extra', 'Año', '2027'), FECHA],
      mode: 'shots', intro: 4.6, shot: 3, outro: 4.8, beats: 4, T: .5, trans: ['slideleft', 'slideup', 'fade'], layers: [{ at: 'intro', d: D.gradIn }, { at: 'outro', d: D.gradOut }] },
    { id: 'vlog', name: 'Vlog del día', cats: ['vlog', 'simples'], level: 'Simple', theme: 'blanco',
      desc: 'Título palabra por palabra, etiquetas de fecha y lugar, "REC" y cortes directos al ritmo.', fields: [f('title', 'Título', 'un día en la boda'), FECHA, f('place', 'Lugar', 'Torreón'), f('extra', 'Redes', '@eduardosaucedo')],
      mode: 'song', durations: [60, 30, 'full'], intro: 4, shot: 2.4, outro: 4, beats: 4, T: 0, trans: [], look: 'eq=saturation=1.12:contrast=1.04', preview: 'saturate(1.12)',
      layers: [{ at: 'all', d: D.recDot, blink: true }, { at: 'intro', d: D.vlogIn }, { at: 'outro', d: D.vlogOut }] },
    { id: 'vhs', name: 'Vlog retro VHS', cats: ['vlog', 'llamativas'], level: 'Pro', theme: 'blanco',
      desc: 'Cinta VHS: "PLAY", fecha de cámara vieja, colores corridos, líneas y ruido.', fields: [f('title', 'Título', 'la fiesta'), f('subtitle', 'Subtítulo', 'XV Ana Sofía'), FECHA],
      mode: 'song', durations: [60, 30, 'full'], intro: 4, shot: 2.4, outro: 3.6, beats: 4, T: 0, trans: [], post: VHS_POST, photoStyle: 'vivo',
      preview: 'saturate(1.25) contrast(1.05) blur(.4px)', grain: true, vhs: true,
      layers: [{ at: 'all', d: D.vhsHud }, { at: 'intro', d: D.vhsIn }, { at: 'outro', d: D.vhsOut }] },
    { id: 'nostalgia', name: 'Nostalgia 35 mm', cats: ['vlog', 'eventos', 'bodas'], level: 'Pro', theme: 'dorado', photoStyle: 'pelicula',
      desc: 'Color de película antigua, grano, destellos de luz en los cortes y fecha a máquina.', fields: [f('title', 'Título', 'Ana & Luis'), f('subtitle', 'Frase', 'nuestra historia'), FECHA],
      mode: 'song', durations: ['full', 120, 60], intro: 4.8, shot: 3.4, outro: 5, beats: 8, T: .7, trans: ['fade'], look: 'curves=preset=vintage,eq=saturation=0.85',
      post: 'noise=alls=14:allf=t+u,vignette=angle=PI/4.5', preview: 'sepia(.35) saturate(.85) contrast(1.05)', grain: true, vignette: true,
      layers: [{ at: 'intro', d: D.filmIn }, { at: 'outro', d: D.filmOut }, { at: 'cuts', d: D.leak, dur: 1.2, every: 2 }] },
    { id: 'impacto', name: 'Impacto', cats: ['llamativas', 'vlog', 'xv'], level: 'Pro', theme: 'blanco',
      desc: 'Palabras que golpean la pantalla con destello, cortes muy rápidos y alto contraste.', fields: [f('title', 'Frase de entrada', 'LA MEJOR NOCHE'), f('subtitle', 'Frase final', 'XV ANA SOFÍA'), FECHA],
      mode: 'song', durations: [30, 60, 15], intro: 3.6, shot: 1.4, outro: 3.6, beats: 2, shotMin: 0.9, shotMax: 2.2, T: .2, trans: ['fadewhite', 'zoomin', 'fadewhite', 'smoothleft'],
      look: 'eq=contrast=1.18:saturation=1.25', preview: 'contrast(1.18) saturate(1.25)', layers: [{ at: 'intro', d: D.impactoIn }, { at: 'outro', d: D.impactoOut }] },
    { id: 'revista', name: 'Portada de revista', cats: ['llamativas', 'xv', 'bodas'], level: 'Pro', theme: 'dorado',
      desc: 'El nombre como título de revista, encabezados y código de barras.', fields: [f('title', 'Nombre en la portada', 'SOFÍA'), f('subtitle', 'Encabezado', '', 'Mis XV años'), f('extra', 'Subtítulo', '', 'Una noche para recordar'), FECHA, LUGAR],
      mode: 'shots', intro: 5, shot: 3.2, outro: 4.6, beats: 8, T: .8, trans: ['fade', 'slideleft'], wmSkip: ['intro'], layers: [{ at: 'intro', d: D.revistaIn }, { at: 'outro', d: D.revistaOut }] },
    { id: 'polaroid', name: 'Álbum polaroid', cats: ['simples', 'eventos'], level: 'Simple', theme: 'dorado', still: 'polaroid', zoom: .03,
      desc: 'Cada foto en una polaroid sobre papel, con pie de foto a mano.', fields: [f('title', 'Pie de foto', 'XV Ana Sofía'), f('phrase', 'Despedida', '', 'Gracias'), FECHA],
      mode: 'shots', intro: 3.4, shot: 3.2, outro: 4.6, beats: 8, T: .7, trans: ['fade', 'slideleft'], note: 'Ideal con fotos; los videos se ven completos sin marco.',
      layers: [{ at: 'outro', d: D.polaroidOut }] },
    { id: 'minimal', name: 'Minimal', cats: ['simples'], level: 'Simple', theme: 'blanco',
      desc: 'Solo un título pequeño, fundidos limpios y nada más.', fields: [f('title', 'Título', 'ana & luis'), FECHA],
      mode: 'shots', intro: 4, shot: 3.2, outro: 4, beats: 8, T: .8, trans: ['fade'], layers: [{ at: 'intro', d: D.minimalIn }, { at: 'outro', d: D.minimalOut }] },
    { id: 'promo', name: 'Promo del negocio', cats: ['negocio', 'llamativas'], level: 'Pro', theme: 'dorado',
      desc: 'Anuncio de Eduardo Saucedo · Video & Fotografía con tus mejores trabajos y "Agenda tu fecha".', fields: [f('subtitle', 'Frase', '', 'Video y fotografía para XV años, bodas y eventos'), f('extra', 'WhatsApp', '871 000 0000'), f('place', 'Redes o ciudad', '@eduardosaucedo · Gómez Palacio')],
      mode: 'song', durations: [30, 60, 15], intro: 4.4, shot: 2, outro: 5, beats: 4, T: .35, trans: ['fade', 'zoomin', 'smoothleft', 'fadewhite'], look: 'eq=contrast=1.08:saturation=1.15', wmSkip: ['intro', 'outro'],
      layers: [{ at: 'intro', d: D.promoIn }, { at: 'outro', d: D.promoOut }] },
    { id: 'antes-despues', name: 'Antes y después', cats: ['negocio'], level: 'Pro', theme: 'dorado', still: 'antesdespues',
      desc: 'Cada foto primero sin editar y luego con "Mejorar colores", con barrido. Ideal para redes del negocio.', fields: [f('subtitle', 'Frase', '', 'Edición profesional de fotografía'), f('extra', 'WhatsApp', '871 000 0000'), f('place', 'Redes o ciudad', '@eduardosaucedo')],
      mode: 'shots', intro: 4.2, shot: 2.2, outro: 5, beats: 4, T: .6, trans: ['wiperight', 'fade'], maxShots: 24, note: 'Solo usa fotos.', wmSkip: ['outro'],
      layers: [{ at: 'intro', d: D.adIn }, { at: 'outro', d: D.adOut }] }
  ];
  SA.TPL_CATS = [['todas', 'Todas'], ['eventos', 'Eventos'], ['xv', 'XV años'], ['bodas', 'Bodas'], ['llamativas', 'Llamativas'], ['vlog', 'Vlog'], ['simples', 'Simples'], ['negocio', 'Negocio']];
  SA.TPL_DESIGNS = D;
})();
