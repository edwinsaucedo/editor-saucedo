/* Color de fotos: "Mejorar colores" automático y estilos. Compartido por Fotos y por las fotos dentro de los videos. */
(function () {
  'use strict';
  const SA = window.SA = window.SA || {};
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ss = x => x * x * (3 - 2 * x);

  const STYLES = {
    natural:  { name: 'Natural' },
    calido:   { name: 'Boda cálida', gain: [1.05, 1, .92], lift: .03, con: -.06, vib: .04 },
    rosa:     { name: 'Rosa XV', gain: [1.03, .975, 1.015], hl: [.015, 0, .03], lift: .045, con: -.05, vib: .06 },
    byn:      { name: 'Blanco y negro', bw: true, con: .24, lift: .015 },
    vivo:     { name: 'Colores vivos', con: .14, vib: .34, sat: .06 },
    pelicula: { name: 'Película', sh: [-.03, .01, .05], hl: [.05, .02, -.04], lift: .08, con: .08, sat: -.14 }
  };

  function computeStats(cv) {
    const { data } = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height);
    const hr = new Uint32Array(256), hg = new Uint32Array(256), hb = new Uint32Array(256), hy = new Uint32Array(256);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      hr[r]++; hg[g]++; hb[b]++; hy[(r * 77 + g * 150 + b * 29) >> 8]++; n++;
    }
    if (!n) return null;
    const pct = (h, q) => { const t = q * n; let a = 0; for (let v = 0; v < 256; v++) { a += h[v]; if (a >= t) return v / 255; } return 1; };
    const yLo = pct(hy, .005), yHi = pct(hy, .995), WB = .7, lo = [], hi = [];
    [hr, hg, hb].forEach((h, c) => {
      let l = yLo + (pct(h, .005) - yLo) * WB, u = yHi + (pct(h, .995) - yHi) * WB;
      l = Math.min(l, .25); u = Math.max(u, .75);
      if (u - l < .3) u = l + .3;
      lo[c] = l; hi[c] = u;
    });
    const la = (lo[0] + lo[1] + lo[2]) / 3, ha = (hi[0] + hi[1] + hi[2]) / 3;
    let m = 0;
    for (let v = 0; v < 256; v++) m += hy[v] * clamp01((v / 255 - la) / (ha - la));
    m /= n;
    let g = Math.log(.47) / Math.log(Math.min(.95, Math.max(.05, m)));
    g = Math.min(1.3, Math.max(.72, g));
    g = 1 + (g - 1) * .65;
    return { lo, hi, g };
  }

  // cfg.adj: ajustes finos { b brillo, c contraste, s saturación, w calidez } de -100 a 100.
  function makeParams(stats, cfg) {
    const st = STYLES[cfg.style] || {};
    const auto = cfg.auto && stats;
    const adj = cfg.adj || {}, ab = (+adj.b || 0) / 100, ac = (+adj.c || 0) / 100, as = (+adj.s || 0) / 100, aw = (+adj.w || 0) / 100;
    if (!auto && (cfg.style || 'natural') === 'natural' && !ab && !ac && !as && !aw) return null;
    const ge = Math.pow(2, -ab * .85), wg = [1 + aw * .07, 1 + aw * .012, 1 - aw * .09];
    const L = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
    for (let c = 0; c < 3; c++) for (let v = 0; v < 256; v++) {
      let x = v / 255;
      if (auto) { x = clamp01((x - stats.lo[c]) / (stats.hi[c] - stats.lo[c])); x = Math.pow(x, stats.g); x += .16 * (ss(x) - x); }
      if (st.con) x += st.con * (ss(x) - x);
      if (!st.bw) {
        if (st.gain) x *= st.gain[c];
        if (st.sh) x += st.sh[c] * (1 - x) * (1 - x);
        if (st.hl) x += st.hl[c] * x * x;
      }
      x = clamp01(x);
      if (st.lift) x = st.lift + x * (1 - st.lift);
      if (ab) x = Math.pow(x, ge);
      if (ac) x = clamp01(x + ac * .7 * (ss(x) - x) * (ac > 0 ? 1 : 1.3));
      if (aw && !st.bw) x = clamp01(x * wg[c]);
      L[c][v] = Math.round(x * 255);
    }
    return { L, bw: !!st.bw, sat: (st.sat || 0) + as * (as < 0 ? 1 : .8), vib: (auto ? .16 : 0) + (st.vib || 0) };
  }

  function applyColor(d, P) {
    const R = P.L[0], G = P.L[1], B = P.L[2], n = d.length;
    if (P.bw) {
      for (let i = 0; i < n; i += 4) { const y = (R[d[i]] * 77 + G[d[i + 1]] * 150 + B[d[i + 2]] * 29) >> 8; d[i] = d[i + 1] = d[i + 2] = y; }
      return;
    }
    const sat = P.sat, vib = P.vib;
    if (!sat && !vib) {
      for (let i = 0; i < n; i += 4) { d[i] = R[d[i]]; d[i + 1] = G[d[i + 1]]; d[i + 2] = B[d[i + 2]]; }
      return;
    }
    for (let i = 0; i < n; i += 4) {
      const r = R[d[i]], g = G[d[i + 1]], b = B[d[i + 2]];
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const k = 1 + sat + vib * (1 - (mx - mn) / 255), l = (r * 77 + g * 150 + b * 29) >> 8;
      d[i] = l + (r - l) * k; d[i + 1] = l + (g - l) * k; d[i + 2] = l + (b - l) * k;
    }
  }

  function colorCanvas(ctx, w, h, stats, cfg) {
    const P = makeParams(stats, cfg);
    if (!P) return;
    const id = ctx.getImageData(0, 0, w, h);
    applyColor(id.data, P);
    ctx.putImageData(id, 0, 0);
  }

  function downscale(src, maxLong) {
    let w = src.width, h = src.height, cur = src;
    const s = Math.min(1, maxLong / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
    while (w / 2 > tw * 1.05) {
      const c = document.createElement('canvas');
      c.width = Math.round(w / 2); c.height = Math.round(h / 2);
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height);
      cur = c; w = c.width; h = c.height;
    }
    const out = document.createElement('canvas'); out.width = tw; out.height = th;
    const x = out.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, tw, th);
    return out;
  }

  // Dibuja src cubriendo (cover) o completo (contain) el rectángulo.
  function drawFit(ctx, src, W, H, mode, zoom) {
    const sw = src.width, sh = src.height;
    const s = (mode === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh)) * (zoom || 1);
    const dw = sw * s, dh = sh * s;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  const fitLong = (w, h, L) => { const s = L / Math.max(w, h); return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]; };

  SA.color = { STYLES, computeStats, makeParams, applyColor, colorCanvas, downscale, drawFit, fitLong };
})();
