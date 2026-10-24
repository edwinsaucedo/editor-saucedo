/* Pestañas de video: Save the Date y Videoclip XV. */
(function () {
  'use strict';
  const SA = window.SA;
  const { $$, esc, toast } = SA.ui;
  const B = SA.bridge, E = window.Engine, C = SA.color, S = SA.settings;

  const TEXT = {
    std: {
      hint: 'Usa de 4 a 8 fotos o clips. La primera abre con el título y la última cierra con la fecha.',
      fields: `
        <label class="field"><span class="lbl">Nombres</span><input class="input" data-f="names" type="text" placeholder="Ana &amp; Luis" autocomplete="off"></label>
        <label class="field"><span class="lbl">Fecha del evento</span><input class="input" data-f="date" type="date"></label>
        <label class="field"><span class="lbl">Lugar (opcional)</span><input class="input" data-f="place" type="text" placeholder="Ciudad o salón" autocomplete="off"></label>`
    },
    xv: {
      hint: 'Pon los clips en el orden que quieras; se reparten a lo largo de la canción.',
      fields: `
        <label class="field"><span class="lbl">Nombre de la quinceañera</span><input class="input" data-f="name" type="text" placeholder="Ana Sofía" autocomplete="off"></label>
        <label class="field"><span class="lbl">Fecha</span><input class="input" data-f="date" type="date"></label>
        <label class="field"><span class="lbl">Frase del final</span><input class="input" data-f="phrase" type="text" autocomplete="off"></label>
        <label class="field"><span class="lbl">Lugar (opcional)</span><input class="input" data-f="place" type="text" placeholder="Ciudad o salón" autocomplete="off"></label>`
    }
  };

  class VideoTab {
    constructor(t, root) {
      this.t = t; this.root = root; this.key = 'saucedo-video-' + t;
      this.st = { names: '', place: '', name: '', phrase: 'Gracias por acompañarme', date: '', songStart: 0,
        theme: t === 'xv' ? 'rosa' : 'dorado', format: 'v', mood: 'suave', enhance: true, style: 'natural', target: 'full' };
      try { Object.assign(this.st, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch (e) {}
      this.st.names = this.st.name = this.st.place = this.st.date = ''; this.st.songStart = 0;
      if (!this.st.phrase) this.st.phrase = 'Gracias por acompañarme';
      this.media = []; this.song = null; this.sel = null; this.which = 'intro'; this.uid = 0;
      this.busy = false; this.cancelled = false; this.queue = []; this.pumping = false;
      this.build(); this.bind(); this.sync();
      new ResizeObserver(() => this.drawPreview()).observe(this.q('stage'));
      SA.onBrandChange(() => { this.sync(); this.drawPreview(); });
    }
    q(name) { return this.root.querySelector(`[data-el="${name}"]`); }
    save() {
      const { theme, format, mood, enhance, style, target, phrase } = this.st;
      try { localStorage.setItem(this.key, JSON.stringify({ theme, format, mood, enhance, style, target, phrase })); } catch (e) {}
    }

    /* ---------- Pantalla ---------- */
    build() {
      const t = this.t, X = TEXT[t];
      const themes = Object.entries(SA.cards.THEMES).map(([k, v]) => `<button type="button" class="chip" data-v="${k}"><span class="sw" style="background:${v.accent}"></span>${v.name}</button>`).join('');
      const styles = Object.entries(C.STYLES).map(([k, v]) => `<button type="button" class="chip" data-v="${k}">${esc(v.name)}</button>`).join('');
      this.root.innerHTML = `
      <aside class="steps" aria-label="Pasos">
        <section class="step">
          <h2><span class="num">1</span>Fotos y videos</h2>
          <button class="drop" type="button" data-act="add"><strong>Agregar fotos y videos</strong><span>o arrástralos a esta ventana</span></button>
          <div class="links"><button class="link" type="button" data-act="folder">Elegir una carpeta completa</button><button class="link danger" type="button" data-act="clear" hidden>Quitar todos</button></div>
          <p class="count" data-el="count" aria-live="polite"></p>
          <p class="hint">${X.hint}</p>
        </section>
        <section class="step">
          <h2><span class="num">2</span>Textos</h2>
          ${X.fields}
          <div class="field"><span class="lbl">Color de las letras</span><div class="chips" data-el="theme" role="radiogroup">${themes}</div></div>
        </section>
        <section class="step">
          <h2><span class="num">3</span>Música</h2>
          <button class="btn" type="button" data-act="song" data-el="songBtn">Elegir canción</button>
          <div class="song" data-el="songBox" hidden>
            <span class="song-name" data-el="songName"></span>
            <div class="field"><span class="lbl">La canción empieza en</span>
              <div class="stepper"><button type="button" data-act="ssMinus" aria-label="5 segundos antes">−5 s</button><output data-el="ss">0:00</output><button type="button" data-act="ssPlus" aria-label="5 segundos después">+5 s</button>
              <button class="btn" type="button" data-act="listen" data-el="listen">Escuchar</button></div>
            </div>
            <button class="link" type="button" data-act="song">Cambiar canción</button>
          </div>
          ${t === 'xv' ? `<div class="field"><span class="lbl">Duración del video</span><div class="seg" data-el="target"><button type="button" data-v="full">Toda la canción</button><button type="button" data-v="180">3 min</button><button type="button" data-v="120">2 min</button><button type="button" data-v="60">1 min</button></div></div>`
            : `<p class="hint">El Save the Date dura de 20 a 40 segundos según cuántas fotos o clips pongas.</p>`}
        </section>
        <section class="step">
          <h2><span class="num">4</span>Formato y estilo</h2>
          <div class="field"><span class="lbl">Formato</span><div class="seg" data-el="format"><button type="button" data-v="v">Vertical</button><button type="button" data-v="h">Horizontal</button><button type="button" data-v="both">Los dos</button></div>
            <p class="hint" data-el="formatHint"></p></div>
          <div class="field"><span class="lbl">Transiciones</span><div class="seg" data-el="mood"><button type="button" data-v="suave">Suaves</button><button type="button" data-v="dinamico">Dinámicas</button></div></div>
          <button class="big" type="button" data-act="enhance"><span class="t">Mejorar colores</span><span class="pill" data-el="enhState">Activado</span></button>
          <div class="field"><span class="lbl">Estilo de color</span><div class="chips" data-el="style" role="radiogroup">${styles}</div></div>
          <div class="sw-row"><button class="switch" type="button" role="switch" data-act="wm" data-el="wm" aria-label="Marca de agua"></button><span class="sw-state" data-el="wmState"></span></div>
          <p class="hint">El logo, su lugar y su tamaño se cambian en la pestaña Fotos.</p>
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
          <p class="hint" data-el="encHint">Se guarda en MP4 dentro de Documentos › Saucedo.</p>
        </section>
      </aside>
      <section class="mesa" aria-label="Vista previa">
        <div class="stage" data-el="stage">
          <div class="pv-wrap">
            <canvas data-el="pv" aria-label="Vista previa del título"></canvas>
            <div class="pv-tabs" role="radiogroup" data-el="which"><button type="button" data-v="intro">Inicio</button><button type="button" data-v="outro">Final</button></div>
          </div>
        </div>
        <div class="info">
          <div class="meta"><span class="name" data-el="selName"></span><span class="sub" data-el="selSub"></span></div>
          <div class="order" data-el="order"><button class="navbtn" type="button" data-act="left">‹ Mover antes</button><button class="navbtn" type="button" data-act="right">Mover después ›</button><button class="navbtn" type="button" data-act="remove">Quitar</button></div>
        </div>
        <div class="film-wrap"><div class="film" data-el="film" aria-label="Fotos y videos en orden"></div></div>
      </section>`;
      $$('[data-f]', this.root).forEach(inp => { inp.value = this.st[inp.dataset.f] || ''; });
    }

    bind() {
      const R = this.root;
      R.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || !R.contains(b)) return;
        const a = b.dataset.act;
        if (a === 'add') B.pick('media', true).then(p => p.length && this.addPaths(p));
        else if (a === 'folder') B.pickFolder().then(p => p && this.addPaths([p]));
        else if (a === 'clear') this.clearAll(b);
        else if (a === 'song') B.pick('audio', false).then(p => p.length && this.setSong(p[0]));
        else if (a === 'ssMinus') this.setStart(this.st.songStart - 5);
        else if (a === 'ssPlus') this.setStart(this.st.songStart + 5);
        else if (a === 'listen') this.listen();
        else if (a === 'enhance') { this.st.enhance = !this.st.enhance; this.changed(); }
        else if (a === 'wm') { S.wm = !S.wm; SA.brandChanged(); }
        else if (a === 'create') this.create();
        else if (a === 'cancel') this.cancel();
        else if (a === 'watch') this.lastOut && B.open(this.lastOut);
        else if (a === 'openDir') this.lastOut && B.open(this.lastOut, true);
        else if (a === 'left') this.move(-1);
        else if (a === 'right') this.move(1);
        else if (a === 'remove') this.sel && this.remove(this.sel);
      });
      $$('[data-f]', R).forEach(inp => inp.addEventListener('input', () => { this.st[inp.dataset.f] = inp.value; if (inp.dataset.f === 'phrase') this.save(); this.summary(); this.drawPreview(); }));
      const seg = (name, key, cb) => { const el = this.q(name); if (!el) return; SA.ui.seg(el, this.st[key], v => { this.st[key] = v; this.changed(); cb && cb(); }); };
      seg('theme', 'theme'); seg('format', 'format'); seg('mood', 'mood'); seg('style', 'style'); seg('target', 'target');
      SA.ui.seg(this.q('which'), this.which, v => { this.which = v; SA.ui.setSeg(this.q('which'), v); this.drawPreview(); });
    }
    changed() { this.save(); this.sync(); this.drawPreview(); }
    sync() {
      ['theme', 'format', 'mood', 'style', 'target'].forEach(k => { const el = this.q(k); if (el) SA.ui.setSeg(el, this.st[k]); });
      const enh = this.root.querySelector('[data-act="enhance"]');
      enh.setAttribute('aria-pressed', String(this.st.enhance)); this.q('enhState').textContent = this.st.enhance ? 'Activado' : 'Apagado';
      this.q('wm').setAttribute('aria-checked', String(S.wm));
      this.q('wmState').textContent = S.wm ? 'Marca de agua encendida' : 'Marca de agua apagada';
      this.q('formatHint').textContent = { v: '1080 × 1920, para estados de WhatsApp, historias y reels.', h: '1920 × 1080, para la TV, el proyector del salón o YouTube.', both: 'Se crean dos archivos: uno vertical y uno horizontal.' }[this.st.format];
      this.summary();
    }

    /* ---------- Fotos y videos ---------- */
    async addPaths(paths) {
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
      while (this.queue.length) {
        const m = this.queue.shift();
        if (!this.media.includes(m)) continue;
        await this.load(m); this.counts();
      }
      this.pumping = false; this.counts(); this.drawPreview();
    }
    async thumbDirPath() { if (!this.thumbDir) this.thumbDir = await B.newJobDir(); return this.thumbDir; }
    async load(m) {
      try {
        let bmp;
        if (m.kind === 'image') {
          bmp = await createImageBitmap(await B.readBlob(m.path));
          m.w = bmp.width; m.h = bmp.height;
        } else {
          const p = await B.probe(m.path);
          if (!p.hasVideo) throw new Error('sin video');
          m.w = p.width; m.h = p.height; m.duration = p.duration;
          const out = B.join(await this.thumbDirPath(), `cuadro_${m.id}.jpg`);
          const at = Math.min(1, (p.duration || 0) * .3);
          let r = await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-ss', String(at), '-i', m.path, '-frames:v', '1', '-vf', 'scale=480:-2', out]);
          if (r.code !== 0 || !(await B.exists(out))) r = await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-i', m.path, '-frames:v', '1', '-vf', 'scale=480:-2', out]);
          bmp = await createImageBitmap(await B.readBlob(out, 'image/jpeg'));
        }
        m.thumb = C.downscale(bmp, 480); bmp.close && bmp.close();
        m.status = 'ok';
      } catch (e) {
        m.status = 'error';
        m.err = /\.(heic|heif)$/i.test(m.name) ? 'HEIC del iPhone: no se abre' : m.kind === 'video' ? 'Este video no se pudo leer' : 'No se pudo abrir';
      }
      this.paintThumb(m);
      if (!this.sel || this.sel.status !== 'ok') this.select(m);
    }
    mount(m) {
      const w = document.createElement('div');
      w.className = 'thumb';
      w.innerHTML = '<span class="n"></span><button type="button" class="pick"><span class="ph">Cargando…</span></button><button type="button" class="x" aria-label="Quitar" title="Quitar">×</button>';
      w.querySelector('.pick').addEventListener('click', () => this.select(m));
      w.querySelector('.x').addEventListener('click', () => this.remove(m));
      m.el = w; this.q('film').appendChild(w);
    }
    paintThumb(m) {
      const pick = m.el.querySelector('.pick');
      pick.textContent = '';
      if (m.status !== 'ok') { pick.innerHTML = `<span class="ph err">${esc(m.err || 'No se pudo abrir')}</span>`; return; }
      const c = document.createElement('canvas'); c.width = m.thumb.width; c.height = m.thumb.height;
      c.getContext('2d').drawImage(m.thumb, 0, 0);
      pick.appendChild(c);
      if (m.kind === 'video') { const d = document.createElement('span'); d.className = 'dur'; d.textContent = E.fmtTime(m.duration); pick.appendChild(d); }
      pick.setAttribute('aria-label', m.name);
    }
    renumber() {
      this.media.forEach((m, i) => { m.el.querySelector('.n').innerHTML = `${String(i + 1).padStart(2, '0')} ▸ <span class="kind">${m.kind === 'video' ? 'VIDEO' : 'FOTO'}</span>`; });
      this.media.forEach(m => this.q('film').appendChild(m.el));
    }
    select(m) {
      this.sel = m;
      this.media.forEach(x => x.el.classList.toggle('on', x === m));
      if (m && m.el) m.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.info();
    }
    info() {
      const m = this.sel, i = this.media.indexOf(m);
      this.q('order').hidden = !m;
      this.q('selName').textContent = m ? m.name : (this.media.length ? '' : 'Agrega fotos y videos para ver aquí cómo queda el título.');
      this.q('selSub').textContent = m && m.status === 'ok' ? (m.kind === 'video' ? `Video de ${E.fmtTime(m.duration)} · ${m.w} × ${m.h}` : `Foto · ${m.w} × ${m.h}`) + ` · lugar ${i + 1} de ${this.media.length}` : '';
      const [l, r] = this.root.querySelectorAll('[data-act="left"],[data-act="right"]');
      l.disabled = i <= 0; r.disabled = i < 0 || i >= this.media.length - 1;
    }
    move(dir) {
      const i = this.media.indexOf(this.sel), j = i + dir;
      if (i < 0 || j < 0 || j >= this.media.length) return;
      [this.media[i], this.media[j]] = [this.media[j], this.media[i]];
      this.renumber(); this.select(this.sel); this.summary(); this.drawPreview();
    }
    keyNav(dir) { const i = this.media.indexOf(this.sel) + dir; if (i >= 0 && i < this.media.length) this.select(this.media[i]); }
    remove(m) {
      const i = this.media.indexOf(m); if (i < 0) return;
      this.media.splice(i, 1); m.el.remove();
      if (this.sel === m) this.select(this.media[i] || this.media[i - 1] || null);
      this.renumber(); this.counts(); this.info(); this.drawPreview();
    }
    clearAll(btn) {
      if (!this.clearArm) {
        btn.textContent = '¿Seguro? Toca otra vez para quitarlos';
        this.clearArm = setTimeout(() => { this.clearArm = 0; btn.textContent = 'Quitar todos'; }, 4000);
        return;
      }
      clearTimeout(this.clearArm); this.clearArm = 0; btn.textContent = 'Quitar todos';
      this.media.forEach(m => m.el.remove()); this.media = []; this.queue.length = 0; this.select(null);
      this.counts(); this.drawPreview();
    }
    counts() {
      const ok = this.media.filter(m => m.status === 'ok'), ld = this.media.filter(m => m.status === 'loading').length, er = this.media.filter(m => m.status === 'error').length;
      const fotos = ok.filter(m => m.kind === 'image').length, vids = ok.length - fotos;
      let t = !this.media.length ? 'Todavía no hay fotos ni videos.'
        : ld ? `Cargando ${this.media.length - ld} de ${this.media.length}…`
        : [fotos && `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`, vids && `${vids} ${vids === 1 ? 'video' : 'videos'}`].filter(Boolean).join(' y ') || 'Nada listo todavía';
      if (er) t += ` · ${er} no se ${er === 1 ? 'pudo' : 'pudieron'} abrir`;
      if (this.t === 'std' && ok.length > 15) t += ' · se usan las primeras 15';
      this.q('count').textContent = t;
      this.root.querySelector('[data-act="clear"]').hidden = !this.media.length;
      this.summary(); this.info();
    }

    /* ---------- Música ---------- */
    async setSong(path) {
      this.stopListen();
      try {
        const p = await B.probe(path);
        if (!p.hasAudio || !p.duration) throw new Error('sin audio');
        this.song = { path, name: B.baseName(path), duration: p.duration };
        this.st.songStart = 0; this.audioUrl = null;
        this.q('songBox').hidden = false; this.q('songBtn').hidden = true;
        this.q('songName').textContent = `${this.song.name} · ${E.fmtTime(p.duration)}`;
        this.setStart(0);
      } catch (e) { toast('No se pudo leer esa canción. Prueba con un MP3 o M4A.'); }
    }
    setStart(s) {
      if (!this.song) return;
      this.st.songStart = Math.max(0, Math.min(Math.floor(this.song.duration - 15), s));
      this.q('ss').textContent = E.fmtTime(this.st.songStart);
      this.summary();
      if (this.audio && !this.audio.paused) this.audio.currentTime = this.st.songStart;
    }
    async listen() {
      if (this.audio && !this.audio.paused) { this.stopListen(); return; }
      try {
        if (!this.audioUrl) this.audioUrl = URL.createObjectURL(await B.readBlob(this.song.path));
        if (!this.audio) this.audio = new Audio();
        this.audio.src = this.audioUrl;
        this.audio.currentTime = this.st.songStart;
        await this.audio.play();
        this.q('listen').textContent = 'Detener';
        clearTimeout(this.listenT); this.listenT = setTimeout(() => this.stopListen(), 20000);
      } catch (e) { toast('No se puede escuchar esta canción aquí, pero sí se usará en el video.'); }
    }
    stopListen() { if (this.audio) this.audio.pause(); clearTimeout(this.listenT); const l = this.q('listen'); if (l) l.textContent = 'Escuchar'; }

    /* ---------- Resumen y vista previa ---------- */
    cardData() { return { names: this.st.names.trim(), name: this.st.name.trim(), place: this.st.place.trim(), phrase: this.st.phrase.trim(), date: SA.ui.parseDate(this.st.date) }; }
    okMedia() { const ok = this.media.filter(m => m.status === 'ok'); return this.t === 'std' ? ok.slice(0, 15) : ok; }
    target() {
      if (this.t !== 'xv') return 0;
      const avail = this.song ? Math.max(30, this.song.duration - this.st.songStart) : 180;
      return this.st.target === 'full' ? avail : Math.min(+this.st.target, avail);
    }
    outDir() {
      const d = this.st.date || SA.ui.todayISO();
      const who = B.safeName(this.t === 'std' ? this.st.names : this.st.name) || 'sin nombre';
      return B.join(B.paths.documents, 'Saucedo', `${d} ${SA.cards.TEMPLATES[this.t].name} ${who}`);
    }
    summary() {
      const el = this.q('summary'); if (!el) return;
      const media = this.okMedia();
      if (!media.length) { el.innerHTML = 'Agrega fotos o videos para ver cuánto va a durar.'; return; }
      let plan;
      try { plan = E.plan({ template: this.t, media: media.map(m => ({ kind: m.kind, duration: m.duration || 0 })), mood: this.st.mood, target: this.target() }); }
      catch (e) { el.textContent = e.message; return; }
      const docs = B.paths.documents, dir = this.outDir();
      const shown = dir.startsWith(docs) ? 'Documentos' + dir.slice(docs.length).split(/[\\/]/).join(' › ') : dir;
      const n = this.st.format === 'both' ? 'Se crean 2 videos' : 'Se crea 1 video';
      el.innerHTML = `Duración: <strong>${E.fmtTime(plan.total)}</strong> · ${plan.segments.length} tomas` +
        (this.song ? '' : ' · <strong>sin música</strong>') + `<br>${n} en ${esc(shown)}`;
    }
    drawPreview() {
      const cv = this.q('pv'), stage = this.q('stage');
      if (!cv || this.root.hidden) return;
      const r = stage.getBoundingClientRect();
      if (r.width < 50 || r.height < 120) return;
      const vert = this.st.format !== 'h';
      const W = vert ? 1080 : 1920, H = vert ? 1920 : 1080;
      const maxW = r.width - 48, maxH = r.height - 48 - 54;
      let fw = maxW, fh = fw * H / W; if (fh > maxH) { fh = maxH; fw = fh * W / H; }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(fw * dpr), ph = Math.round(fh * dpr);
      cv.width = pw; cv.height = ph; cv.style.width = fw + 'px'; cv.style.height = fh + 'px';
      const media = this.okMedia();
      const bgM = this.which === 'intro' ? media[0] : media[media.length - 1];
      let bg = bgM ? bgM.thumb : null;
      if (bg && this.st.enhance !== false && bgM.kind === 'image') {
        // Que la vista previa refleje el color que tendrá el video.
        const c = document.createElement('canvas'); c.width = bg.width; c.height = bg.height;
        const x = c.getContext('2d'); x.drawImage(bg, 0, 0);
        C.colorCanvas(x, c.width, c.height, C.computeStats(bg), { auto: this.st.enhance, style: this.st.style });
        bg = c;
      }
      SA.cards.preview(cv, bg, this.t, this.which, pw, ph, this.cardData(), this.st.theme);
    }

    /* ---------- Crear el video ---------- */
    async makeStill(m, W, H, out) {
      const bmp = await createImageBitmap(await B.readBlob(m.path));
      const SW = Math.round(W * .75) * 2, SH = Math.round(H * .75) * 2;   // 1.5 veces el tamaño final, para el acercamiento lento
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      if ((H > W) === (bmp.height > bmp.width)) C.drawFit(ctx, bmp, SW, SH, 'cover');
      else {
        ctx.filter = 'blur(48px) brightness(.8)'; C.drawFit(ctx, bmp, SW, SH, 'cover', 1.15); ctx.filter = 'none';
        C.drawFit(ctx, bmp, SW, SH, 'contain');
      }
      const stats = C.computeStats(C.downscale(bmp, 480));
      bmp.close && bmp.close();
      C.colorCanvas(ctx, SW, SH, stats, { auto: this.st.enhance, style: this.st.style });
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('jpg')), 'image/jpeg', .92));
      c.width = c.height = 0;
      await B.writeBlob(out, blob);
    }
    async writeCanvas(c, path) {
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
      await B.writeBlob(path, blob);
    }
    setProgress(frac, label) {
      frac = Math.max(0, Math.min(1, frac));
      this.q('bar').style.width = (frac * 100).toFixed(1) + '%';
      this.q('progText').textContent = `${label} · ${Math.floor(frac * 100)} %`;
      const el = (performance.now() - this.t0) / 1000;
      const left = frac > .04 ? el * (1 - frac) / frac : null;
      this.q('progSub').textContent = (left != null ? `Faltan unos ${E.fmtTime(left)} min · ` : 'Calculando el tiempo… · ') + `usando ${E.ENCODER_NAMES[this.encoder] || 'el procesador'}`;
    }
    cancel() { if (!this.busy) return; this.cancelled = true; this.q('progText').textContent = 'Cancelando…'; this.stopListen(); B.cancel(); }

    async create() {
      if (this.busy) return;
      const media = this.okMedia();
      if (this.media.some(m => m.status === 'loading')) { toast('Espera a que terminen de cargar las fotos y videos.'); return; }
      if (!media.length) { toast('Agrega por lo menos una foto o un video.'); return; }
      const who = this.t === 'std' ? this.st.names : this.st.name;
      if (!who.trim()) {
        toast(this.t === 'std' ? 'Escribe los nombres para el título.' : 'Escribe el nombre de la quinceañera.');
        const f = this.root.querySelector(`[data-f="${this.t === 'std' ? 'names' : 'name'}"]`); f && f.focus();
        return;
      }
      this.stopListen();
      this.busy = true; this.cancelled = false; this.t0 = performance.now();
      const create = this.q('create'); create.disabled = true; create.textContent = 'Creando…';
      this.q('progress').hidden = false; this.q('done').hidden = true;
      this.q('progress').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      this.setProgress(0, 'Revisando la computadora');
      const outs = [];
      try {
        this.encoder = await B.detectEncoder();
        this.q('encHint').textContent = `Se guarda en MP4 usando ${E.ENCODER_NAMES[this.encoder]}.`;
        const dir = this.outDir(); await B.mkdir(dir);
        const formats = this.st.format === 'both' ? ['v', 'h'] : [this.st.format];
        for (let i = 0; i < formats.length && !this.cancelled; i++) {
          const out = await this.renderOne(formats[i], media, dir, formats.length > 1 ? `Video ${i + 1} de ${formats.length} · ` : '');
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

    async renderOne(fmt, media, dir, prefix) {
      const W = fmt === 'v' ? 1080 : 1920, H = fmt === 'v' ? 1920 : 1080;
      const tmp = await B.newJobDir();
      try {
        const list = media.map(m => ({ kind: m.kind, path: m.path, width: m.w, height: m.h, duration: m.duration || 0, name: m.name }));
        const plan = E.plan({ template: this.t, media: list, mood: this.st.mood, target: this.target() });
        const images = [...new Set(plan.segments.map(s => s.m))].filter(i => list[i].kind === 'image');
        const stillW = images.length * 1.5;
        // Pasos de FFmpeg (se arman después de preparar fotos y títulos)
        const est = plan.segments.reduce((s, x) => s + x.len + plan.T, 0) * (1 + .5 * (plan.segments.length > 12)) + plan.total * 1.2;
        const totalW = stillW + est;
        let doneW = 0;
        for (let k = 0; k < images.length; k++) {
          if (this.cancelled) return null;
          const i = images[k];
          this.setProgress(doneW / totalW, `${prefix}Preparando fotos: ${k + 1} de ${images.length}`);
          list[i].still = B.join(tmp, `foto_${String(i + 1).padStart(3, '0')}.jpg`);
          try { await this.makeStill(media[i], W, H, list[i].still); }
          catch (e) { throw Object.assign(new Error(`No se pudo preparar la foto «${list[i].name}». Quítala y vuelve a intentar.`), { detail: String(e) }); }
          doneW += 1.5;
          await new Promise(r => setTimeout(r, 0));
        }
        const data = this.cardData();
        const intro = B.join(tmp, 'titulo_inicio.png'), outro = B.join(tmp, 'titulo_final.png');
        await this.writeCanvas(SA.cards.renderCard(this.t, 'intro', W, H, data, this.st.theme), intro);
        const overlays = [{ path: intro, a: plan.intro.a, b: plan.intro.b, fin: .5, fout: .7 }];
        if (plan.outro) {
          await this.writeCanvas(SA.cards.renderCard(this.t, 'outro', W, H, data, this.st.theme), outro);
          overlays.push({ path: outro, a: plan.outro.a, b: plan.outro.b, fin: .9, fout: 0 });
        }
        let watermark = null;
        if (S.wm) {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          SA.drawWatermark(c.getContext('2d'), W, H, S, SA.VIDEO_WM_SCALE);
          watermark = B.join(tmp, 'marca.png'); await this.writeCanvas(c, watermark);
        }
        const base = `${SA.cards.TEMPLATES[this.t].file} ${B.safeName(this.t === 'std' ? this.st.names : this.st.name)} ${fmt === 'v' ? 'vertical' : 'horizontal'}`;
        const out = await B.freeName(dir, base, 'mp4');
        const job = E.buildJob({ plan, media: list, tmp, W, H, T: plan.T, enhance: this.st.enhance, style: this.st.style, hwaccel: true,
          overlays, watermark, audio: this.song ? { path: this.song.path, start: this.st.songStart } : null,
          encoderArgs: E.ENCODERS[this.encoder], out, sep: B.paths.sep });
        const jobW = job.steps.reduce((s, x) => s + x.weight, 0);
        const scale = (totalW - stillW) / jobW;
        for (const step of job.steps) {
          if (this.cancelled) return null;
          const label = prefix + (step.stage === 'toma' ? `Armando tomas: ${step.n} de ${step.of}` : step.stage === 'grupo' ? `Uniendo partes: ${step.n} de ${step.of}` : 'Terminando el video');
          const onT = t => this.setProgress((doneW + Math.min(1, t / step.seconds) * step.weight * scale) / totalW, label);
          onT(0);
          let r = await B.run('ffmpeg', step.args, onT);
          if (this.cancelled) return null;
          if (r.code !== 0 && step.stage === 'toma' && step.args.includes('-hwaccel')) {
            r = await B.run('ffmpeg', step.args.filter((a, i, arr) => a !== '-hwaccel' && arr[i - 1] !== '-hwaccel'), onT);
          }
          if (r.code !== 0 && step.final && this.encoder !== 'libx264') {
            this.encoder = 'libx264';
            r = await B.run('ffmpeg', E.finalArgs(Object.assign({}, step.finalOpts, { encoderArgs: E.ENCODERS.libx264 })), onT);
          }
          if (this.cancelled) return null;
          if (r.code !== 0) {
            const who2 = step.media != null ? list[step.media].name : null;
            const msg = step.stage === 'toma' && who2
              ? `No se pudo usar «${who2}». Puede estar dañado o en un formato poco común. Quítalo y vuelve a intentar.`
              : 'FFmpeg no pudo terminar el video. Revisa que haya espacio en el disco e intenta de nuevo.';
            throw Object.assign(new Error(msg), { detail: r.stderr });
          }
          doneW += step.weight * scale;
        }
        this.setProgress(1, prefix + 'Listo');
        return out;
      } finally {
        B.removeJobDir(tmp);
      }
    }
  }

  SA.VideoTab = VideoTab;
})();
