/* Transiciones: los mismos tipos que usa FFmpeg (xfade), dibujados en la pantalla para verlos antes de crear el video.
 * Se usan en la Película del evento y en la Fotosecuencia. */
(function () {
  'use strict';
  const SA = window.SA;
  const T = SA.trans = {};
  // [clave de FFmpeg, nombre para el usuario]. 'auto' y 'corte' no son de FFmpeg: los resuelve el programa.
  // Primero las suaves y elegantes (para ceremonia, vals y momentos emotivos), después las de movimiento.
  T.TYPES = [
    ['auto', 'Automática'], ['corte', 'Corte directo'], ['fade', 'Fundido'], ['fadeslow', 'Fundido lento'], ['luz', 'Luz cálida'],
    ['hblur', 'Desenfoque'], ['fadegrays', 'Recuerdo en gris'], ['fadeblack', 'Fundido a negro'], ['fadewhite', 'Destello blanco'],
    ['vertopen', 'Apertura'], ['circlecrop', 'Iris de cine'], ['smoothleft', 'Deslizar ←'], ['smoothright', 'Deslizar →'], ['smoothup', 'Subir'], ['smoothdown', 'Bajar'],
    ['slideleft', 'Empujar ←'], ['slideright', 'Empujar →'], ['circleopen', 'Círculo'], ['circleclose', 'Círculo al centro'], ['zoomin', 'Acercamiento'],
    ['wiperight', 'Barrido'], ['radial', 'Reloj'], ['horzopen', 'Cortina']
  ];
  T.name = k => (T.TYPES.find(x => x[0] === k) || [k, k])[1];
  T.DURS = [[0.4, 'Rápida'], [0.8, 'Normal'], [1.5, 'Lenta'], [2.2, 'Muy lenta']];

  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const eio = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const slow = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };   // más lenta al empezar y al terminar
  // Dibuja la imagen cubriendo todo el cuadro (como en el video).
  const cover = (ctx, img, W, H, z) => {
    if (!img) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    if (typeof img === 'function') { img(ctx, W, H); return; }
    const iw = img.width, ih = img.height, s = Math.max(W / iw, H / ih) * (z || 1);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  };
  const offs = {};
  let off = null;
  const scratch = (W, H) => {
    const k = W + 'x' + H; off = offs[k] || (offs[k] = Object.assign(document.createElement('canvas'), { width: W, height: H }));
    const x = off.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, H); return x;
  };
  // B con una orilla suave que avanza (como smoothleft/right/up/down de FFmpeg).
  const softWipe = (ctx, W, H, b, p, dir) => {
    const x = scratch(W, H); cover(x, b, W, H);
    x.globalCompositeOperation = 'destination-in';
    const horiz = dir === 'left' || dir === 'right';
    const g = horiz ? x.createLinearGradient(0, 0, W, 0) : x.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, pos = dir === 'left' || dir === 'up' ? u : 1 - u;
      g.addColorStop(u, `rgba(0,0,0,${ss(0, 1, 1 + pos - (1 - p) * 2).toFixed(3)})`);
    }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0);
  };
  const clipDraw = (ctx, W, H, img, path) => { ctx.save(); ctx.beginPath(); path(); ctx.clip(); cover(ctx, img, W, H); ctx.restore(); };

  /* Cuadro de la transición `type` entre a y b en el avance p (0 = solo a, 1 = solo b). */
  T.draw = (ctx, W, H, a, b, type, p) => {
    p = clamp(p);
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const R = Math.hypot(W, H) / 2;
    switch (type) {
      case 'corte': cover(ctx, p < .5 ? a : b, W, H); break;
      case 'fadeblack': case 'fadewhite':
        ctx.fillStyle = type === 'fadewhite' ? '#fff' : '#000'; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = p < .5 ? 1 - p * 2 : p * 2 - 1; cover(ctx, p < .5 ? a : b, W, H); break;
      case 'fadeslow': cover(ctx, a, W, H); ctx.globalAlpha = slow(p); cover(ctx, b, W, H); break;
      case 'luz': {   // fundido con un destello cálido en medio
        cover(ctx, a, W, H); ctx.globalAlpha = eio(p); cover(ctx, b, W, H);
        const g = Math.pow(Math.sin(p * Math.PI), 2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen';
        const rg = ctx.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .45, R * 1.1);
        rg.addColorStop(0, `rgba(255,226,180,${(.62 * g).toFixed(3)})`); rg.addColorStop(1, `rgba(255,196,140,${(.38 * g).toFixed(3)})`);
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); break;
      }
      case 'fadegrays': {   // las fotos pierden el color, cambian y lo recuperan
        const g = 1 - Math.abs(2 * p - 1);
        ctx.filter = `grayscale(${g.toFixed(3)})`; cover(ctx, a, W, H); ctx.globalAlpha = ss(.25, .75, p); cover(ctx, b, W, H); break;
      }
      case 'vertopen': cover(ctx, a, W, H); clipDraw(ctx, W, H, b, () => ctx.rect(W / 2 * (1 - eio(p)), 0, W * eio(p), H)); break;
      case 'circlecrop':   // iris de cine: se cierra en negro y se abre la siguiente
        if (p < .5) clipDraw(ctx, W, H, a, () => ctx.arc(W / 2, H / 2, R * (1 - eio(p * 2)), 0, Math.PI * 2));
        else clipDraw(ctx, W, H, b, () => ctx.arc(W / 2, H / 2, R * eio(p * 2 - 1), 0, Math.PI * 2));
        break;
      case 'hblur': {
        const k = Math.sin(p * Math.PI) * W * .02;
        ctx.filter = `blur(${k.toFixed(1)}px)`; cover(ctx, a, W, H); ctx.globalAlpha = eio(p); cover(ctx, b, W, H); break;
      }
      case 'smoothleft': cover(ctx, a, W, H); softWipe(ctx, W, H, b, p, 'left'); break;
      case 'smoothright': cover(ctx, a, W, H); softWipe(ctx, W, H, b, p, 'right'); break;
      case 'smoothup': cover(ctx, a, W, H); softWipe(ctx, W, H, b, p, 'up'); break;
      case 'smoothdown': cover(ctx, a, W, H); softWipe(ctx, W, H, b, p, 'down'); break;
      case 'slideleft': case 'slideright': {
        const s = type === 'slideleft' ? -1 : 1, e = eio(p);
        ctx.save(); ctx.translate(s * e * W, 0); cover(ctx, a, W, H); ctx.restore();
        ctx.save(); ctx.translate(s * (e - 1) * W, 0); cover(ctx, b, W, H); ctx.restore(); break;
      }
      case 'circleopen': cover(ctx, a, W, H); clipDraw(ctx, W, H, b, () => ctx.arc(W / 2, H / 2, R * eio(p), 0, Math.PI * 2)); break;
      case 'circleclose': cover(ctx, b, W, H); clipDraw(ctx, W, H, a, () => ctx.arc(W / 2, H / 2, R * (1 - eio(p)), 0, Math.PI * 2)); break;
      case 'zoomin': cover(ctx, b, W, H); ctx.globalAlpha = 1 - ss(.35, 1, p); cover(ctx, a, W, H, 1 + 1.2 * eio(p)); break;
      case 'wiperight': cover(ctx, a, W, H); clipDraw(ctx, W, H, b, () => ctx.rect(0, 0, W * p, H)); break;
      case 'radial': cover(ctx, a, W, H); clipDraw(ctx, W, H, b, () => { ctx.moveTo(W / 2, H / 2); ctx.arc(W / 2, H / 2, R * 1.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.closePath(); }); break;
      case 'horzopen': cover(ctx, a, W, H); clipDraw(ctx, W, H, b, () => ctx.rect(0, H / 2 * (1 - eio(p)), W, H * eio(p))); break;
      default: cover(ctx, a, W, H); ctx.globalAlpha = eio(p); cover(ctx, b, W, H);   // fade y automática
    }
    ctx.restore();
  };

  /* Cuadrícula de transiciones con su muestra animada (con las imágenes reales de las tomas o fotos). */
  T.gridHtml = (list, cur, act) => `<div class="trans-grid">${list.map(([k, t]) =>
    `<button type="button" class="tr${(cur || 'auto') === k ? ' on' : ''}" data-act="${act}" data-v="${k}" aria-pressed="${(cur || 'auto') === k}" title="${t}"><canvas class="tpc" width="112" height="64" aria-hidden="true"></canvas><span class="tn">${t}</span></button>`).join('')}</div>`;
  // imgs() → { a, b, auto } : imágenes de antes y después, y qué tipo muestra "Automática".
  T.animate = (root, imgs) => {
    const tiles = Array.from(root.querySelectorAll('.tr canvas.tpc'));
    if (!tiles.length) return;
    const t0 = performance.now();
    const paint = (cv, p) => { const btn = cv.closest('.tr'), k = btn.dataset.v, im = imgs(); T.draw(cv.getContext('2d'), cv.width, cv.height, im.a, im.b, k === 'auto' ? (im.auto || 'fade') : k, p); };
    // Cuadro quieto de la muestra: a la mitad, menos en las que a la mitad se ven todas negras o blancas.
    const still = cv => ({ fadeblack: .3, fadewhite: .3, circlecrop: .32 })[cv.closest('.tr').dataset.v] || .5;
    tiles.forEach(cv => paint(cv, still(cv)));
    const loop = now => {
      if (!root.isConnected) return;
      const cyc = ((now - t0) / 1000) % 2.2, p = cyc < .5 ? 0 : cyc > 1.7 ? 1 : (cyc - .5) / 1.2;
      tiles.forEach(cv => { const btn = cv.closest('.tr'); if (btn.matches(':hover') || btn.classList.contains('on')) { paint(cv, p); btn._moving = true; } else if (btn._moving) { paint(cv, still(cv)); btn._moving = false; } });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  /* Vista grande: muestra a, la transición y b, y se repite `times` veces. Devuelve una función para detenerla. */
  T.play = (cv, a, b, type, dur, opts = {}) => {
    const ctx = cv.getContext('2d'), hold = opts.hold || .7, cycle = hold * 2 + Math.max(.2, dur), times = opts.times || 2;
    let raf = 0, stop = false;
    const t0 = performance.now();
    const loop = now => {
      if (stop) return;
      const el = (now - t0) / 1000;
      if (el > cycle * times) { if (opts.onEnd) opts.onEnd(); return; }
      const c = el % cycle, p = type === 'corte' ? (c < hold + .01 ? 0 : 1) : (c - hold) / Math.max(.2, dur);
      T.draw(ctx, cv.width, cv.height, a, b, type, p);
      if (opts.label) opts.label(ctx, cv.width, cv.height);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { stop = true; cancelAnimationFrame(raf); };
  };
})();
