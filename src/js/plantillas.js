/* Pestaña Plantillas: galería estilo CapCut y editor de la plantilla elegida. */
(function () {
  'use strict';
  const SA = window.SA, A = SA.anim;
  const { $$, esc, toast } = SA.ui;
  const B = SA.bridge, E = window.Engine, C = SA.color, S = SA.settings;
  const fmt = s => E.fmtTime(s);
  const DUR_LABEL = v => v === 'full' ? 'Toda la canción' : v >= 60 ? `${v / 60} min` : `${v} s`;
  const LEVEL = { Simple: 'Simple', Pro: 'Elaborada' };
  const THEME = key => Object.assign({ key }, SA.cards.THEMES[key] || SA.cards.THEMES.blanco);

  class Plantillas {
    constructor(root) {
      this.root = root; this.cat = 'todas'; this.tpl = null; this.media = []; this.sel = null; this.uid = 0;
      this.song = null; this.beat = null; this.queue = []; this.pumping = false; this.busy = false;
      this.which = 'intro'; this.playing = true; this.pt = 0;
      this.store = {}; try { this.store = JSON.parse(localStorage.getItem('saucedo-plantillas') || '{}'); } catch (e) {}
      this.build(); this.bind(); this.renderGallery();
      new ResizeObserver(() => this.sizePreview()).observe(this.q('stage'));
      SA.onBrandChange(() => { this.syncStyle(); });
    }
    q(n) { return this.root.querySelector(`[data-el="${n}"]`); }

    build() {
      this.root.innerHTML = `
      <div class="tpl-gallery" data-el="gallery">
        <div class="tg-head">
          <div><h2 class="tg-t">Plantillas</h2><p class="tg-sub">Elige una: cada plantilla ya trae su música. Después agregas tus fotos y videos, escribes los textos y el programa arma el video.</p></div>
          <div class="chips" data-el="cats" role="radiogroup" aria-label="Tipo de plantilla">${SA.TPL_CATS.map(([k, n]) => `<button type="button" class="chip" data-v="${k}">${n}</button>`).join('')}</div>
        </div>
        <div class="tg-grid" data-el="grid"></div>
      </div>
      <div class="tpl-editor work" data-el="editor" hidden>
        <aside class="steps" aria-label="Pasos de la plantilla">
          <div class="tpl-name"><button class="link" type="button" data-act="back">‹ Todas las plantillas</button><h2 data-el="tplName"></h2><p class="hint" data-el="tplDesc"></p></div>
          <section class="step">
            <h2><span class="num">1</span>Fotos y videos</h2>
            <button class="drop" type="button" data-act="add"><strong>Agregar fotos y videos</strong><span>o arrástralos a esta ventana</span></button>
            <div class="links"><button class="link" type="button" data-act="folder">Elegir una carpeta completa</button><button class="link danger" type="button" data-act="clear" hidden>Quitar todos</button></div>
            <p class="count" data-el="count" aria-live="polite"></p>
            <p class="hint" data-el="tplNote" hidden></p>
          </section>
          <section class="step">
            <h2><span class="num">2</span>Textos</h2>
            <div class="fields" data-el="fields"></div>
            <div class="field"><span class="lbl">Color de las letras</span><div class="chips" data-el="theme" role="radiogroup">${Object.entries(SA.cards.THEMES).map(([k, v]) => `<button type="button" class="chip" data-v="${k}"><span class="sw" style="background:${v.accent}"></span>${v.name}</button>`).join('')}</div></div>
          </section>
          <section class="step">
            <h2><span class="num">3</span>Música</h2>
            <div class="mcard" data-el="mcard"></div>
            <div class="field" data-el="startBox" hidden><span class="lbl">La canción empieza en</span>
              <div class="stepper"><button type="button" data-act="ssMinus">−5 s</button><output data-el="ss">0:00</output><button type="button" data-act="ssPlus">+5 s</button></div>
              <p class="hint" data-el="ssHint" hidden>Empieza en la mejor parte de la canción.</p></div>
            <div class="sw-row" data-el="beatRow" hidden><button class="switch" type="button" role="switch" data-act="beatOn" data-el="beatOn" aria-labelledby="tBeat"></button><span class="sw-state" id="tBeat" data-el="beatTxt"></span></div>
            <div class="field" data-el="durBox" hidden><span class="lbl">Duración del video</span><div class="seg" data-el="target"></div></div>
          </section>
          <section class="step">
            <h2><span class="num">4</span>Formato</h2>
            <div class="chips" data-el="formats" role="group" aria-label="Formatos">${Object.entries(E.FORMATS).map(([k, v]) => `<button type="button" class="chip fmt" data-v="${k}"><span class="ar ar-${k}"></span>${v.label}</button>`).join('')}</div>
            <p class="hint">Puedes elegir varios: se crea un video de cada uno.</p>
            <button class="big" type="button" data-act="enhance"><span class="t">Mejorar colores</span><span class="pill" data-el="enhState">Activado</span></button>
            <div class="sw-row"><button class="switch" type="button" role="switch" data-act="wm" data-el="wm" aria-labelledby="tWm"></button><span class="sw-state" id="tWm" data-el="wmTxt"></span></div>
            <div class="field" data-el="wmSizeBox"><span class="lbl">Tamaño del logo</span><div class="seg" data-el="wmSize" role="radiogroup" aria-label="Tamaño del logo"><button type="button" data-v="s">Chico</button><button type="button" data-v="m">Mediano</button><button type="button" data-v="l">Grande</button></div></div>
          </section>
          <section class="step">
            <h2><span class="num">5</span>Crear video</h2>
            <p class="summary" data-el="summary"></p>
            <button class="primary" type="button" data-act="create" data-el="create">Crear video</button>
            <div class="progress" data-el="progress" hidden>
              <div class="prog-row"><span data-el="progText">Preparando…</span><button class="link" type="button" data-act="cancel">Cancelar</button></div>
              <div class="bar"><i data-el="bar"></i></div>
              <p class="prog-sub" data-el="progSub"></p>
            </div>
            <div class="done-row" data-el="done" hidden><button class="btn" type="button" data-act="watch">Ver video</button><button class="btn" type="button" data-act="openDir">Abrir la carpeta</button></div>
          </section>
        </aside>
        <section class="mesa" aria-label="Vista previa">
          <div class="stage" data-el="stage">
            <div class="pv-wrap">
              <canvas data-el="pv" aria-label="Vista previa animada"></canvas>
              <div class="pv-bar">
                <div class="pv-tabs" role="radiogroup" data-el="which"><button type="button" data-v="intro">Inicio</button><button type="button" data-v="outro">Final</button></div>
                <button class="navbtn" type="button" data-act="play" data-el="playBtn">❚❚ Pausa</button>
              </div>
            </div>
          </div>
          <div class="info">
            <div class="meta"><span class="name" data-el="selName"></span><span class="sub" data-el="selSub"></span></div>
            <div class="order" data-el="order" hidden><button class="navbtn" type="button" data-act="left">‹ Antes</button><button class="navbtn" type="button" data-act="right">Después ›</button><button class="navbtn" type="button" data-act="remove">Quitar</button></div>
          </div>
          <div class="film-wrap"><div class="film" data-el="film" aria-label="Fotos y videos en orden"></div></div>
        </section>
      </div>`;
    }

    bind() {
      const R = this.root;
      R.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || !R.contains(b)) return;
        const fn = this['act_' + b.dataset.act];
        if (fn) fn.call(this, b, e);
      });
      SA.ui.seg(this.q('cats'), this.cat, v => { this.cat = v; SA.ui.setSeg(this.q('cats'), v); this.renderGallery(); });
      SA.ui.seg(this.q('theme'), '', v => { this.st.theme = v; this.changed(); });
      SA.ui.seg(this.q('which'), this.which, v => { this.which = v; this.pt = 0; SA.ui.setSeg(this.q('which'), v); });
      SA.ui.seg(this.q('wmSize'), S.size || 'm', v => { S.size = v; SA.brandChanged(); });
      $$('.fmt', this.q('formats')).forEach(b => b.addEventListener('click', () => {
        const set = new Set(this.st.formats); set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
        if (!set.size) { toast('Elige por lo menos un formato.'); return; }
        this.st.formats = [...set]; this.changed(); this.sizePreview();
      }));
    }

    /* ================= Galería ================= */
    renderGallery() {
      SA.ui.setSeg(this.q('cats'), this.cat);
      const list = SA.TEMPLATES.filter(t => this.cat === 'todas' || t.cats.includes(this.cat));
      const grid = this.q('grid');
      grid.innerHTML = list.map(t => `<button class="tcard" type="button" data-act="pick" data-id="${t.id}">
        <canvas width="216" height="384" aria-hidden="true"></canvas>
        <span class="tc-body"><span class="tc-top"><strong>${esc(t.name)}</strong><span class="tc-lvl ${t.level === 'Pro' ? 'pro' : ''}">${LEVEL[t.level]}</span></span>
        <span class="tc-desc">${esc(t.desc)}</span>${this.musicName(t) ? `<span class="tc-music">♪ ${esc(this.musicName(t))}</span>` : ''}</span></button>`).join('');
      $$('.tcard', grid).forEach((card, i) => {
        const t = SA.TEMPLATES.find(x => x.id === card.dataset.id), cv = card.querySelector('canvas');
        this.drawCard(cv, t, 2.4, i);
        let raf = 0, t0 = 0;
        card.addEventListener('mouseenter', () => { t0 = performance.now(); const loop = now => { const tt = ((now - t0) / 1000) % (t.intro + .5); this.drawCard(cv, t, tt, i); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); });
        card.addEventListener('mouseleave', () => { cancelAnimationFrame(raf); this.drawCard(cv, t, 2.4, i); });
      });
    }
    musicName(t) { const m = t.music && SA.music.available() && SA.music.get(t.music[0]); return m ? m.name : ''; }
    sample(W, H, i) { this.samples = this.samples || {}; const k = `${W}x${H}x${i % 4}`; return this.samples[k] || (this.samples[k] = A.sampleBg(W, H, i % 4)); }
    tplData(t) {
      const d = {}; t.fields.forEach(f => { d[f.key] = f.def || f.ph || ''; });
      d.date = SA.ui.parseDate(d.date) || { y: new Date().getFullYear() + 1, m: 5, d: 20 };
      return d;
    }
    drawCard(cv, t, time, i) {
      const W = cv.width, H = cv.height, ctx = cv.getContext('2d');
      ctx.save(); ctx.clearRect(0, 0, W, H);
      const bgSrc = this.media.find(m => m.status === 'ok');
      if (t.still === 'polaroid') SA.tpl.polaroid(ctx, bgSrc ? bgSrc.thumb : this.sample(W, H, i), W, H, 0, t.fields[0] && (t.fields[0].ph || t.fields[0].def));
      else if (t.still === 'collage') { const th = this.media.filter(m => m.status === 'ok' && m.kind === 'image').slice(0, 3).map(m => m.thumb); SA.tpl.collage(ctx, th.length ? th : [0, 1, 2].map(k => this.sample(W, H, i + k)), W, H, 0); }
      else { if (t.preview) ctx.filter = t.preview; C.drawFit(ctx, bgSrc ? bgSrc.thumb : this.sample(W, H, i), W, H, 'cover', 1.02); ctx.filter = 'none'; }
      this.drawLayers(ctx, W, H, t, 'intro', time, this.tplData(t), THEME(t.theme));
      ctx.restore();
    }
    // Dibuja las capas de la plantilla (las fijas de todo el video + la de inicio o final) en el tiempo t.
    drawLayers(ctx, W, H, t, which, time, data, th) {
      if (t.vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (t.grain) this.grain(ctx, W, H);
      t.layers.filter(l => l.at === 'all').forEach(l => { if (!l.blink || Math.floor(time * 2) % 2 === 0) l.d.draw(ctx, W, H, time, 999, data, th); });
      const ly = t.layers.find(l => l.at === which);
      if (ly) {
        const dur = which === 'intro' ? t.intro + t.T * .5 : t.outro;
        const c = this._lc && this._lc.width === W && this._lc.height === H ? this._lc : (this._lc = Object.assign(document.createElement('canvas'), { width: W, height: H }));
        const lx = c.getContext('2d'); lx.clearRect(0, 0, W, H); lx.save();
        ly.d.draw(lx, W, H, ly.d.static ? 3 : Math.min(time, dur), dur, data, th); lx.restore();
        // Los textos fijos aparecen con fundido (como en el video)
        ctx.save(); if (ly.d.static) ctx.globalAlpha = A.prog(time, 0, .5); ctx.drawImage(c, 0, 0); ctx.restore();
      }
    }
    grain(ctx, W, H) {
      if (!this.noise) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), id = x.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; } x.putImageData(id, 0, 0); this.noise = c; }
      ctx.save(); ctx.fillStyle = ctx.createPattern(this.noise, 'repeat'); ctx.translate(Math.random() * 128, Math.random() * 128); ctx.fillRect(-128, -128, W + 256, H + 256); ctx.restore();
    }

    /* ================= Editor ================= */
    act_pick(b) {
      const t = SA.TEMPLATES.find(x => x.id === b.dataset.id); if (!t) return;
      this.tpl = t;
      const saved = this.store[t.id] || {};
      this.st = { theme: saved.theme || t.theme, formats: saved.formats || ['v'], enhance: saved.enhance != null ? saved.enhance : true, target: saved.target || (t.durations ? t.durations[0] : null), beatOn: true, songStart: 0, values: {} };
      t.fields.forEach(f => { this.st.values[f.key] = (saved.values && saved.values[f.key] != null && !['title', 'date', 'extra'].includes(f.key)) ? saved.values[f.key] : (f.def || ''); });
      this.q('gallery').hidden = true; this.q('editor').hidden = false;
      this.q('tplName').textContent = t.name; this.q('tplDesc').textContent = t.desc;
      this.q('tplNote').hidden = !t.note; this.q('tplNote').textContent = t.note || '';
      this.q('fields').innerHTML = t.fields.map(f => `<label class="field"><span class="lbl">${esc(f.label)}</span><input class="input" data-f="${f.key}" type="${f.type === 'date' ? 'date' : 'text'}" placeholder="${esc(f.ph || '')}" value="${esc(this.st.values[f.key] || '')}" autocomplete="off"></label>`).join('');
      $$('[data-f]', this.q('fields')).forEach(inp => inp.addEventListener('input', () => { this.st.values[inp.dataset.f] = inp.value; this.save(); this.summary(); }));
      const tg = this.q('target');
      this.q('durBox').hidden = t.mode !== 'song';
      tg.innerHTML = (t.durations || []).map(v => `<button type="button" data-v="${v}">${DUR_LABEL(v)}</button>`).join('');
      SA.ui.seg(tg, String(this.st.target), v => { this.st.target = v === 'full' ? 'full' : +v; this.changed(); });
      this.q('done').hidden = true;
      this.pickSong(t, saved.song);
      this.syncStyle(); this.summary(); this.sizePreview(); this.startPreview();
      this.root.querySelector('.tpl-editor .steps').scrollTop = 0;
    }
    act_back() { this.stopPreview(); this.stopListen(); SA.music.stop(); this.q('editor').hidden = true; this.q('gallery').hidden = false; this.renderGallery(); }
    save() {
      const { theme, formats, enhance, target, values, song } = this.st;
      this.store[this.tpl.id] = { theme, formats, enhance, target, values, song };
      try { localStorage.setItem('saucedo-plantillas', JSON.stringify(this.store)); } catch (e) {}
    }
    changed() { this.save(); this.syncStyle(); this.summary(); }
    syncStyle() {
      if (!this.tpl) return;
      SA.ui.setSeg(this.q('theme'), this.st.theme);
      SA.ui.setSeg(this.q('target'), String(this.st.target));
      $$('.fmt', this.q('formats')).forEach(b => b.setAttribute('aria-pressed', String(this.st.formats.includes(b.dataset.v))));
      const enh = this.root.querySelector('[data-act="enhance"]');
      enh.setAttribute('aria-pressed', String(this.st.enhance)); this.q('enhState').textContent = this.st.enhance ? 'Activado' : 'Apagado';
      this.q('wm').setAttribute('aria-checked', String(S.wm));
      this.q('wmSizeBox').hidden = !S.wm; SA.ui.setSeg(this.q('wmSize'), S.size || 'm');
      this.q('wmTxt').textContent = S.wm ? `Logo en cada toma (${S.wmColor === 'negro' ? 'negro' : S.wmColor === 'blanco' ? 'blanco' : 'negro o blanco según el fondo'})` : 'Sin logo';
      this.q('beatOn').setAttribute('aria-checked', String(this.st.beatOn));
    }
    act_enhance() { this.st.enhance = !this.st.enhance; this.changed(); }
    act_wm() { S.wm = !S.wm; SA.brandChanged(); this.syncStyle(); }
    act_beatOn() { this.st.beatOn = !this.st.beatOn; this.syncStyle(); this.summary(); }
    act_play() { this.playing = !this.playing; this.q('playBtn').textContent = this.playing ? '❚❚ Pausa' : '▶ Reproducir'; }

    data(forPreview) {
      const v = this.st.values, d = {};
      this.tpl.fields.forEach(f => { d[f.key] = (v[f.key] || '').trim() || (forPreview && f.type !== 'date' ? (f.def || f.ph || '') : ''); });
      d.date = SA.ui.parseDate(v.date) || (forPreview ? this.tplData(this.tpl).date : null);
      return d;
    }

    /* ---------- Fotos y videos ---------- */
    act_add() { B.pick('media', true).then(p => p.length && this.addPaths(p)); }
    act_folder() { B.pickFolder().then(p => p && this.addPaths([p])); }
    async addPaths(paths) {
      if (!this.tpl) { toast('Primero elige una plantilla.'); return; }
      const list = await B.listMedia(paths);
      const audio = list.filter(f => f.kind === 'audio');
      const vis = list.filter(f => f.kind === 'image' || f.kind === 'video');
      if (audio.length) this.setSong(audio[0].path);
      if (!vis.length) { if (!audio.length) toast('No encontré fotos ni videos en lo que agregaste.'); return; }
      const known = new Set(this.media.map(m => m.path));
      const news = vis.filter(f => !known.has(f.path)).map(f => ({ id: ++this.uid, path: f.path, name: f.name, kind: f.kind, status: 'loading' }));
      news.forEach(m => { this.media.push(m); this.mount(m); });
      this.renumber(); this.counts(); this.q('done').hidden = true;
      this.queue.push(...news); this.pump();
    }
    async pump() {
      if (this.pumping) return; this.pumping = true;
      while (this.queue.length) { const m = this.queue.shift(); if (this.media.includes(m)) { await this.load(m); this.counts(); } }
      this.pumping = false; this.counts();
    }
    async thumbDirPath() { if (!this.thumbDir) this.thumbDir = await B.newJobDir(); return this.thumbDir; }
    async load(m) {
      try {
        let bmp;
        if (m.kind === 'image') { bmp = await createImageBitmap(await B.readBlob(m.path)); m.w = bmp.width; m.h = bmp.height; }
        else {
          const p = await B.probe(m.path);
          if (!p.hasVideo) throw new Error('sin video');
          m.w = p.width; m.h = p.height; m.duration = p.duration;
          const out = B.join(await this.thumbDirPath(), `cuadro_${m.id}.jpg`);
          let r = await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-ss', String(Math.min(1, p.duration * .3)), '-i', m.path, '-frames:v', '1', '-vf', 'scale=480:-2', out]);
          if (r.code !== 0 || !(await B.exists(out))) await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-i', m.path, '-frames:v', '1', '-vf', 'scale=480:-2', out]);
          bmp = await createImageBitmap(await B.readBlob(out, 'image/jpeg'));
        }
        m.thumb = C.downscale(bmp, 480); bmp.close && bmp.close();
        m.status = 'ok';
      } catch (e) {
        m.status = 'error';
        m.err = /\.(heic|heif)$/i.test(m.name) ? 'HEIC del iPhone: no se abre' : m.kind === 'video' ? 'Este video no se pudo leer' : 'No se pudo abrir';
      }
      this.paint(m);
      if (!this.sel || this.sel.status !== 'ok') this.select(m);
    }
    mount(m) {
      const w = document.createElement('div'); w.className = 'thumb';
      w.innerHTML = '<span class="n"></span><button type="button" class="pick"><span class="ph">Cargando…</span></button><button type="button" class="x" aria-label="Quitar" title="Quitar">×</button>';
      w.querySelector('.pick').addEventListener('click', () => this.select(m));
      w.querySelector('.x').addEventListener('click', () => this.remove(m));
      m.el = w; this.q('film').appendChild(w);
    }
    paint(m) {
      const pick = m.el.querySelector('.pick'); pick.textContent = '';
      if (m.status !== 'ok') { pick.innerHTML = `<span class="ph err">${esc(m.err || 'No se pudo abrir')}</span>`; return; }
      const c = document.createElement('canvas'); c.width = m.thumb.width; c.height = m.thumb.height; c.getContext('2d').drawImage(m.thumb, 0, 0); pick.appendChild(c);
      if (m.kind === 'video') { const d = document.createElement('span'); d.className = 'dur'; d.textContent = fmt(m.duration); pick.appendChild(d); }
    }
    renumber() {
      this.media.forEach((m, i) => { m.el.querySelector('.n').innerHTML = `${String(i + 1).padStart(2, '0')} ▸ <span class="kind">${m.kind === 'video' ? 'VIDEO' : 'FOTO'}</span>`; this.q('film').appendChild(m.el); });
    }
    select(m) {
      this.sel = m;
      this.media.forEach(x => x.el.classList.toggle('on', x === m));
      if (m && m.el) m.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const i = this.media.indexOf(m);
      this.q('order').hidden = !m;
      this.q('selName').textContent = m ? m.name : 'Agrega fotos y videos para verlos en la vista previa.';
      this.q('selSub').textContent = m && m.status === 'ok' ? `${m.kind === 'video' ? `Video de ${fmt(m.duration)}` : 'Foto'} · lugar ${i + 1} de ${this.media.length}` : '';
    }
    keyNav(dir) { const i = this.media.indexOf(this.sel) + dir; if (i >= 0 && i < this.media.length) this.select(this.media[i]); }
    act_left() { this.move(-1); }
    act_right() { this.move(1); }
    move(dir) {
      const i = this.media.indexOf(this.sel), j = i + dir;
      if (i < 0 || j < 0 || j >= this.media.length) return;
      [this.media[i], this.media[j]] = [this.media[j], this.media[i]];
      this.renumber(); this.select(this.sel); this.summary();
    }
    act_remove() { if (this.sel) this.remove(this.sel); }
    remove(m) {
      const i = this.media.indexOf(m); if (i < 0) return;
      this.media.splice(i, 1); m.el.remove();
      if (this.sel === m) this.select(this.media[i] || this.media[i - 1] || null);
      this.renumber(); this.counts();
    }
    act_clear(b) {
      if (!this.clearArm) { b.textContent = '¿Seguro? Toca otra vez'; this.clearArm = setTimeout(() => { this.clearArm = 0; b.textContent = 'Quitar todos'; }, 4000); return; }
      clearTimeout(this.clearArm); this.clearArm = 0; b.textContent = 'Quitar todos';
      this.media.forEach(m => m.el.remove()); this.media = []; this.queue.length = 0; this.select(null); this.counts();
    }
    okMedia() {
      const ok = this.media.filter(m => m.status === 'ok');
      return this.tpl && this.tpl.still === 'antesdespues' ? ok.filter(m => m.kind === 'image') : ok;
    }
    counts() {
      const ok = this.media.filter(m => m.status === 'ok'), ld = this.media.filter(m => m.status === 'loading').length, er = this.media.filter(m => m.status === 'error').length;
      const fotos = ok.filter(m => m.kind === 'image').length, vids = ok.length - fotos;
      let t = !this.media.length ? 'Todavía no hay fotos ni videos.' : ld ? `Cargando ${this.media.length - ld} de ${this.media.length}…`
        : [fotos && `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`, vids && `${vids} ${vids === 1 ? 'video' : 'videos'}`].filter(Boolean).join(' y ') || 'Nada listo todavía';
      if (er) t += ` · ${er} no se ${er === 1 ? 'pudo' : 'pudieron'} abrir`;
      this.q('count').textContent = t;
      this.root.querySelector('[data-act="clear"]').hidden = !this.media.length;
      this.summary();
    }

    /* ---------- Música y ritmo ---------- */
    // Cada plantilla trae su canción sugerida (como en CapCut); si ya se eligió otra, se respeta.
    pickSong(t, saved) {
      this.stopListen(); this.song = null; this.beat = null; this.st.song = null;
      if (saved === 'none') { this.st.song = 'none'; }
      else if (saved && saved.builtin && SA.music.get(saved.builtin) && this.useBuiltin(saved.builtin, true)) { /* listo */ }
      else if (saved && saved.path) { this.setSong(saved.path, true).then(ok => { if (!ok && this.tpl === t) this.defaultSong(t); }); }
      else this.defaultSong(t);
      this.renderSong();
    }
    defaultSong(t) { if (t.music && SA.music.available()) this.useBuiltin(t.music[0], true); else this.renderSong(); }
    async act_song() {
      const t = this.tpl; this.stopListen();
      const r = await SA.music.pick({ title: 'Música del video', forName: t.name, suggest: t.music || [], current: this.song, allowNone: true, noneLabel: 'Hacer el video sin música' });
      if (!r) return;
      if (r.kind === 'builtin') this.useBuiltin(r.id);
      else if (r.kind === 'file') this.setSong(r.path);
      else this.act_songOff();
    }
    act_songOff() { this.stopListen(); this.song = null; this.beat = null; this.st.song = 'none'; this.save(); this.renderSong(); this.syncStyle(); this.summary(); }
    useBuiltin(id, quiet) {
      const s = SA.music.song(id); if (!s) return false;
      this.stopListen();
      this.song = s; this.beat = s.beat; this.st.song = { builtin: id }; this.st.startAuto = true; this.st.songStart = 0;
      this.renderSong(); this.syncStyle(); this.summary(); this.save();
      return true;
    }
    async setSong(path, quiet) {
      this.stopListen();
      try {
        const p = await B.probe(path);
        if (!p.hasAudio || !p.duration) throw new Error('sin audio');
        this.song = { path, name: B.baseName(path), duration: p.duration }; this.beat = null;
        this.st.songStart = 0; this.st.startAuto = false; this.st.song = { path };
        this.save(); this.renderSong(); this.setStart(0); this.summary();
        this.detectBeat(this.song);
        return true;
      } catch (e) { if (!quiet) toast('No se pudo leer esa canción. Prueba con un MP3 o M4A.'); return false; }
    }
    renderSong() {
      const el = this.q('mcard'); if (!el) return;
      const s = this.song;
      el.classList.toggle('empty', !s);
      el.innerHTML = s ? `<button class="mplay" type="button" data-act="listen" aria-label="Escuchar la canción"><span class="ic">▶</span></button>
          <div class="minfo"><div class="mname">${esc(s.name)}</div><div class="mdesc">${esc(SA.music.sub(s))}</div></div>
          <div class="mcard-actions" style="grid-column:2"><button class="btn" type="button" data-act="song">Cambiar música</button><button class="link danger" type="button" data-act="songOff">Quitar</button></div>`
        : `<div class="minfo"><div class="mname">Sin música</div><div class="mdesc">El video saldrá sin sonido.</div></div>
          <div class="mcard-actions"><button class="btn" type="button" data-act="song">Elegir música</button></div>`;
      this.q('startBox').hidden = !s;
      this.q('ss').textContent = fmt(this.st.songStart || 0);
      this.q('ssHint').hidden = !(s && s.builtin && this.st.startAuto && this.st.songStart > 0);
      this.q('beatRow').hidden = !(s && this.beat && this.tpl.beats);
      if (this.beat) this.q('beatTxt').textContent = `Cortes al ritmo de la canción (${Math.round(this.beat.bpm)} golpes por minuto)`;
    }
    // Encuentra el ritmo de la canción para que los cortes caigan en los golpes.
    async detectBeat(song) {
      try {
        const out = B.join(await this.thumbDirPath(), `ritmo_${E.hash(song.path)}.raw`);
        const r = await B.run('ffmpeg', E.songDecodeArgs(song.path, 0, Math.min(song.duration, 420), out));
        if (r.code !== 0 || this.song !== song) return;
        const buf = await (await B.readBlob(out)).arrayBuffer();
        const info = E.detectBeats(new Float32Array(buf), 11025);
        if (!info || this.song !== song) return;
        this.beat = info;
        this.renderSong(); this.syncStyle(); this.summary();
      } catch (e) { /* sin ritmo: se usan los tiempos de la plantilla */ }
    }
    beatFor() {
      if (!this.beat || !this.st.beatOn || !this.tpl.beats) return null;
      const s = this.st.songStart, next = this.beat.beats.find(b => b >= s - .02);
      return next == null ? null : { period: this.beat.period, offset: Math.max(0, next - s) };
    }
    // En un vals (3 tiempos) los cortes van cada compás o cada dos.
    beatsPerShot() { const k = this.tpl.beats; return this.beat && this.beat.meter === 3 && k ? (k >= 8 ? 6 : 3) : k; }
    act_ssMinus() { this.st.startAuto = false; this.setStart(this.st.songStart - 5); }
    act_ssPlus() { this.st.startAuto = false; this.setStart(this.st.songStart + 5); }
    setStart(s) {
      if (!this.song) return;
      this.st.songStart = Math.max(0, Math.min(Math.floor(this.song.duration - 10), s));
      this.q('ss').textContent = fmt(this.st.songStart);
      this.q('ssHint').hidden = true;
      this.summary();
    }
    // Para videos cortos con música incluida: empezar en la mejor parte (el coro).
    autoStart() {
      if (!this.song || !this.song.builtin || !this.st.startAuto) return;
      let len;
      if (this.tpl.mode === 'song') len = this.st.target === 'full' ? 9999 : (+this.st.target || 60);
      else { if (!this.okMedia().length) return; try { len = this.planAt(0).total; } catch (e) { return; } }
      const st = len <= 60 ? SA.music.bestStart(this.song.builtin, len) : 0;
      if (Math.abs(st - this.st.songStart) > .01) {
        this.st.songStart = st;
        this.q('ss').textContent = fmt(st);
      }
      this.q('ssHint').hidden = !(st > 0);
    }
    async act_listen() {
      if (SA.music.playing()) { SA.music.stop(); return; }
      if (!this.song) return;
      const icon = on => { const i = this.root.querySelector('.mcard .ic'); if (i) i.textContent = on ? '■' : '▶'; };
      if (await SA.music.play(this.song, this.st.songStart, () => icon(false))) icon(true);
    }
    stopListen() { SA.music.stop(); }

    /* ---------- Resumen ---------- */
    target() {
      const t = this.tpl;
      if (t.mode !== 'song') return 0;
      const avail = this.song ? Math.max(15, this.song.duration - this.st.songStart) : 60;
      return this.st.target === 'full' ? avail : Math.min(+this.st.target || 60, avail);
    }
    expanded() {
      const ok = this.okMedia();
      if (this.tpl.still === 'collage') {   // fotos de 3 en 3; los videos van solos
        const out = []; let buf = [];
        const flush = () => { if (buf.length) out.push({ src: buf[0], kind: 'image', group: buf }); buf = []; };
        ok.forEach(m => { if (m.kind === 'image') { buf.push(m); if (buf.length === 3) flush(); } else { flush(); out.push({ src: m, kind: m.kind, duration: m.duration || 0 }); } });
        flush();
        return out;
      }
      if (this.tpl.still !== 'antesdespues') return ok.map(m => ({ src: m, kind: m.kind, duration: m.duration || 0 }));
      const out = []; ok.forEach(m => { out.push({ src: m, kind: 'image', ad: 'antes' }, { src: m, kind: 'image', ad: 'despues' }); });
      return out;
    }
    plan() { return this.planAt(); }
    planAt(start) {
      const t = this.tpl, list = this.expanded(), keep = this.st.songStart;
      if (start != null) this.st.songStart = start;
      try {
        return E.tplPlan({ media: list, mode: t.mode, target: this.target(), intro: t.intro, outro: t.outro, shot: t.shot, T: t.T, trans: t.trans,
          beat: this.beatFor(), beats: this.beatsPerShot(), maxShots: t.maxShots || 15, shotMin: t.shotMin, shotMax: t.shotMax });
      } finally { this.st.songStart = keep; }
    }
    outDir() {
      const d = this.st.values.date || SA.ui.todayISO();
      const who = B.safeName(this.st.values.title || this.st.values.subtitle || '') || 'video';
      return B.join(B.paths.documents, 'Saucedo', B.safeName(`${d} ${this.tpl.name} ${who}`));
    }
    summary() {
      const el = this.q('summary'); if (!el || !this.tpl) return;
      this.autoStart();
      if (!this.okMedia().length) { el.innerHTML = this.tpl.still === 'antesdespues' ? 'Agrega fotos para ver cuánto va a durar.' : 'Agrega fotos o videos para ver cuánto va a durar.'; return; }
      let p; try { p = this.plan(); } catch (e) { el.textContent = e.message; return; }
      const docs = B.paths.documents, dir = this.outDir();
      const shown = dir.startsWith(docs) ? 'Documentos' + dir.slice(docs.length).split(/[\\/]/).join(' › ') : dir;
      const n = this.st.formats.length;
      el.innerHTML = `Duración: <strong>${fmt(p.total)}</strong> · ${p.segments.length} tomas` + (this.beatFor() ? ' · cortes al ritmo' : '') +
        (this.song ? '' : ' · <strong>sin música</strong>') + `<br>${n === 1 ? 'Se crea 1 video' : `Se crean ${n} videos`} en ${esc(shown)}`;
    }

    /* ---------- Vista previa animada ---------- */
    sizePreview() {
      if (!this.tpl) return;
      const cv = this.q('pv'), r = this.q('stage').getBoundingClientRect();
      if (r.width < 50) return;
      const f = E.FORMATS[this.st.formats.includes('v') ? 'v' : this.st.formats[0]];
      const maxW = r.width - 48, maxH = r.height - 48 - 58;
      let fw = maxW, fh = fw * f.H / f.W; if (fh > maxH) { fh = maxH; fw = fh * f.W / f.H; }
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = Math.round(fw * dpr); cv.height = Math.round(fh * dpr); cv.style.width = fw + 'px'; cv.style.height = fh + 'px';
    }
    startPreview() {
      this.stopPreview();
      let last = performance.now();
      const loop = now => {
        const dt = (now - last) / 1000; last = now;
        if (this.playing) this.pt += dt;
        const dur = this.which === 'intro' ? this.tpl.intro + this.tpl.T * .5 + .8 : this.tpl.outro + .6;
        if (this.pt > dur) this.pt = 0;
        if (!this.root.closest('.view').hidden && !this.q('editor').hidden) this.drawPreview(this.pt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    stopPreview() { cancelAnimationFrame(this.raf); }
    drawPreview(time) {
      const cv = this.q('pv'), W = cv.width, H = cv.height; if (!W) return;
      const ctx = cv.getContext('2d'), t = this.tpl, ok = this.okMedia();
      const m = this.which === 'intro' ? ok[0] : ok[ok.length - 1];
      const bg = m ? m.thumb : this.sample(W, H, 1);
      ctx.save(); ctx.clearRect(0, 0, W, H);
      const pd = this.data(true);
      const items = t.still === 'collage' ? this.expanded() : null, it = items && (this.which === 'intro' ? items[0] : items[items.length - 1]);
      if (t.still === 'polaroid' && (!m || m.kind === 'image')) SA.tpl.polaroid(ctx, bg, W, H, 0, pd.title);
      else if (t.still === 'collage' && (!it || it.group)) SA.tpl.collage(ctx, it ? it.group.map(g => g.thumb) : [0, 1, 2].map(k => this.sample(W, H, k)), W, H, 0);
      else {
        if (t.preview) ctx.filter = t.preview;
        const z = 1 + .05 * Math.min(1, time / 5), vertBg = bg.height > bg.width, vertOut = H > W;
        if (vertBg !== vertOut && Math.abs(Math.log((bg.width / bg.height) / (W / H))) > .35) {
          ctx.save(); ctx.filter = (t.preview || '') + ' blur(14px) brightness(.85)'; C.drawFit(ctx, bg, W, H, 'cover', 1.1); ctx.restore();
          if (t.preview) ctx.filter = t.preview;
          C.drawFit(ctx, bg, W, H, 'contain', z);
        } else C.drawFit(ctx, bg, W, H, 'cover', z);
        ctx.filter = 'none';
      }
      this.drawLayers(ctx, W, H, t, this.which, time, pd, THEME(this.st.theme));
      if (!(t.wmSkip || []).includes(this.which)) SA.drawWatermark(ctx, W, H, S, SA.VIDEO_WM_SCALE);
      ctx.restore();
    }

    /* ---------- Crear ---------- */
    async makeStill(m, W, H, out, opts) {
      if (opts.group && opts.group.length) return this.makeCollage(opts.group, W, H, out, opts);
      const bmp = await createImageBitmap(await B.readBlob(m.path));
      const z = this.tpl.zoom != null ? this.tpl.zoom : .08;
      const k = z > 0 ? 1.5 : 1, SW = Math.round(W * k / 2) * 2, SH = Math.round(H * k / 2) * 2;
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high';
      const stats = C.computeStats(C.downscale(bmp, 480));
      const enhanced = src => {   // copia de la foto con el color de la plantilla
        const t = document.createElement('canvas'); t.width = src.width; t.height = src.height;
        const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(src, 0, 0);
        C.colorCanvas(tx, t.width, t.height, stats, { auto: opts.ad === 'antes' ? false : this.st.enhance, style: opts.ad === 'antes' ? 'natural' : (opts.ad === 'despues' ? 'vivo' : (this.tpl.photoStyle || 'natural')) });
        return t;
      };
      const img = enhanced(C.downscale(bmp, Math.max(SW, SH) * 1.2)); bmp.close && bmp.close();
      if (this.tpl.still === 'polaroid') SA.tpl.polaroid(ctx, img, SW, SH, opts.i, this.data().title);
      else if ((H > W) === (img.height > img.width) || Math.abs(Math.log((img.width / img.height) / (W / H))) < .35) C.drawFit(ctx, img, SW, SH, 'cover');
      else { ctx.filter = 'blur(48px) brightness(.8)'; C.drawFit(ctx, img, SW, SH, 'cover', 1.15); ctx.filter = 'none'; C.drawFit(ctx, img, SW, SH, 'contain'); }
      if (opts.ad) {
        const u = Math.min(SW, SH) / 1080;
        A.chip(ctx, 60 * u, 90 * u, opts.ad === 'antes' ? 'ANTES' : 'DESPUÉS', u, { s: 40, w: 800, bg: opts.ad === 'antes' ? 'rgba(20,20,20,.75)' : 'rgba(255,255,255,.92)', color: opts.ad === 'antes' ? '#FFFFFF' : '#111111' });
      }
      const luma = SA.wmZoneLuma(c, W, H, S, SA.VIDEO_WM_SCALE);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('jpg')), 'image/jpeg', .92));
      c.width = c.height = 0;
      await B.writeBlob(out, blob);
      return luma;
    }
    // Collage: cada foto con su color mejorado, en marcos blancos.
    async makeCollage(group, W, H, out, opts) {
      const z = this.tpl.zoom != null ? this.tpl.zoom : .08, k = z > 0 ? 1.25 : 1, SW = Math.round(W * k / 2) * 2, SH = Math.round(H * k / 2) * 2;
      const imgs = [];
      for (const g of group) {
        const bmp = await createImageBitmap(await B.readBlob(g.path));
        const stats = C.computeStats(C.downscale(bmp, 480));
        const src = C.downscale(bmp, Math.max(SW, SH) * .8); bmp.close && bmp.close();
        const t = document.createElement('canvas'); t.width = src.width; t.height = src.height;
        const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(src, 0, 0);
        C.colorCanvas(tx, t.width, t.height, stats, { auto: this.st.enhance, style: this.tpl.photoStyle || 'natural' });
        imgs.push(t);
      }
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high';
      SA.tpl.collage(ctx, imgs, SW, SH, opts.i || 0);
      const luma = SA.wmZoneLuma(c, W, H, S, SA.VIDEO_WM_SCALE);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('jpg')), 'image/jpeg', .92));
      c.width = c.height = 0;
      await B.writeBlob(out, blob);
      return luma;
    }
    async writeCanvas(c, path) {
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
      await B.writeBlob(path, blob);
    }
    // Capa de texto: fija (un PNG) o animada (secuencia de PNG a 30 cuadros por segundo).
    async renderLayer(design, W, H, dur, data, th, path, onFrame) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      if (design.static) { design.draw(ctx, W, H, 3, dur, data, th); await this.writeCanvas(c, path + '.png'); return { path: path + '.png', seq: false }; }
      const N = Math.ceil(dur * E.FPS) + 2;
      for (let f = 0; f < N; f++) {
        if (this.cancelled) return null;
        ctx.clearRect(0, 0, W, H); ctx.save(); design.draw(ctx, W, H, f / E.FPS, dur, data, th); ctx.restore();
        await this.writeCanvas(c, `${path}_${String(f).padStart(4, '0')}.png`);
        if (onFrame) onFrame(f / N);
      }
      return { path: `${path}_%04d.png`, seq: true };
    }
    setProgress(frac, label) {
      frac = Math.max(0, Math.min(1, frac));
      this.q('bar').style.width = (frac * 100).toFixed(1) + '%';
      this.q('progText').textContent = `${label} · ${Math.floor(frac * 100)} %`;
      const el = (performance.now() - this.t0) / 1000, left = frac > .04 ? el * (1 - frac) / frac : null;
      this.q('progSub').textContent = (left != null ? `Faltan unos ${fmt(left)} · ` : 'Calculando el tiempo… · ') + `usando ${E.ENCODER_NAMES[this.encoder] || 'el procesador'}`;
    }
    act_cancel() { if (!this.busy) return; this.cancelled = true; this.q('progText').textContent = 'Cancelando…'; B.cancel(); }
    act_watch() { this.lastOut && B.open(this.lastOut); }
    act_openDir() { this.lastOut && B.open(this.lastOut, true); }

    async act_create() {
      if (this.busy) return;
      if (this.media.some(m => m.status === 'loading')) { toast('Espera a que terminen de cargar las fotos y videos.'); return; }
      if (!this.okMedia().length) { toast(this.tpl.still === 'antesdespues' ? 'Esta plantilla usa fotos: agrega por lo menos una.' : 'Agrega por lo menos una foto o un video.'); return; }
      const first = this.tpl.fields[0];
      if (first && !(this.st.values[first.key] || '').trim() && !first.def) { toast(`Escribe "${first.label}".`); const f = this.root.querySelector(`[data-f="${first.key}"]`); f && f.focus(); return; }
      this.stopListen();
      this.busy = true; this.cancelled = false; this.t0 = performance.now();
      const create = this.q('create'); create.disabled = true; create.textContent = 'Creando…';
      this.q('progress').hidden = false; this.q('done').hidden = true;
      this.q('progress').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      this.setProgress(0, 'Revisando la computadora');
      const outs = [];
      try {
        this.encoder = await B.detectEncoder();
        const dir = this.outDir(); await B.mkdir(dir);
        const fmts = this.st.formats;
        for (let i = 0; i < fmts.length && !this.cancelled; i++) {
          const out = await this.renderOne(fmts[i], dir, fmts.length > 1 ? `Video ${i + 1} de ${fmts.length} · ` : '');
          if (out) outs.push(out);
        }
        if (this.cancelled) toast('Se canceló el video.');
        else if (outs.length) {
          this.lastOut = outs[outs.length - 1]; this.q('done').hidden = false;
          this.q('done').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          const mins = (performance.now() - this.t0) / 60000;
          toast(`Listo en ${mins < 1 ? 'menos de un minuto' : Math.round(mins) + ' min'}: ${outs.length === 1 ? 'el video quedó' : 'los videos quedaron'} en Documentos › Saucedo.`, 7000);
        }
      } catch (e) {
        if (!this.cancelled) SA.showError(e.message || 'No se pudo crear el video.', e.detail || String(e && e.stack || e));
        else toast('Se canceló el video.');
      } finally {
        this.busy = false; create.disabled = false; create.textContent = 'Crear video'; this.q('progress').hidden = true;
      }
    }

    async renderOne(fk, dir, prefix) {
      const { W, H, name: fname } = E.FORMATS[fk], t = this.tpl, sep = B.paths.sep;
      const tmp = await B.newJobDir();
      try {
        const list = this.expanded().map(x => ({ kind: x.kind, path: x.src.path, width: x.src.w, height: x.src.h, duration: x.duration || 0, name: x.src.name, src: x.src, ad: x.ad, group: x.group }));
        const plan = this.plan();
        const data = this.data(), th = THEME(this.st.theme);
        // Pesos para la barra: fotos, capas de texto y pasos de FFmpeg
        const usedImgs = [...new Set(plan.segments.map(s => s.m))].filter(i => list[i].kind === 'image');
        const lyr = t.layers.filter(l => !l.d.static);
        const est = plan.segments.reduce((s, x) => s + x.len + plan.T, 0) * (1 + .5 * (plan.segments.length > 12)) + plan.total * 1.2;
        const totalW = usedImgs.length * 1.5 + lyr.length * 2 + est;
        let done = 0;
        // 1. Fotos (y de qué color va el logo en cada una)
        const lumaOf = {};
        for (let k = 0; k < usedImgs.length; k++) {
          if (this.cancelled) return null;
          const i = usedImgs[k];
          this.setProgress(done / totalW, `${prefix}Preparando fotos: ${k + 1} de ${usedImgs.length}`);
          list[i].still = B.join(tmp, `foto_${String(i + 1).padStart(3, '0')}.jpg`);
          try { lumaOf[i] = await this.makeStill(list[i].src, W, H, list[i].still, { ad: list[i].ad, i: k, group: list[i].group }); }
          catch (e) { throw Object.assign(new Error(`No se pudo preparar la foto «${list[i].name}». Quítala y vuelve a intentar.`), { detail: String(e) }); }
          done += 1.5;
        }
        list.forEach((x, i) => { if (x.kind === 'video') lumaOf[i] = SA.wmZoneLuma(x.src.thumb, W, H, S, SA.VIDEO_WM_SCALE); });
        // 2. Logo en negro y en blanco
        const wmPaths = {};
        if (S.wm) {
          for (const v of ['negro', 'blanco', 'original']) {
            if (v === 'original' && !SA.logos.original) continue;
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            SA.drawWatermark(c.getContext('2d'), W, H, S, SA.VIDEO_WM_SCALE, v);
            wmPaths[v] = B.join(tmp, `marca_${v}.png`); await this.writeCanvas(c, wmPaths[v]);
          }
        }
        const lastSeg = plan.segments[plan.segments.length - 1], skip = t.wmSkip || [];
        const wmFor = s => {
          if (!S.wm) return null;
          if ((skip.includes('intro') && s === plan.segments[0]) || (skip.includes('outro') && s === lastSeg && plan.segments.length > 1)) return null;
          const v = S.wmColor === 'auto' || !S.wmColor ? SA.wmVariantFor(lumaOf[s.m] == null ? 90 : lumaOf[s.m]) : S.wmColor;
          return wmPaths[v] || wmPaths.blanco;
        };
        // 3. Capas de texto
        const layers = [];
        let li = 0;
        for (const l of t.layers) {
          if (this.cancelled) return null;
          li++;
          let a, b;
          if (l.at === 'intro') { a = plan.intro.a; b = plan.intro.b; }
          else if (l.at === 'outro') { if (!plan.outro) continue; a = plan.outro.a; b = plan.outro.b; }
          else if (l.at === 'all') { a = 0; b = plan.total; }
          if (l.at === 'cuts') {
            const dur = l.dur || 1.2;
            const r = await this.renderLayer(l.d, W, H, dur, data, th, B.join(tmp, `capa${li}`));
            if (!r) return null;
            plan.cuts.forEach((c, k) => { if (k % (l.every || 1) === 0 && c - dur / 2 > plan.intro.b && c + dur / 2 < (plan.outro ? plan.outro.a : plan.total) && layers.filter(x => x.cut).length < 8) layers.push(Object.assign({ a: c - dur / 2, b: c + dur / 2, cut: true }, r)); });
            done += 2; continue;
          }
          if (l.at === 'captions') {   // una palabra o frase en cada toma del medio
            const raw = String(data[l.field] || '').trim();
            const items = l.split === 'lines' ? raw.split(/\s*\/\s*|\n+/).filter(Boolean) : raw.toUpperCase().split(/\s+/).filter(Boolean);
            if (!items.length) continue;
            const end = plan.outro ? plan.outro.a : plan.total, T2 = plan.T * .5;
            const starts = plan.cuts.filter(c => c < end - .3);
            const pop = .3, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            for (let k = 0; k < starts.length; k++) {
              if (this.cancelled) return null;
              const a = starts[k] + T2, b = Math.min(end, k + 1 < starts.length ? starts[k + 1] + T2 : end);
              if (b - a < .35) continue;
              const dd = Object.assign({}, data, { word: items[k % items.length], k });
              this.setProgress((done + 2 * k / starts.length) / totalW, `${prefix}Preparando las letras: ${k + 1} de ${starts.length}`);
              const r = await this.renderLayer(l.d, W, H, pop, dd, th, B.join(tmp, `capa${li}_${k}`));
              if (!r) return null;
              layers.push(Object.assign({ a, b: Math.min(b, a + pop + 2 / E.FPS) }, r));
              const cx = cv.getContext('2d'); cx.clearRect(0, 0, W, H); cx.save(); l.d.draw(cx, W, H, 2, b - a, dd, th); cx.restore();
              const still = B.join(tmp, `capa${li}_${k}_fija.png`); await this.writeCanvas(cv, still);
              layers.push({ path: still, seq: false, a: a + pop, b });
            }
            done += 2; continue;
          }
          const label = `${prefix}Preparando ${l.at === 'intro' ? 'el título' : l.at === 'outro' ? 'el final' : 'los efectos'}`;
          const r = await this.renderLayer(l.d, W, H, b - a, data, th, B.join(tmp, `capa${li}`), p => this.setProgress((done + p * 2) / totalW, label));
          if (!r) return null;
          if (!l.d.static) done += 2;
          layers.push(Object.assign({ a, b, blink: !!l.blink,
            fin: r.seq ? 0 : (l.at === 'outro' ? .9 : l.at === 'intro' ? .5 : 0), fout: l.at === 'intro' ? .7 : 0 }, r));
        }
        // 4. FFmpeg
        const look = (this.st.enhance ? ',eq=contrast=1.05:saturation=1.10' : '') + (t.look ? ',' + t.look : '');
        const base = B.safeName(`${t.name} ${this.st.values.title || this.st.values.subtitle || ''} ${fname}`).replace(/\s+/g, ' ').trim();
        const out = await B.freeName(dir, base, 'mp4');
        const job = E.tplJob({ plan, media: list, tmp, sep, W, H, look, fit: t.fit || 'auto', zoom: t.zoom, hwaccel: true, wmFor, layers, post: t.post,
          audio: this.song ? { path: this.song.path, start: this.st.songStart } : null, encoderArgs: E.ENCODERS[this.encoder], out });
        const jobW = job.steps.reduce((s, x) => s + x.weight, 0), scale = est / jobW;
        for (const step of job.steps) {
          if (this.cancelled) return null;
          const label = prefix + (step.stage === 'toma' ? `Armando tomas: ${step.n} de ${step.of}` : step.stage === 'grupo' ? `Uniendo partes: ${step.n} de ${step.of}` : 'Terminando el video');
          const onT = tt => this.setProgress((done + Math.min(1, tt / step.seconds) * step.weight * scale) / totalW, label);
          onT(0);
          let r = await B.run('ffmpeg', step.args, onT);
          if (this.cancelled) return null;
          if (r.code !== 0 && step.args.includes('-hwaccel')) r = await B.run('ffmpeg', step.args.filter((x, i, arr) => x !== '-hwaccel' && arr[i - 1] !== '-hwaccel'), onT);
          if (r.code !== 0 && step.final && this.encoder !== 'libx264') {
            this.encoder = 'libx264';
            r = await B.run('ffmpeg', E.tplFinalArgs(Object.assign({}, step.finalOpts, { encoderArgs: E.ENCODERS.libx264 })), onT);
          }
          if (this.cancelled) return null;
          if (r.code !== 0) {
            const who = step.media != null ? list[step.media].name : null;
            throw Object.assign(new Error(step.stage === 'toma' && who ? `No se pudo usar «${who}». Puede estar dañado o en un formato poco común. Quítalo y vuelve a intentar.`
              : 'FFmpeg no pudo terminar el video. Revisa que haya espacio en el disco e intenta de nuevo.'), { detail: r.stderr });
          }
          done += step.weight * scale;
        }
        this.setProgress(1, prefix + 'Listo');
        return out;
      } finally { B.removeJobDir(tmp); }
    }
  }
  SA.Plantillas = Plantillas;
})();
