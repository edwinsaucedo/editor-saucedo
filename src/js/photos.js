/* Pestaña Fotos: mejorar colores, estilos y marca de agua por lote. */
(function () {
  'use strict';
  const SA = window.SA;
  const { $, esc, toast } = SA.ui;
  const C = SA.color, B = SA.bridge, S = SA.settings;

  function renderTo(cv, src, w, h, stats, cfg, withWm) {
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    C.colorCanvas(ctx, w, h, stats, cfg);
    if (withWm) SA.drawWatermark(ctx, w, h, cfg, 1);
  }

  /* Muestra para la primera vez: carta de color con tono amarillento. */
  function makeSample() {
    const W = 1800, H = 1200, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#94938F'); g.addColorStop(1, '#52514E');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.fill(); };
    const cw = 1400, ch = 940, cx = (W - cw) / 2, cy = (H - ch) / 2;
    x.fillStyle = 'rgba(0,0,0,.35)'; rr(cx + 10, cy + 18, cw, ch, 26);
    x.fillStyle = '#1F1F1F'; rr(cx, cy, cw, ch, 26);
    const cols = ['#735244', '#C29682', '#627A9D', '#576C43', '#8580B1', '#67BDAA', '#D67E2C', '#505BA6', '#C15A63', '#5E3C6C', '#9DBC40', '#E0A32E',
      '#383D96', '#469449', '#AF363C', '#E7C71F', '#BB5695', '#0885A1', '#F3F3F2', '#C8C8C8', '#A0A0A0', '#7A7A79', '#555555', '#343434'];
    const pad = 64, gap = 26, pw = (cw - pad * 2 - gap * 5) / 6, ph = (ch - pad * 2 - 70 - gap * 3) / 4;
    cols.forEach((col, i) => { x.fillStyle = col; rr(cx + pad + (i % 6) * (pw + gap), cy + pad + Math.floor(i / 6) * (ph + gap), pw, ph, 10); });
    x.fillStyle = '#D8D8D8'; x.font = '700 30px Arial, sans-serif';
    x.fillText('MUESTRA  ·  CARTA DE COLOR', cx + pad, cy + ch - 52);
    const id = x.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const nz = (Math.random() - .5) * 7;
      d[i] = 36 + d[i] * .72 * 1.03 + nz; d[i + 1] = 38 + d[i + 1] * .72 * 1.04 + nz; d[i + 2] = 28 + d[i + 2] * .72 * .9 + nz;
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  const el = {
    film: $('#phFilm'), filmWrap: $('#phFilmWrap'), stage: $('#phStage'), frame: $('#phFrame'), empty: $('#phEmpty'), info: $('#phInfo'),
    cvA: $('#phAfter'), cvB: $('#phBefore'), busy: $('#phBusy'), name: $('#phName'), sub: $('#phSub'),
    count: $('#phCount'), clear: $('#phClear'), save: $('#phSave'), progress: $('#phProgress'), progText: $('#phProgText'), bar: $('#phBar'),
    styles: $('#phStyles'), auto: $('#phAuto'), autoState: $('#phAutoState'), event: $('#phEvent'), dest: $('#phDest'), done: $('#phDone'),
    prev: $('#phPrev'), next: $('#phNext'), remove: $('#phRemove')
  };
  let items = [], sel = null, uid = 0, selTok = 0, saving = null, customDir = null, lastDir = null;
  const lru = [];
  const realItems = () => items.filter(i => !i.sample);

  /* ---------- Controles de color ---------- */
  Object.entries(C.STYLES).forEach(([key, st]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'style'; b.setAttribute('role', 'radio'); b.dataset.style = key;
    b.innerHTML = `<canvas width="180" height="120"></canvas><span>${esc(st.name)}</span>`;
    b.addEventListener('click', () => { S.style = key; changed(); });
    el.styles.appendChild(b);
  });
  el.auto.addEventListener('click', () => { S.auto = !S.auto; changed(true); });

  function syncUI() {
    el.auto.setAttribute('aria-pressed', S.auto); el.autoState.textContent = S.auto ? 'Activado' : 'Apagado';
    el.styles.querySelectorAll('.style').forEach(b => b.setAttribute('aria-checked', b.dataset.style === S.style));
  }
  function changed(cards) { SA.saveSettings(); syncUI(); lastFit = ''; schedulePreview(); rerenderThumbs(); if (cards) renderStyleCards(); }
  SA.onBrandChange(() => { lastFit = ''; schedulePreview(); rerenderThumbs(); });

  /* ---------- Tira ---------- */
  function mountThumb(it) {
    const w = document.createElement('div');
    w.className = 'thumb';
    w.innerHTML = '<span class="n"></span><button type="button" class="pick"><span class="ph">Cargando…</span></button>' +
      (it.sample ? '' : '<button type="button" class="x" aria-label="Quitar esta foto" title="Quitar">×</button>');
    w.querySelector('.pick').addEventListener('click', () => select(it));
    const x = w.querySelector('.x'); if (x) x.addEventListener('click', () => removeItem(it));
    it.el = w; el.film.appendChild(w);
  }
  function renderThumb(it) {
    if (!it.el || it.status !== 'ok') return;
    if (!it.tcv) it.tcv = document.createElement('canvas');
    const [tw, th] = C.fitLong(it.src.width, it.src.height, 240);
    renderTo(it.tcv, it.src, tw, th, it.stats, S, true);
    const pick = it.el.querySelector('.pick');
    if (it.tcv.parentNode !== pick) { pick.textContent = ''; pick.appendChild(it.tcv); }
    pick.setAttribute('aria-label', it.sample ? 'Muestra' : it.name);
  }
  function renumber() {
    let n = 0;
    items.forEach(it => { if (it.el) it.el.querySelector('.n').textContent = it.sample ? 'MUESTRA' : String(++n).padStart(2, '0') + ' ▸'; });
  }
  let thumbGen = 0;
  function rerenderThumbs() {
    const my = ++thumbGen; let i = 0;
    const step = () => {
      if (my !== thumbGen) return;
      const t0 = performance.now();
      while (i < items.length && performance.now() - t0 < 14) renderThumb(items[i++]);
      if (i < items.length) setTimeout(step, 0);
    };
    step();
  }
  function renderStyleCards() {
    el.styles.querySelectorAll('.style').forEach(b => {
      const cv = b.querySelector('canvas');
      if (!sel || sel.status !== 'ok') { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
      const [tw, th] = C.fitLong(sel.src.width, sel.src.height, 240);
      renderTo(cv, sel.src, tw, th, sel.stats, Object.assign({}, S, { style: b.dataset.style }), false);
    });
  }

  /* ---------- Vista grande ---------- */
  let raf = 0, lastFit = '';
  const schedulePreview = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawPreview); };
  function drawPreview() {
    updateStage();
    if (!sel || sel.status !== 'ok') return;
    const pv = sel.preview || sel.src, ar = pv.width / pv.height;
    const r = el.stage.getBoundingClientRect();
    if (r.width < 50) return;
    const maxW = Math.max(120, r.width - 48), maxH = Math.max(120, r.height - 48);
    let fw = maxW, fh = fw / ar; if (fh > maxH) { fh = maxH; fw = fh * ar; }
    const key = [sel.id, Math.round(fw), Math.round(fh), pv.width].join('|');
    el.frame.style.width = fw + 'px'; el.frame.style.height = fh + 'px';
    if (key === lastFit) return;
    lastFit = key;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.max(1, Math.round(Math.min(pv.width, fw * dpr))), ph = Math.max(1, Math.round(pw / ar));
    renderTo(el.cvA, pv, pw, ph, sel.stats, S, true);
    el.cvB.width = pw; el.cvB.height = ph;
    const bc = el.cvB.getContext('2d'); bc.imageSmoothingQuality = 'high'; bc.drawImage(pv, 0, 0, pw, ph);
  }
  function updateStage() {
    const none = items.length === 0;
    el.empty.hidden = !none; el.info.hidden = none; el.filmWrap.hidden = none;
    el.frame.hidden = none || !sel || sel.status !== 'ok';
    if (!sel) { el.name.textContent = ''; el.sub.textContent = ''; }
    const i = items.indexOf(sel);
    el.prev.disabled = i <= 0; el.next.disabled = i < 0 || i >= items.length - 1;
    el.remove.hidden = !sel || !!sel.sample;
  }
  new ResizeObserver(() => { lastFit = ''; schedulePreview(); }).observe(el.stage);
  $('#phSplit').addEventListener('input', e => el.frame.style.setProperty('--split', e.target.value + '%'));

  async function decode(path) {
    const blob = await B.readBlob(path);
    return createImageBitmap(blob);
  }
  async function ensurePreview(it) {
    if (it.preview) return;
    if (it.sample) { it.preview = it.full; return; }
    const bmp = await decode(it.path);
    it.preview = C.downscale(bmp, 1800); bmp.close && bmp.close();
    const k = lru.indexOf(it); if (k >= 0) lru.splice(k, 1);
    lru.push(it);
    while (lru.length > 6) { const o = lru.shift(); if (o !== sel) o.preview = null; }
  }
  async function select(it) {
    sel = it;
    items.forEach(x => { if (x.el) x.el.classList.toggle('on', x === it); });
    if (it.el) it.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.name.textContent = it.sample ? 'Muestra: carta de color (no se guarda)' : it.name;
    el.sub.textContent = (it.w ? `${it.w} × ${it.h} px · ` : '') + 'Desliza sobre la foto para comparar antes y después';
    lastFit = ''; renderStyleCards(); drawPreview();
    if (it.status !== 'ok') return;
    const tok = ++selTok;
    if (!it.preview) el.busy.hidden = false;
    try { await ensurePreview(it); } catch (e) { /* se queda la versión chica */ }
    if (tok !== selTok) return;
    el.busy.hidden = true; lastFit = ''; drawPreview();
  }
  const stepSel = dir => { const i = items.indexOf(sel) + dir; if (i >= 0 && i < items.length) select(items[i]); };
  el.prev.addEventListener('click', () => stepSel(-1));
  el.next.addEventListener('click', () => stepSel(1));
  el.remove.addEventListener('click', () => sel && removeItem(sel));
  SA.photos = { keyNav: dir => stepSel(dir) };

  /* ---------- Agregar ---------- */
  const queue = []; let pumping = false;
  async function addPaths(paths) {
    const list = await B.listMedia(paths);
    const imgs = list.filter(f => f.kind === 'image');
    const vids = list.filter(f => f.kind === 'video').length;
    if (!imgs.length) {
      toast(vids ? 'Aquí van fotos. Los videos se usan en las pestañas Save the Date y Videoclip XV.' : 'No encontré fotos en lo que agregaste. Usa archivos JPG o PNG.');
      return;
    }
    if (vids) toast(`Se dejaron fuera ${vids} ${vids === 1 ? 'video' : 'videos'}: úsalos en Save the Date o Videoclip XV.`);
    const s = items.find(i => i.sample);
    if (s) { s.el.remove(); items.splice(items.indexOf(s), 1); if (sel === s) sel = null; }
    const known = new Set(items.map(i => i.path));
    const news = imgs.filter(f => !known.has(f.path)).map(f => ({ id: ++uid, path: f.path, name: f.name, status: 'loading' }));
    items.push(...news); news.forEach(mountThumb); renumber(); updateCounts(); updateStage();
    el.done.hidden = true;
    queue.push(...news); pump();
  }
  async function pump() {
    if (pumping) return; pumping = true;
    while (queue.length) {
      const it = queue.shift();
      if (!items.includes(it)) continue;
      await loadItem(it); updateCounts();
    }
    pumping = false; updateCounts();
  }
  async function loadItem(it) {
    try {
      const bmp = await decode(it.path);
      it.w = bmp.width; it.h = bmp.height;
      it.src = C.downscale(bmp, 480); bmp.close && bmp.close();
      it.stats = C.computeStats(it.src); it.status = 'ok';
      renderThumb(it);
      if (!sel || !items.includes(sel) || sel.status !== 'ok') select(it);
    } catch (e) {
      it.status = 'error';
      const heic = /\.(heic|heif)$/i.test(it.name);
      const pick = it.el && it.el.querySelector('.pick');
      if (pick) pick.innerHTML = `<span class="ph err">${heic ? 'HEIC del iPhone: no se abre' : 'No se pudo abrir'}</span>`;
      if (heic) toast('Las fotos HEIC del iPhone no se abren todavía. En el iPhone: Ajustes › Cámara › Formatos › “Más compatible”, o pásalas como JPG.', 8000);
      if (sel === it) updateStage();
    }
  }
  function removeItem(it) {
    const i = items.indexOf(it); if (i < 0) return;
    items.splice(i, 1); if (it.el) it.el.remove();
    const q = queue.indexOf(it); if (q >= 0) queue.splice(q, 1);
    it.preview = it.src = it.tcv = null;
    if (sel === it) { sel = null; const nb = items[i] || items[i - 1]; if (nb) select(nb); }
    renumber(); updateCounts(); updateStage(); if (!items.length) renderStyleCards();
  }
  let clearArm = 0;
  el.clear.addEventListener('click', () => {
    if (!clearArm) {
      el.clear.textContent = '¿Seguro? Toca otra vez para quitarlas';
      clearArm = setTimeout(() => { clearArm = 0; el.clear.textContent = 'Quitar todas'; }, 4000);
      return;
    }
    clearTimeout(clearArm); clearArm = 0; el.clear.textContent = 'Quitar todas';
    realItems().forEach(it => { if (it.el) it.el.remove(); it.preview = it.src = null; });
    items = items.filter(i => i.sample); queue.length = 0; sel = null; lru.length = 0;
    renumber(); updateCounts(); updateStage(); renderStyleCards();
  });
  function updateCounts() {
    const real = realItems();
    const ok = real.filter(i => i.status === 'ok').length, ld = real.filter(i => i.status === 'loading').length, er = real.filter(i => i.status === 'error').length;
    let t;
    if (!real.length) t = items.length ? 'Estás viendo una muestra. Agrega tus fotos para empezar.' : 'Todavía no hay fotos.';
    else {
      t = ld ? `Cargando ${ok + er} de ${real.length}…` : `${ok} ${ok === 1 ? 'foto lista' : 'fotos listas'}`;
      if (er) t += ` · ${er} no se ${er === 1 ? 'pudo' : 'pudieron'} abrir`;
    }
    el.count.textContent = t;
    el.clear.hidden = !real.length;
    if (!saving) {
      el.save.disabled = !ok || ld > 0;
      el.save.textContent = ld ? 'Cargando fotos…' : ok ? `Guardar ${ok} ${ok === 1 ? 'foto' : 'fotos'}` : 'Agrega fotos para guardar';
    }
  }
  $('#phAdd').addEventListener('click', async () => { const p = await B.pick('images', true); if (p.length) addPaths(p); });
  $('#phAdd2').addEventListener('click', async () => { const p = await B.pick('images', true); if (p.length) addPaths(p); });
  $('#phFolder').addEventListener('click', async () => { const p = await B.pickFolder(); if (p) addPaths([p]); });

  /* ---------- Destino ---------- */
  function destDir() {
    if (customDir) return customDir;
    const name = B.safeName(el.event.value) || 'Fotos';
    return B.join(B.paths.documents, 'Saucedo', `${SA.ui.todayISO()} ${name}`);
  }
  function showDest() {
    const d = destDir();
    const docs = B.paths.documents;
    el.dest.textContent = d.startsWith(docs) ? 'Documentos' + d.slice(docs.length).split(/[\\/]/).join(' › ') : d;
  }
  el.event.addEventListener('input', () => { customDir = null; showDest(); });
  $('#phChange').addEventListener('click', async () => { const p = await B.pickFolder(destDir()); if (p) { customDir = p; showDest(); } });
  $('#phOpen').addEventListener('click', () => lastDir && B.open(lastDir));

  /* ---------- Guardar ---------- */
  function uniqueName(name, used) {
    const base = name.replace(/\.[^.]+$/, '') + '-saucedo';
    let n = base + '.jpg', k = 2;
    while (used.has(n.toLowerCase())) n = `${base}-${k++}.jpg`;
    used.add(n.toLowerCase()); return n;
  }
  $('#phCancel').addEventListener('click', () => { if (saving) { saving.cancel = true; el.progText.textContent = 'Cancelando…'; } });
  el.save.addEventListener('click', async () => {
    const list = realItems().filter(i => i.status === 'ok');
    if (!list.length || saving) return;
    const cfg = Object.assign({}, S), dir = destDir();
    saving = { cancel: false };
    el.save.disabled = true; el.save.textContent = 'Guardando…'; el.progress.hidden = false; el.done.hidden = true;
    const used = new Set(); let done = 0;
    const setP = () => { el.progText.textContent = `Guardando ${done} de ${list.length}…`; el.bar.style.width = (done / list.length * 100) + '%'; };
    setP();
    try {
      await B.mkdir(dir);
      for (const it of list) {
        if (saving.cancel) break;
        const bmp = await decode(it.path);
        const c = document.createElement('canvas');
        renderTo(c, bmp, bmp.width, bmp.height, it.stats, cfg, true);
        bmp.close && bmp.close();
        const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('No se pudo crear el JPG')), 'image/jpeg', .92));
        c.width = c.height = 0;
        await B.writeBlob(B.join(dir, uniqueName(it.name, used)), blob);
        done++; setP();
        await new Promise(r => setTimeout(r, 0));
      }
      lastDir = dir; el.done.hidden = done === 0;
      const fw = done === 1 ? 'foto' : 'fotos';
      toast(saving.cancel ? `Se canceló. Alcanzaron a guardarse ${done} ${fw}.` : `Listo: ${done} ${fw} guardadas.`, 6000);
    } catch (e) {
      SA.showError('No se pudieron guardar las fotos. Revisa que la carpeta exista y que haya espacio en el disco.', String(e && e.message || e));
    } finally {
      saving = null; el.progress.hidden = true; updateCounts();
    }
  });

  /* ---------- Marca de agua (compartida con los videos) ---------- */
  const wmSwitch = $('#wmSwitch'), wmState = $('#wmState'), wmFields = $('#wmFields'), wmPos = $('#wmPos');
  SA.POS.forEach(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = key; b.setAttribute('aria-label', label); b.title = label;
    b.addEventListener('click', () => { S.pos = key; syncBrand(); SA.brandChanged(); });
    wmPos.appendChild(b);
  });
  SA.ui.seg($('#wmSize'), S.size, v => { S.size = v; syncBrand(); SA.brandChanged(); });
  SA.ui.seg($('#wmAlpha'), S.alpha, v => { S.alpha = v; syncBrand(); SA.brandChanged(); });
  wmSwitch.addEventListener('click', () => { S.wm = !S.wm; syncBrand(); SA.brandChanged(); });
  function showLogo() {
    const p = $('#logoPrev'); p.textContent = '';
    if (SA.logo) { const im = document.createElement('img'); im.src = SA.logo.src; im.alt = 'Logo actual'; p.appendChild(im); }
    else { const s = document.createElement('span'); s.className = 'txt'; s.textContent = 'Saucedo'; p.appendChild(s); }
    $('#btnLogo').textContent = SA.logo ? 'Cambiar logo' : 'Subir logo (PNG)';
    $('#btnLogoOff').hidden = !SA.logo;
  }
  function syncBrand() {
    wmSwitch.setAttribute('aria-checked', S.wm); wmState.textContent = S.wm ? 'Encendida: va en todas las fotos y videos' : 'Apagada: salen sin marca';
    wmFields.disabled = !S.wm;
    wmPos.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === S.pos)));
    SA.ui.setSeg($('#wmSize'), S.size); SA.ui.setSeg($('#wmAlpha'), S.alpha);
    showLogo();
  }
  SA.onBrandChange(syncBrand);
  $('#btnLogo').addEventListener('click', async () => {
    const p = await B.pick('logo', false);
    if (!p.length) return;
    try { $('#logoHint').textContent = await SA.loadLogoFromPath(p[0]); }
    catch (e) { toast('No se pudo abrir ese archivo como logo. Usa el logo en PNG.'); }
  });
  $('#btnLogoOff').addEventListener('click', () => { SA.removeLogo(); $('#logoHint').textContent = 'Se pone el nombre en letra. Puedes subir el logo cuando quieras.'; });

  /* ---------- Inicio ---------- */
  SA.photos.addPaths = addPaths;
  SA.photos.init = () => {
    const full = makeSample();
    const sample = { id: 0, sample: true, name: 'muestra', status: 'ok', w: full.width, h: full.height, full, preview: full };
    sample.src = C.downscale(full, 480); sample.stats = C.computeStats(sample.src);
    items.push(sample); mountThumb(sample); renumber();
    syncUI(); syncBrand(); updateCounts(); showDest();
    if (SA.logo) $('#logoHint').textContent = 'Usando el logo guardado.';
    renderThumb(sample); select(sample);
  };
  SA.photos.refresh = () => { lastFit = ''; schedulePreview(); };
})();
