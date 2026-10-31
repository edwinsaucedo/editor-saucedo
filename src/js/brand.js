/* Marca de agua (logo oficial en negro o blanco según el fondo), ajustes guardados y utilidades de pantalla compartidas. */
(function () {
  'use strict';
  const SA = window.SA = window.SA || {};

  /* ---------- Ajustes que se recuerdan entre usos ---------- */
  const KEY = 'saucedo-ajustes-v1', LOGO_KEY = 'saucedo-logo-v1';
  const DEF = { auto: true, style: 'natural', wm: true, pos: 'br', size: 'm', alpha: 'normal', wmColor: 'auto', codec: 'h264' };
  const S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  SA.settings = S;
  SA.saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  SA.POS = [['tl', 'Arriba a la izquierda'], ['tc', 'Arriba al centro'], ['tr', 'Arriba a la derecha'],
    ['ml', 'En medio a la izquierda'], ['mc', 'Al centro'], ['mr', 'En medio a la derecha'],
    ['bl', 'Abajo a la izquierda'], ['bc', 'Abajo al centro'], ['br', 'Abajo a la derecha']];
  const SIZES = { s: .24, m: .34, l: .48 };
  const ALPHAS = { suave: .45, normal: .75, fuerte: 1 };

  /* ---------- Logo ----------
   * Viene de fábrica el logo oficial (Eduardo Saucedo · Video & Fotografía) en negro y en blanco.
   * Si se sube otro logo, se le sacan también sus versiones negra y blanca. */
  SA.BUSINESS = 'Eduardo Saucedo · Video & Fotografía';
  SA.logos = { negro: null, blanco: null, original: null, custom: false };
  SA.logo = null;   // el que se muestra en vistas previas de la pantalla
  const listeners = [];
  SA.onBrandChange = fn => listeners.push(fn);
  SA.brandChanged = () => { SA.saveSettings(); listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); };
  const loadImg = async src => { const im = new Image(); im.src = src; await im.decode(); return im; };
  // Silueta de un logo: con transparencia usa la transparencia; sin ella, lo oscuro es el logo.
  function variants(img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, w, h), d = id.data;
    let transp = false; for (let i = 3; i < d.length; i += 16) if (d[i] < 245) { transp = true; break; }
    let colorful = false;
    const mk = rgb => {
      const o = document.createElement('canvas'); o.width = w; o.height = h;
      const ox = o.getContext('2d'), od = ox.createImageData(w, h), q = od.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
        const a = transp ? d[i + 3] : Math.max(0, Math.min(255, (235 - lum) * 1.25));
        q[i] = rgb[0]; q[i + 1] = rgb[1]; q[i + 2] = rgb[2]; q[i + 3] = a;
      }
      ox.putImageData(od, 0, 0); return o;
    };
    for (let i = 0; i < d.length; i += 64) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (d[i + 3] > 128 && mx - mn > 40) { colorful = true; break; } }
    return { negro: mk([17, 17, 17]), blanco: mk([255, 255, 255]), colorful, transp };
  }
  async function useOfficial() {
    const [negro, blanco] = await Promise.all([loadImg('brand/logo-negro.png'), loadImg('brand/logo-blanco.png')]);
    Object.assign(SA.logos, { negro, blanco, original: null, custom: false });
    SA.logo = negro;
  }
  SA.loadStoredLogo = async () => {
    let url = null; try { url = localStorage.getItem(LOGO_KEY); } catch (e) {}
    try {
      if (url) {
        const img = await loadImg(url), v = variants(img);
        Object.assign(SA.logos, { negro: v.negro, blanco: v.blanco, original: v.colorful ? img : null, custom: true });
        SA.logo = img;
      } else await useOfficial();
    } catch (e) { try { await useOfficial(); } catch (e2) {} }
  };
  // Devuelve un mensaje para mostrar debajo del logo.
  SA.loadLogoFromPath = async path => {
    const blob = await SA.bridge.readBlob(path);
    const bmp = await createImageBitmap(blob);
    const c = SA.color.downscale(bmp, 1400); bmp.close && bmp.close();
    const url = c.toDataURL('image/png');
    const img = await loadImg(url), v = variants(img);
    Object.assign(SA.logos, { negro: v.negro, blanco: v.blanco, original: v.colorful ? img : null, custom: true });
    SA.logo = img;
    let stored = true; try { localStorage.setItem(LOGO_KEY, url); } catch (e) { stored = false; }
    if (!S.wm) S.wm = true;
    SA.brandChanged();
    return !stored ? 'El logo se usará hoy, pero no se pudo guardar para la próxima vez.'
      : v.colorful ? 'Logo guardado. Puedes usarlo en sus colores o en negro y blanco según el fondo.'
      : 'Logo guardado. Se pone en negro o blanco según el fondo de cada foto y video.';
  };
  SA.removeLogo = async () => { try { localStorage.removeItem(LOGO_KEY); } catch (e) {} await useOfficial(); SA.brandChanged(); };

  /* ---------- Dibujo de la marca ---------- */
  const SCRIPT = '"SA Script","Brush Script MT",cursive', CAPS = '"SA Caps","Arial Narrow",Arial,sans-serif';
  SA.FONTS = { SCRIPT, CAPS, SERIF: '"SA Serif",Georgia,"Times New Roman",serif' };
  // Dónde va la marca dentro de una imagen de w × h.
  SA.wmBox = (w, h, cfg, scale) => {
    const L = SA.logos.negro || SA.logo;
    const short = Math.min(w, h), k = (SIZES[cfg.size] || .34) * (scale || 1), m = short * .04;
    const ar = L ? (L.naturalWidth || L.width) / (L.naturalHeight || L.height) : 2.2;
    let bw = short * k * 1.15, bh = bw / ar;
    const maxH = short * k * .7;
    if (bh > maxH) { bh = maxH; bw = bh * ar; }
    const pos = cfg.pos || 'br', row = pos[0], col = pos[1];
    const x = col === 'l' ? m : col === 'c' ? (w - bw) / 2 : w - m - bw;
    const y = row === 't' ? m : row === 'm' ? (h - bh) / 2 : h - m - bh;
    return { x, y, w: bw, h: bh };
  };
  // Brillo promedio (0-255) de la zona donde iría la marca, a partir de una imagen fuente encuadrada como "cover".
  SA.wmZoneLuma = (src, W, H, cfg, scale) => {
    if (!src) return 128;
    const sw = 96, sh = Math.max(1, Math.round(96 * H / W));
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const x = c.getContext('2d', { willReadFrequently: true });
    SA.color.drawFit(x, src, sw, sh, 'cover');
    const b = SA.wmBox(sw, sh, cfg, scale);
    const d = x.getImageData(Math.max(0, Math.floor(b.x)), Math.max(0, Math.floor(b.y)), Math.max(1, Math.ceil(b.w)), Math.max(1, Math.ceil(b.h))).data;
    let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { s += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; n++; }
    return n ? s / n : 128;
  };
  SA.wmVariantFor = luma => (luma > 150 ? 'negro' : 'blanco');
  // variant: 'negro' | 'blanco' | 'original'; si no se da y el color es automático, se mide el fondo ya dibujado.
  SA.drawWatermark = (ctx, w, h, cfg, scale, variant) => {
    if (!cfg.wm) return;
    const b = SA.wmBox(w, h, cfg, scale), a = ALPHAS[cfg.alpha] ?? .75;
    let v = variant || cfg.wmColor || 'auto';
    if (v === 'original' && !SA.logos.original) v = 'auto';
    if (v === 'auto') {
      let lum = 128;
      try {
        const d = ctx.getImageData(Math.max(0, Math.floor(b.x)), Math.max(0, Math.floor(b.y)), Math.max(1, Math.ceil(b.w)), Math.max(1, Math.ceil(b.h))).data;
        let s = 0, n = 0; for (let i = 0; i < d.length; i += 16) { if (d[i + 3] < 20) continue; s += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; n++; }
        lum = n ? s / n : 60;   // si la zona está vacía (capa transparente), se asume fondo oscuro
      } catch (e) {}
      v = SA.wmVariantFor(lum);
    }
    const img = SA.logos[v] || SA.logos.blanco || SA.logo;
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingQuality = 'high';
    if (v === 'blanco') { const short = Math.min(w, h); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = short * .008; ctx.shadowOffsetY = short * .0012; }
    ctx.drawImage(img, b.x, b.y, b.w, b.h);
    ctx.restore();
  };
  SA.VIDEO_WM_SCALE = .72;

  /* ---------- Utilidades de pantalla ---------- */
  const ui = SA.ui = {};
  ui.$ = (s, r) => (r || document).querySelector(s);
  ui.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  ui.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let toastT = 0;
  ui.toast = (msg, ms = 4500) => {
    const t = ui.$('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
  };
  // Grupo de botones tipo "Chica | Mediana | Grande".
  ui.seg = (el, value, onPick) => {
    ui.$$('button', el).forEach(b => {
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => onPick(b.dataset.v));
    });
    ui.setSeg(el, value);
  };
  ui.setSeg = (el, value) => ui.$$('button', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === String(value))));

  /* Compresión del archivo final, la misma en las pestañas de video (se recuerda). */
  const CODEC_HINT = {
    h264: 'H.264: se abre en cualquier celular, computadora, tele y WhatsApp.',
    h265: 'H.265: misma calidad y cerca de la mitad del peso en video de cámara y fotos (4 GB quedan en unos 2 GB). Tarda un poco más si no hay tarjeta de video. Se ve en celulares, teles recientes, YouTube, Facebook y VLC; algunas computadoras con Windows piden instalar la "Extensión de video HEVC".'
  };
  ui.codecHtml = () => `<div class="field"><span class="lbl">Compresión del archivo</span><div class="seg" data-el="codec" role="radiogroup" aria-label="Compresión del archivo">` +
    `<button type="button" data-v="h264">Compatible · H.264</button><button type="button" data-v="h265">Más ligero · H.265</button></div><p class="hint" data-el="codecHint"></p></div>`;
  const syncCodec = () => ui.$$('[data-el="codec"]').forEach(el => {
    ui.setSeg(el, S.codec);
    const h = el.parentElement && el.parentElement.querySelector('[data-el="codecHint"]');
    if (h) h.textContent = CODEC_HINT[S.codec] || CODEC_HINT.h264;
  });
  ui.codec = (root, onChange) => {
    const el = root.querySelector('[data-el="codec"]');
    if (!el) return;
    ui.seg(el, S.codec, v => { S.codec = v === 'h265' ? 'h265' : 'h264'; SA.saveSettings(); syncCodec(); if (onChange) onChange(S.codec); });
    syncCodec();
  };
  ui.syncCodec = syncCodec;
  ui.fmtDuration = s => window.Engine.fmtTime(s);
  ui.MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  ui.parseDate = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  ui.todayISO = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
})();
