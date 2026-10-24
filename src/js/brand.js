/* Marca de agua (logo o nombre en letra), ajustes guardados y utilidades de pantalla compartidas. */
(function () {
  'use strict';
  const SA = window.SA = window.SA || {};

  /* ---------- Ajustes que se recuerdan entre usos ---------- */
  const KEY = 'saucedo-ajustes-v1', LOGO_KEY = 'saucedo-logo-v1';
  const DEF = { auto: true, style: 'natural', wm: true, pos: 'br', size: 'm', alpha: 'normal' };
  const S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  SA.settings = S;
  SA.saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  SA.POS = [['tl', 'Arriba a la izquierda'], ['tc', 'Arriba al centro'], ['tr', 'Arriba a la derecha'],
    ['ml', 'En medio a la izquierda'], ['mc', 'Al centro'], ['mr', 'En medio a la derecha'],
    ['bl', 'Abajo a la izquierda'], ['bc', 'Abajo al centro'], ['br', 'Abajo a la derecha']];
  const SIZES = { s: .24, m: .34, l: .48 };
  const ALPHAS = { suave: .45, normal: .75, fuerte: 1 };

  /* ---------- Logo ---------- */
  SA.logo = null;
  const listeners = [];
  SA.onBrandChange = fn => listeners.push(fn);
  SA.brandChanged = () => { SA.saveSettings(); listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); };
  SA.setLogoUrl = async url => { const im = new Image(); im.src = url; await im.decode(); SA.logo = im; };
  SA.loadStoredLogo = async () => {
    let url = null; try { url = localStorage.getItem(LOGO_KEY); } catch (e) {}
    if (url) { try { await SA.setLogoUrl(url); } catch (e) {} }
  };
  // Devuelve un mensaje para mostrar debajo del logo.
  SA.loadLogoFromPath = async path => {
    const blob = await SA.bridge.readBlob(path);
    const bmp = await createImageBitmap(blob);
    const c = SA.color.downscale(bmp, 1400); bmp.close && bmp.close();
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let alpha = false; for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { alpha = true; break; }
    const url = c.toDataURL('image/png');
    await SA.setLogoUrl(url);
    let stored = true; try { localStorage.setItem(LOGO_KEY, url); } catch (e) { stored = false; }
    if (!S.wm) S.wm = true;
    SA.brandChanged();
    return !alpha ? 'Este logo tiene fondo. Para que se vea limpio sobre la foto, usa un PNG sin fondo.'
      : stored ? 'Logo guardado. Se usará en fotos y videos cada vez que abras el programa.'
      : 'El logo se usará hoy, pero no se pudo guardar para la próxima vez.';
  };
  SA.removeLogo = () => { SA.logo = null; try { localStorage.removeItem(LOGO_KEY); } catch (e) {} SA.brandChanged(); };

  /* ---------- Dibujo de la marca ---------- */
  const SCRIPT = '"SA Script","Brush Script MT",cursive', CAPS = '"SA Caps","Arial Narrow",Arial,sans-serif';
  SA.FONTS = { SCRIPT, CAPS, SERIF: '"SA Serif",Georgia,"Times New Roman",serif' };
  // scale: 1 en fotos; en video la marca va un poco más chica para no estorbar.
  SA.drawWatermark = (ctx, w, h, cfg, scale) => {
    if (!cfg.wm) return;
    const short = Math.min(w, h), k = (SIZES[cfg.size] || .34) * (scale || 1), a = ALPHAS[cfg.alpha] ?? .75, m = short * .04;
    let bw, bh, fs = 0, fs2 = 0, ls = 0;
    ctx.save();
    if (SA.logo) {
      const ar = SA.logo.naturalWidth / SA.logo.naturalHeight;
      bw = short * k; bh = bw / ar;
      const maxH = short * k * .8;
      if (bh > maxH) { bh = maxH; bw = bh * ar; }
    } else {
      fs = short * k * .36; fs2 = fs * .2; ls = fs2 * .25;
      ctx.font = `${fs}px ${SCRIPT}`;
      const tw = ctx.measureText('Saucedo').width;
      ctx.font = `700 ${fs2}px ${CAPS}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px';
      const sw = ctx.measureText('VIDEO Y FOTOGRAFÍA').width;
      bw = Math.max(tw, sw); bh = fs * .82 + fs2 * 1.9;
    }
    const pos = cfg.pos || 'br', row = pos[0], col = pos[1];
    const x = col === 'l' ? m : col === 'c' ? (w - bw) / 2 : w - m - bw;
    const y = row === 't' ? m : row === 'm' ? (h - bh) / 2 : h - m - bh;
    ctx.globalAlpha = a;
    if (SA.logo) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(SA.logo, x, y, bw, bh);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = short * .01; ctx.shadowOffsetY = short * .0015;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `${fs}px ${SCRIPT}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.fillText('Saucedo', x + bw / 2, y + fs * .8);
      ctx.font = `700 ${fs2}px ${CAPS}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px';
      ctx.fillText('VIDEO Y FOTOGRAFÍA', x + bw / 2 + ls / 2, y + fs * .8 + fs2 * 1.6);
    }
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
  ui.fmtDuration = s => window.Engine.fmtTime(s);
  ui.MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  ui.parseDate = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  ui.todayISO = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
})();
