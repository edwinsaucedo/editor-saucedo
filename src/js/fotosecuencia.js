/* Pestaña Fotosecuencia: fotos con movimiento, transiciones profesionales (automáticas o una por una),
 * letras como en las plantillas, música y logo. Se ve completa en la pantalla antes de crear el video. */
(function () {
  'use strict';
  const SA = window.SA, A = SA.anim, TR = SA.trans;
  const { $$, esc, toast } = SA.ui;
  const B = SA.bridge, E = window.Engine, C = SA.color, S = SA.settings;
  const D = () => SA.TPL_DESIGNS;
  const fmt = s => E.fmtTime(s);
  const secs = x => `${+(+x).toFixed(1)} s`;
  const KEY = 'saucedo-fotosecuencia';
  const THEME = key => Object.assign({ key }, SA.cards.THEMES[key] || SA.cards.THEMES.blanco);

  // Diseños de letras (los mismos de las plantillas): título al inicio y despedida al final.
  const DESIGNS = [
    { id: 'elegante', name: 'Elegante', in: 'eleganteIn', out: 'eleganteOut', intro: 5, outro: 6, ph: { title: 'Ana & Luis', subtitle: 'Nuestra boda', phrase: 'Los esperamos' } },
    { id: 'cine', name: 'De cine', in: 'cineIn', out: 'cineOut', all: 'letterbox', intro: 4.6, outro: 5.6, ph: { title: 'Ana & Luis', subtitle: 'Una historia de' } },
    { id: 'nostalgia', name: 'Nostalgia', in: 'filmIn', out: 'filmOut', intro: 4.8, outro: 5, ph: { title: 'Ana & Luis', subtitle: 'nuestra historia' } },
    { id: 'delicado', name: 'Delicado', in: 'bautizoIn', out: 'bautizoOut', intro: 4.6, outro: 5.2, ph: { title: 'Santiago', subtitle: 'Mi bautizo', phrase: 'Gracias por acompañarme' } },
    { id: 'maquina', name: 'Máquina de escribir', in: 'graciasIn', out: 'graciasOut', intro: 5.5, outro: 5, ph: { title: 'Ana & Luis', subtitle: 'Gracias por acompañarnos en este día' } },
    { id: 'minimal', name: 'Minimal', in: 'minimalIn', out: 'minimalOut', intro: 4, outro: 4, ph: { title: 'ana & luis', phrase: 'Gracias' } },
    { id: 'neon', name: 'Neón', in: 'neonIn', out: 'neonOut', intro: 4.5, outro: 5, ph: { title: 'Ana Sofía', subtitle: 'Mis XV', phrase: 'Gracias' } },
    { id: 'fiesta', name: 'Fiesta', in: 'cumpleIn', out: 'cumpleOut', intro: 4.2, outro: 4.6, ph: { title: 'Sofi', subtitle: '¡Feliz cumpleaños!', phrase: 'Gracias por celebrar conmigo' } },
    { id: 'mexicana', name: 'Mexicana', in: 'picadoIn', out: 'picadoOut', intro: 4.6, outro: 5, ph: { title: 'Ana Sofía', subtitle: '¡Que viva la fiesta!', phrase: '¡Gracias por venir!' } },
    { id: 'impacto', name: 'Impacto', in: 'impactoIn', out: 'impactoOut', intro: 3.6, outro: 3.6, ph: { title: 'LA MEJOR NOCHE', subtitle: 'XV ANA SOFÍA' } },
    { id: 'navidad', name: 'Navidad', in: 'navidadIn', out: 'navidadOut', intro: 4.6, outro: 5.4, ph: { title: 'Familia Saucedo', subtitle: '¡Feliz Navidad!', phrase: 'Felices fiestas' } },
    { id: 'glitch', name: 'Glitch', in: 'glitchIn', out: 'glitchOut', intro: 3.8, outro: 3.8, ph: { title: 'XV ANA SOFÍA', subtitle: 'la mejor noche' } },
    { id: 'ninguno', name: 'Sin letras', in: null, out: null, intro: 0, outro: 0, ph: {} }
  ];
  const FIELDS = [['title', 'Título'], ['subtitle', 'Frase de arriba'], ['phrase', 'Frase final'], ['date', 'Fecha'], ['place', 'Lugar (opcional)']];
  const MOVES = [['auto', 'Automático'], ['in', 'Acercar'], ['out', 'Alejar'], ['left', 'Hacia la izquierda'], ['right', 'Hacia la derecha'], ['up', 'Hacia arriba'], ['down', 'Hacia abajo'], ['none', 'Quieta']];
  const ZOOM = .12;
  const DEF = { design: 'elegante', values: {}, theme: 'dorado', shadow: 'auto', capStyle: 'elegante', style: 'elegante', dur: 4, move: 'auto',
    song: null, beatOn: true, fit: false, formats: ['h'], enhance: true, weight: 'normal' };

  class Fotosecuencia {
    constructor(root) {
      this.root = root; this.photos = []; this.sel = null; this.uid = 0; this.queue = []; this.pumping = false; this.busy = false;
      this.t = 0; this.playing = false; this.song = null; this.beat = null; this.comp = new Map();
      this.st = Object.assign({}, DEF, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })());
      this.st.values = Object.assign({}, this.st.values || {}); this.st.songStart = 0;
      this.build(); this.bind();
      new ResizeObserver(() => this.sizePreview()).observe(this.q('stage'));
      SA.onBrandChange(() => this.syncStyle());
      this.restoreSong(); this.syncStyle(); this.renderDetail(); this.summary(); this.loop();
    }
    q(n) { return this.root.querySelector(`[data-el="${n}"]`); }
    design() { return DESIGNS.find(d => d.id === this.st.design) || DESIGNS[0]; }
    theme() { return Object.assign(THEME(this.st.theme), { shadow: this.st.shadow || 'auto' }); }
    save() {
      const { design, values, theme, shadow, capStyle, style, dur, move, song, beatOn, fit, formats, enhance, weight } = this.st;
      try { localStorage.setItem(KEY, JSON.stringify({ design, values: { subtitle: values.subtitle, phrase: values.phrase }, theme, shadow, capStyle, style, dur, move, song, beatOn, fit, formats, enhance, weight })); } catch (e) {}
    }

    build() {
      const seg = (name, list, cls) => `<div class="seg${cls ? ' ' + cls : ''}" data-el="${name}" role="radiogroup">${list.map(([k, t]) => `<button type="button" data-v="${k}">${t}</button>`).join('')}</div>`;
      this.root.innerHTML = `
      <aside class="steps" aria-label="Pasos de la fotosecuencia">
        <section class="step">
          <h2><span class="num">1</span>Fotos</h2>
          <button class="drop" type="button" data-act="add"><strong>Agregar fotos</strong><span>o arrástralas a esta ventana</span></button>
          <div class="links"><button class="link" type="button" data-act="folder">Elegir una carpeta completa</button><button class="link" type="button" data-act="sortName" data-el="sortName" hidden>Ordenar por nombre</button><button class="link danger" type="button" data-act="clear" hidden>Quitar todas</button></div>
          <p class="count" data-el="count" aria-live="polite">Todavía no hay fotos.</p>
        </section>
        <section class="step">
          <h2><span class="num">2</span>Letras</h2>
          <div class="field"><span class="lbl">Diseño</span><div class="fs-designs" data-el="designs">${DESIGNS.map(d => `<button type="button" class="fsd" data-v="${d.id}"><canvas width="160" height="90" aria-hidden="true"></canvas><span>${d.name}</span></button>`).join('')}</div></div>
          <div class="fields" data-el="fields">${FIELDS.map(([k, t]) => `<label class="field"><span class="lbl">${t}</span><input class="input" data-f="${k}" type="${k === 'date' ? 'date' : 'text'}" autocomplete="off"></label>`).join('')}</div>
          <p class="hint" data-el="fieldsHint">Si dejas una frase vacía, se usa la que ves en gris.</p>
          <div class="field"><span class="lbl">Color de las letras</span><div class="chips" data-el="theme" role="radiogroup">${Object.entries(SA.cards.THEMES).map(([k, v]) => `<button type="button" class="chip" data-v="${k}"><span class="sw" style="background:${v.accent}"></span>${v.name}</button>`).join('')}</div></div>
          <div class="field"><span class="lbl">Sombra de las letras</span>${seg('shadow', SA.SHADOWS)}</div>
          <div class="field"><span class="lbl">Letreros en las fotos</span>${seg('capStyle', [['elegante', 'Elegante'], ['globo', 'Globo (estilo CapCut)']])}
            <p class="hint">Para ponerle un letrero a una foto ("Los novios", "La familia"), tócala y escríbelo.</p></div>
        </section>
        <section class="step">
          <h2><span class="num">3</span>Transiciones y movimiento</h2>
          <div class="field"><span class="lbl">Transiciones automáticas</span>${seg('style', Object.entries(E.FS_STYLES).map(([k, v]) => [k, v.name]))}
            <p class="hint" data-el="styleHint"></p></div>
          <div class="field"><span class="lbl">Cuánto dura cada foto</span>
            <div class="stepper"><button type="button" data-act="dur" data-v="-0.5">−</button><output data-el="durOut">4 s</output><button type="button" data-act="dur" data-v="0.5">+</button></div></div>
          <div class="field"><span class="lbl">Movimiento de las fotos</span>${seg('move', [['auto', 'Acercar, alejar y recorrer'], ['in', 'Solo acercar'], ['none', 'Quietas']])}</div>
          <p class="hint">Toca una foto (abajo) para darle su propia transición, movimiento o duración.</p>
        </section>
        <section class="step">
          <h2><span class="num">4</span>Música</h2>
          <div class="mcard" data-el="mcard"></div>
          <div class="field" data-el="startBox" hidden><span class="lbl">La canción empieza en</span>
            <div class="stepper"><button type="button" data-act="ss" data-v="-5">−5 s</button><output data-el="ss">0:00</output><button type="button" data-act="ss" data-v="5">+5 s</button></div></div>
          <div class="sw-row" data-el="beatRow" hidden><button class="switch" type="button" role="switch" data-act="beatOn" data-el="beatOn" aria-labelledby="fsBeat"></button><span class="sw-state" id="fsBeat" data-el="beatTxt">Cambiar de foto al ritmo</span></div>
          <div class="sw-row" data-el="fitRow" hidden><button class="switch" type="button" role="switch" data-act="fit" data-el="fit" aria-labelledby="fsFit"></button><span class="sw-state" id="fsFit">Que dure toda la canción</span></div>
        </section>
        <section class="step">
          <h2><span class="num">5</span>Formato y logo</h2>
          <div class="chips" data-el="formats" role="group" aria-label="Formatos">${Object.entries(E.FORMATS).map(([k, v]) => `<button type="button" class="chip fmt" data-v="${k}"><span class="ar ar-${k}"></span>${v.label}</button>`).join('')}</div>
          <p class="hint">Puedes elegir varios: se crea un video de cada uno.</p>
          <button class="big" type="button" data-act="enhance"><span class="t">Mejorar colores</span><span class="pill" data-el="enhState">Activado</span></button>
          <div class="sw-row"><button class="switch" type="button" role="switch" data-act="wm" data-el="wm" aria-labelledby="fsWm"></button><span class="sw-state" id="fsWm" data-el="wmTxt"></span></div>
          <div class="field" data-el="wmSizeBox"><span class="lbl">Tamaño del logo</span>${seg('wmSize', [['s', 'Chico'], ['m', 'Mediano'], ['l', 'Grande']])}</div>
        </section>
        <section class="step">
          <h2><span class="num">6</span>Crear video</h2>
          <div class="field"><span class="lbl">Peso del video</span>${seg('weight', Object.entries(E.WEIGHTS).map(([k, v]) => [k, v.name]))}<p class="hint" data-el="weightHint"></p></div>
          <p class="summary" data-el="summary"></p>
          <button class="primary" type="button" data-act="create" data-el="create">Crear fotosecuencia</button>
          <div class="progress" data-el="progress" hidden>
            <div class="prog-row"><span data-el="progText">Preparando…</span><button class="link" type="button" data-act="cancel">Cancelar</button></div>
            <div class="bar"><i data-el="bar"></i></div>
            <p class="prog-sub" data-el="progSub"></p>
          </div>
          <div class="done-row" data-el="done" hidden><button class="btn" type="button" data-act="watch">Ver video</button><button class="btn" type="button" data-act="openDir">Abrir la carpeta</button></div>
        </section>
      </aside>
      <section class="mesa fs-mesa" aria-label="Vista previa">
        <div class="fs-top">
          <div class="fs-player">
            <div class="stage fs-stage" data-el="stage">
              <canvas data-el="pv" aria-label="Vista previa de la fotosecuencia"></canvas>
              <div class="empty" data-el="empty"><p class="t">Arrastra aquí las fotos</p><p>Se acomodan en el orden en que las agregues. Después puedes moverlas.</p><button class="btn-light" type="button" data-act="add">Agregar fotos</button></div>
            </div>
            <div class="fs-ctrl" data-el="ctrl" hidden>
              <button class="navbtn" type="button" data-act="play" data-el="playBtn">▶ Ver</button>
              <input type="range" class="fs-seek" data-el="seek" min="0" max="100" step="0.05" value="0" aria-label="Posición">
              <span class="fs-time" data-el="time">0:00 / 0:00</span>
            </div>
          </div>
          <div class="detail" data-el="detail"></div>
        </div>
        <div class="film-wrap" data-el="filmWrap" hidden><div class="film fs-film" data-el="film" aria-label="Fotos en orden"></div></div>
      </section>`;
      this.root.classList.add('work', 'fsview');
    }

    bind() {
      const R = this.root;
      R.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || !R.contains(b)) return;
        const fn = this['act_' + b.dataset.act];
        if (fn) fn.call(this, b, e);
      });
      const segS = (name, key, after) => SA.ui.seg(this.q(name), this.st[key], v => { this.st[key] = v; this.changed(); if (after) after(v); });
      segS('shadow', 'shadow'); segS('capStyle', 'capStyle'); segS('style', 'style', () => this.renderFilm()); segS('move', 'move'); segS('weight', 'weight');
      SA.ui.seg(this.q('theme'), this.st.theme, v => { this.st.theme = v; this.changed(); });
      SA.ui.seg(this.q('wmSize'), S.size || 'm', v => { S.size = v; SA.brandChanged(); });
      $$('.fsd', this.q('designs')).forEach(b => {
        b.addEventListener('click', () => { this.st.design = b.dataset.v; this.changed(); this.t = 0; this.setPlaying(true); });
        const cv = b.querySelector('canvas'); let raf = 0, t0 = 0;
        b.addEventListener('mouseenter', () => { t0 = performance.now(); const lp = now => { this.drawDesignCard(cv, b.dataset.v, ((now - t0) / 1000) % 4.5); raf = requestAnimationFrame(lp); }; raf = requestAnimationFrame(lp); });
        b.addEventListener('mouseleave', () => { cancelAnimationFrame(raf); this.drawDesignCard(cv, b.dataset.v, 3); });
      });
      $$('[data-f]', this.q('fields')).forEach(inp => {
        if (inp.dataset.f === 'date') inp.value = this.st.values.date || '';
        else inp.value = this.st.values[inp.dataset.f] || '';
        inp.addEventListener('input', () => { this.st.values[inp.dataset.f] = inp.value; this.save(); this.summary(); });
      });
      $$('.fmt', this.q('formats')).forEach(b => b.addEventListener('click', () => {
        const set = new Set(this.st.formats); set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
        if (!set.size) { toast('Elige por lo menos un formato.'); return; }
        this.st.formats = [...set]; this.pvFmt = set.has(b.dataset.v) ? b.dataset.v : null; this.changed(); this.sizePreview();
      }));
      const seek = this.q('seek');
      seek.addEventListener('input', () => { this.t = +seek.value; this.setPlaying(false); });
      this.q('pv').addEventListener('click', () => { if (this.photos.length) this.setPlaying(!this.playing); });
    }
    changed() { this.save(); this.syncStyle(); this.planCache = null; this.summary(); this.renderDetail(); }
    syncStyle() {
      const st = this.st;
      $$('.fsd', this.q('designs')).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === st.design)); this.drawDesignCard(b.querySelector('canvas'), b.dataset.v, 3); });
      const d = this.design();
      $$('[data-f]', this.q('fields')).forEach(inp => { inp.placeholder = d.ph[inp.dataset.f] || ''; inp.closest('.field').hidden = d.id === 'ninguno' && inp.dataset.f !== 'title'; });
      SA.ui.setSeg(this.q('theme'), st.theme); SA.ui.setSeg(this.q('shadow'), st.shadow || 'auto'); SA.ui.setSeg(this.q('capStyle'), st.capStyle);
      SA.ui.setSeg(this.q('style'), st.style); SA.ui.setSeg(this.q('move'), st.move); SA.ui.setSeg(this.q('weight'), st.weight);
      this.q('styleHint').textContent = { suave: 'Fundidos lentos y desenfoques: para bodas, XV y momentos emotivos.', elegante: 'Fundidos, deslizamientos suaves, círculo y destellos.',
        dinamica: 'Empujes, acercamientos, barridos y reloj, más rápidas: para fiestas y redes.', cortes: 'Cambio directo de una foto a otra, sin transición.' }[st.style] || '';
      this.q('durOut').textContent = `${st.dur} s`;
      $$('.fmt', this.q('formats')).forEach(b => b.setAttribute('aria-pressed', String(st.formats.includes(b.dataset.v))));
      const enh = this.root.querySelector('[data-act="enhance"]'); enh.setAttribute('aria-pressed', String(st.enhance)); this.q('enhState').textContent = st.enhance ? 'Activado' : 'Apagado';
      this.q('wm').setAttribute('aria-checked', String(S.wm)); this.q('wmSizeBox').hidden = !S.wm; SA.ui.setSeg(this.q('wmSize'), S.size || 'm');
      this.q('wmTxt').textContent = S.wm ? 'Logo en cada foto' : 'Sin logo';
      this.q('beatOn').setAttribute('aria-checked', String(st.beatOn)); this.q('fit').setAttribute('aria-checked', String(st.fit));
      const w = E.WEIGHTS[st.weight] || E.WEIGHTS.normal;
      this.q('weightHint').textContent = { ligero: 'Para mandar por WhatsApp o subir rápido: 720p, pesa poco y se crea más rápido.',
        normal: 'Full HD 1080p: se ve bien en la tele y en redes.', alta: 'La mejor calidad en 1080p para entregar al cliente; el archivo pesa más.' }[st.weight] + ` Aproximadamente ${w.mbMin} MB por minuto.`;
    }
    drawDesignCard(cv, id, t) {
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, d = DESIGNS.find(x => x.id === id);
      ctx.save(); ctx.clearRect(0, 0, W, H);
      const ph = this.photos.find(p => p.status === 'ok');
      if (ph) C.drawFit(ctx, ph.thumb, W, H, 'cover'); else { if (!this.sampleBg) this.sampleBg = A.sampleBg(320, 180, 1); C.drawFit(ctx, this.sampleBg, W, H, 'cover'); }
      if (d && d.in) {
        const data = this.data(true, d), th = this.theme();
        if (d.all) A.draw(D()[d.all], ctx, W, H, 3, 9, data, th);
        A.draw(D()[d.in], ctx, W, H, Math.min(t, d.intro), d.intro, data, th);
      }
      ctx.restore();
    }
    data(preview, d) {
      d = d || this.design();
      const v = this.st.values, out = {};
      ['title', 'subtitle', 'phrase', 'place'].forEach(k => { out[k] = (v[k] || '').trim() || (preview || k !== 'title' ? (d.ph[k] || '') : ''); });
      out.date = SA.ui.parseDate(v.date) || (preview ? { y: new Date().getFullYear() + 1, m: 5, d: 20 } : null);
      return out;
    }

    /* ---------- Fotos ---------- */
    act_add() { B.pick('images', true).then(p => p.length && this.addPaths(p)); }
    act_folder() { B.pickFolder().then(p => p && this.addPaths([p])); }
    async addPaths(paths) {
      const list = await B.listMedia(paths);
      const imgs = list.filter(f => f.kind === 'image'), aud = list.filter(f => f.kind === 'audio'), vids = list.filter(f => f.kind === 'video').length;
      if (aud.length) this.setSong(aud[0].path);
      if (!imgs.length) { if (!aud.length) toast(vids ? 'La fotosecuencia es solo con fotos. Los videos se usan en Plantillas o en la Película.' : 'No encontré fotos en lo que agregaste.'); return; }
      if (vids) toast(`Se dejaron fuera ${vids} ${vids === 1 ? 'video' : 'videos'}: la fotosecuencia es solo con fotos.`);
      const known = new Set(this.photos.map(p => p.path));
      const news = imgs.filter(f => !known.has(f.path)).map(f => ({ id: ++this.uid, path: f.path, name: f.name, status: 'loading' }));
      this.photos.push(...news); this.planCache = null;
      this.renderFilm(); this.counts(); this.q('done').hidden = true;
      this.queue.push(...news); this.pump();
    }
    async pump() {
      if (this.pumping) return; this.pumping = true;
      while (this.queue.length) {
        const p = this.queue.shift(); if (!this.photos.includes(p)) continue;
        try {
          const bmp = await createImageBitmap(await B.readBlob(p.path));
          p.w = bmp.width; p.h = bmp.height; p.thumb = C.downscale(bmp, 480); bmp.close && bmp.close();
          p.stats = C.computeStats(p.thumb); p.status = 'ok';
        } catch (e) { p.status = 'error'; p.err = /\.(heic|heif)$/i.test(p.name) ? 'HEIC del iPhone: no se abre' : 'No se pudo abrir'; }
        this.paintThumb(p); this.planCache = null; this.counts();
        if (!this.sel && p.status === 'ok') this.select(p, true);
      }
      this.pumping = false; this.counts(); this.syncStyle(); this.renderFilm(); this.renderDetail();
    }
    ok() { return this.photos.filter(p => p.status === 'ok'); }
    counts() {
      const ok = this.ok().length, ld = this.photos.filter(p => p.status === 'loading').length, er = this.photos.filter(p => p.status === 'error').length;
      let t = !this.photos.length ? 'Todavía no hay fotos.' : ld ? `Cargando ${this.photos.length - ld} de ${this.photos.length}…` : `${ok} ${ok === 1 ? 'foto' : 'fotos'}`;
      if (er) t += ` · ${er} no se ${er === 1 ? 'pudo' : 'pudieron'} abrir`;
      this.q('count').textContent = t;
      this.root.querySelector('[data-act="clear"]').hidden = !this.photos.length;
      this.q('sortName').hidden = this.photos.length < 2;
      this.q('empty').hidden = !!this.photos.length; this.q('ctrl').hidden = !ok; this.q('filmWrap').hidden = !this.photos.length;
      this.summary();
    }
    renderFilm() {
      const film = this.q('film'), plan = this.plan(), okList = this.ok();
      film.innerHTML = '';
      this.photos.forEach((p, i) => {
        const k = okList.indexOf(p);
        if (k > 0 && plan) {
          const tr = plan.transitions[k - 1], d = plan.Ts[k - 1], own = p.trans && p.trans.type && p.trans.type !== 'auto';
          const b = document.createElement('button'); b.type = 'button'; b.className = 'fs-tj' + (own ? ' own' : ''); b.dataset.act = 'tj'; b.dataset.id = p.id;
          b.title = `Transición: ${d ? TR.name(tr) : 'Corte directo'}. Toca para verla.`; b.innerHTML = `<span>⇄</span><small>${esc(d ? TR.name(tr) : 'Corte')}</small>`;
          film.appendChild(b);
        }
        const w = document.createElement('div'); w.className = 'thumb' + (p === this.sel ? ' on' : '');
        w.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')} ▸ <span class="kind">${plan && k >= 0 ? secs(plan.dur[k]) : ''}</span></span><button type="button" class="pick"><span class="ph">Cargando…</span></button><button type="button" class="x" aria-label="Quitar" title="Quitar">×</button>`;
        w.querySelector('.pick').addEventListener('click', () => this.select(p));
        w.querySelector('.x').addEventListener('click', () => this.remove(p));
        p.el = w; film.appendChild(w); this.paintThumb(p);
      });
    }
    paintThumb(p) {
      if (!p.el) return;
      const pick = p.el.querySelector('.pick');
      if (p.status === 'error') { pick.innerHTML = `<span class="ph err">${esc(p.err)}</span>`; return; }
      if (p.status !== 'ok') return;
      pick.textContent = '';
      const c = document.createElement('canvas'); c.width = p.thumb.width; c.height = p.thumb.height; c.getContext('2d').drawImage(p.thumb, 0, 0); pick.appendChild(c);
      const marks = [p.caption && 'T', p.move && p.move !== 'auto' && '↔', p.dur && '⏱'].filter(Boolean);
      if (marks.length) { const s = document.createElement('span'); s.className = 'dur'; s.textContent = marks.join(' '); pick.appendChild(s); }
    }
    select(p, quiet) {
      this.sel = p;
      this.photos.forEach(x => x.el && x.el.classList.toggle('on', x === p));
      if (p && p.el) p.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.renderDetail();
      if (!quiet && p) { const plan = this.plan(), k = this.ok().indexOf(p); if (plan && k >= 0) { this.t = plan.shown[k].a + .05; this.setPlaying(false); } }
    }
    keyNav(dir) { const i = this.photos.indexOf(this.sel) + dir; if (i >= 0 && i < this.photos.length) this.select(this.photos[i]); }
    onKey(e) {
      if (this.root.hidden || !this.photos.length) return false;
      if (e.key === ' ') { this.setPlaying(!this.playing); return true; }
      return false;
    }
    move(dir) {
      const i = this.photos.indexOf(this.sel), j = i + dir;
      if (i < 0 || j < 0 || j >= this.photos.length) return;
      [this.photos[i], this.photos[j]] = [this.photos[j], this.photos[i]];
      this.planCache = null; this.renderFilm(); this.select(this.sel); this.summary();
    }
    act_left() { this.move(-1); }
    act_right() { this.move(1); }
    act_removeSel() { if (this.sel) this.remove(this.sel); }
    remove(p) {
      const i = this.photos.indexOf(p); if (i < 0) return;
      this.photos.splice(i, 1); this.planCache = null; this.comp.delete(p.id);
      if (this.sel === p) this.sel = this.photos[i] || this.photos[i - 1] || null;
      this.renderFilm(); this.counts(); this.renderDetail();
    }
    act_sortName() {
      this.photos.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
      this.planCache = null; this.renderFilm(); this.renderDetail(); this.summary(); toast('Fotos ordenadas por nombre (como salen de la cámara).');
    }
    act_clear(b) {
      if (!this.clearArm) { b.textContent = '¿Seguro? Toca otra vez'; this.clearArm = setTimeout(() => { this.clearArm = 0; b.textContent = 'Quitar todas'; }, 4000); return; }
      clearTimeout(this.clearArm); this.clearArm = 0; b.textContent = 'Quitar todas';
      this.photos = []; this.queue.length = 0; this.sel = null; this.comp.clear(); this.planCache = null; this.t = 0; this.setPlaying(false);
      this.renderFilm(); this.counts(); this.renderDetail();
    }

    /* ---------- Panel de la foto elegida ---------- */
    renderDetail() {
      const d = this.q('detail'), p = this.sel, plan = this.plan();
      if (!p || p.status !== 'ok' || !plan) {
        d.innerHTML = `<p class="hint">${this.photos.length ? 'Toca una foto de abajo para darle su propia transición, movimiento, duración o letrero.' : 'Agrega fotos para empezar. Cada una tendrá movimiento y una transición profesional; puedes cambiarlas una por una.'}</p>
          <p class="hint">Toca la imagen grande o la barra de espacio para ver la fotosecuencia completa con su música.</p>`;
        return;
      }
      const k = this.ok().indexOf(p), n = this.ok().length, w = plan.shown[k];
      const tr = p.trans || {};
      d.innerHTML = `
        <h3 class="d-t">${esc(p.name)}</h3>
        <p class="d-sub">Foto ${k + 1} de ${n} · se ve ${secs(plan.dur[k])} (de ${fmt(w.a)} a ${fmt(w.b)})</p>
        <button class="btn" type="button" data-act="playHere">▶ Ver desde aquí</button>
        ${k > 0 ? `<div class="field"><span class="lbl">Transición al entrar esta foto</span>${TR.gridHtml(TR.TYPES, tr.type, 'setTrans')}
          ${tr.type && tr.type !== 'auto' && tr.type !== 'corte' ? `<span class="lbl">Duración de la transición</span><div class="seg small" data-el="tdur">${TR.DURS.map(([v, t]) => `<button type="button" data-act="tdur" data-v="${v}" aria-checked="${String(v) === String(tr.dur || .8)}">${t}</button>`).join('')}</div>` : ''}
          <div class="links"><button class="link" type="button" data-act="transAll">Usar esta transición en todas</button></div></div>`
        : '<p class="flag tip">Es la primera foto: aquí aparece el título.</p>'}
        <div class="field"><span class="lbl">Movimiento</span><div class="chips mv">${MOVES.map(([v, t]) => `<button type="button" class="chip" data-act="setMove" data-v="${v}" aria-pressed="${(p.move || 'auto') === v}">${t}</button>`).join('')}</div></div>
        <div class="field"><span class="lbl">Cuánto dura esta foto</span><div class="stepper"><button type="button" data-act="pDur" data-v="-0.5">−</button><output>${p.dur ? p.dur + ' s' : `Como todas (${this.st.dur} s)`}</output><button type="button" data-act="pDur" data-v="0.5">+</button></div>
          ${p.dur ? '<button class="link" type="button" data-act="pDurReset">Que dure como todas</button>' : ''}</div>
        <label class="field"><span class="lbl">Letrero en esta foto (opcional)</span><input class="input" type="text" data-el="cap" maxlength="40" placeholder="Ej. Los novios" value="${esc(p.caption || '')}" autocomplete="off"></label>
        <div class="d-actions"><button class="navbtn dark" type="button" data-act="left" ${k <= 0 ? 'disabled' : ''}>‹ Antes</button><button class="navbtn dark" type="button" data-act="right" ${k >= n - 1 ? 'disabled' : ''}>Después ›</button><button class="btn" type="button" data-act="removeSel">Quitar foto</button></div>`;
      const cap = d.querySelector('[data-el="cap"]');
      cap.addEventListener('input', () => { p.caption = cap.value.trim() || undefined; this.paintThumb(p); });
      const prev = this.ok()[k - 1], grid = d.querySelector('.trans-grid');
      if (grid) TR.animate(grid, () => ({ a: prev && prev.thumb, b: p.thumb, auto: plan.Ts[k - 1] ? plan.transitions[k - 1] : 'corte' }));
    }
    act_setTrans(b) { const p = this.sel; p.trans = b.dataset.v === 'auto' ? undefined : { type: b.dataset.v, dur: (p.trans && p.trans.dur) || .8 }; this.edited(true); this.previewJoin(p); }
    act_tdur(b) { const p = this.sel; p.trans = Object.assign({}, p.trans, { dur: +b.dataset.v }); this.edited(true); this.previewJoin(p); }
    act_transAll() {
      const p = this.sel, t = p.trans; this.ok().forEach((x, i) => { if (i > 0) x.trans = t ? Object.assign({}, t) : undefined; });
      this.edited(true); toast(t ? `Todas las fotos entran con "${TR.name(t.type)}".` : 'Todas las fotos usan las transiciones automáticas.');
    }
    act_setMove(b) { this.sel.move = b.dataset.v === 'auto' ? undefined : b.dataset.v; this.edited(); this.act_playHere(); }
    act_pDur(b) { const p = this.sel; p.dur = Math.max(1.5, Math.min(15, (p.dur || this.st.dur) + (+b.dataset.v))); this.edited(true); }
    act_pDurReset() { this.sel.dur = undefined; this.edited(true); }
    edited(film) { this.planCache = null; if (film) this.renderFilm(); else this.paintThumb(this.sel); this.renderDetail(); this.summary(); }
    act_playHere() { const plan = this.plan(), k = this.ok().indexOf(this.sel); if (!plan || k < 0) return; this.t = Math.max(0, (k ? plan.starts[k] : 0) - .3); this.setPlaying(true); }
    // Ver una transición: desde un poco antes del cambio.
    previewJoin(p) { const plan = this.plan(), k = this.ok().indexOf(p); if (!plan || k <= 0) return; this.t = Math.max(0, plan.starts[k] - 1); this.setPlaying(true); this.stopAt = plan.shown[k].a + 1; }
    act_tj(b) { const p = this.photos.find(x => x.id === +b.dataset.id); if (!p) return; this.select(p, true); this.previewJoin(p); const g = this.q('detail').querySelector('.trans-grid'); if (g) g.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

    /* ---------- Estilo, música y duración ---------- */
    act_dur(b) { this.st.dur = Math.max(2, Math.min(10, this.st.dur + (+b.dataset.v))); this.changed(); this.renderFilm(); }
    act_enhance() { this.st.enhance = !this.st.enhance; this.comp.clear(); this.changed(); }
    act_wm() { S.wm = !S.wm; SA.brandChanged(); this.syncStyle(); }
    act_beatOn() { this.st.beatOn = !this.st.beatOn; this.changed(); this.renderFilm(); }
    act_fit() { this.st.fit = !this.st.fit; this.changed(); this.renderFilm(); }
    act_ss(b) { if (!this.song) return; this.st.songStart = Math.max(0, Math.min(Math.floor(this.song.duration - 10), this.st.songStart + (+b.dataset.v))); this.st.startAuto = false; this.renderSong(); this.planCache = null; this.summary(); }
    restoreSong() {
      const s = this.st.song;
      if (s === 'none') { this.song = null; this.renderSong(); return; }
      if (s && s.builtin && SA.music.get(s.builtin)) { this.useBuiltin(s.builtin); return; }
      if (s && s.path) { this.setSong(s.path, true).then(ok => { if (!ok) this.useBuiltin('para-siempre'); }); return; }
      if (SA.music.available()) this.useBuiltin('para-siempre'); else this.renderSong();
    }
    useBuiltin(id) {
      const s = SA.music.song(id); if (!s) { this.renderSong(); return; }
      this.stopAudio(); this.song = s; this.beat = s.beat; this.st.song = { builtin: id }; this.st.songStart = 0; this.st.startAuto = true;
      this.save(); this.renderSong(); this.planCache = null; this.summary();
    }
    async setSong(path, quiet) {
      try {
        const pr = await B.probe(path); if (!pr.hasAudio || !pr.duration) throw new Error('sin audio');
        this.stopAudio(); this.song = { path, name: B.baseName(path), duration: pr.duration }; this.beat = null; this.st.song = { path }; this.st.songStart = 0; this.st.startAuto = false;
        this.save(); this.renderSong(); this.planCache = null; this.summary();
        this.detectBeat(this.song);
        return true;
      } catch (e) { if (!quiet) toast('No se pudo leer esa canción. Prueba con un MP3 o M4A.'); return false; }
    }
    async detectBeat(song) {
      try {
        if (!this.tmpDir) this.tmpDir = await B.newJobDir();
        const out = B.join(this.tmpDir, `ritmo_${E.hash(song.path)}.raw`);
        const r = await B.run('ffmpeg', E.songDecodeArgs(song.path, 0, Math.min(song.duration, 420), out));
        if (r.code !== 0 || this.song !== song) return;
        const info = E.detectBeats(new Float32Array(await (await B.readBlob(out)).arrayBuffer()), 11025);
        if (info && this.song === song) { this.beat = info; this.renderSong(); this.planCache = null; this.summary(); }
      } catch (e) {}
    }
    async act_song() {
      this.stopAudio();
      const r = await SA.music.pick({ title: 'Música de la fotosecuencia', forName: 'Fotosecuencia', suggest: ['para-siempre', 'nuestra-historia', 'brillar', 'cafe-de-la-tarde', 'vals-de-quince'], current: this.song, allowNone: true, noneLabel: 'Sin música' });
      if (!r) return;
      if (r.kind === 'builtin') this.useBuiltin(r.id); else if (r.kind === 'file') this.setSong(r.path);
      else { this.stopAudio(); this.song = null; this.beat = null; this.st.song = 'none'; this.save(); this.renderSong(); this.planCache = null; this.summary(); }
    }
    renderSong() {
      const el = this.q('mcard'), s = this.song;
      el.classList.toggle('empty', !s);
      el.innerHTML = s ? `<button class="mplay" type="button" data-act="listen" aria-label="Escuchar"><span class="ic">▶</span></button>
          <div class="minfo"><div class="mname">${esc(s.name)}</div><div class="mdesc">${esc(SA.music.sub(s))}</div></div>
          <div class="mcard-actions" style="grid-column:2"><button class="btn" type="button" data-act="song">Cambiar música</button></div>`
        : `<div class="minfo"><div class="mname">Sin música</div><div class="mdesc">La fotosecuencia saldrá sin sonido.</div></div><div class="mcard-actions"><button class="btn" type="button" data-act="song">Elegir música</button></div>`;
      this.q('startBox').hidden = !s; this.q('ss').textContent = fmt(this.st.songStart || 0);
      this.q('beatRow').hidden = !(s && this.beat); this.q('fitRow').hidden = !s;
      if (this.beat) this.q('beatTxt').textContent = `Cambiar de foto al ritmo (${Math.round(this.beat.bpm)} golpes por minuto)`;
    }
    async act_listen() {
      if (this.playing) this.setPlaying(false);
      if (SA.music.playing()) { SA.music.stop(); return; }
      if (!this.song) return;
      const icon = on => { const i = this.root.querySelector('.mcard .ic'); if (i) i.textContent = on ? '■' : '▶'; };
      if (await SA.music.play(this.song, this.st.songStart, () => icon(false))) icon(true);
    }

    /* ---------- Plan (tiempos de cada foto y transición) ---------- */
    plan() {
      const okList = this.ok(); if (!okList.length) return null;
      const d = this.design();
      // Canciones incluidas en una fotosecuencia corta: empieza en la mejor parte.
      if (this.song && this.song.builtin && this.st.startAuto) {
        const approx = okList.reduce((s, p) => s + (p.dur || this.st.dur), 0);
        this.st.songStart = !this.st.fit && approx <= 75 ? SA.music.bestStart(this.song.builtin, approx) : 0;
        const ss = this.q('ss'); if (ss) ss.textContent = fmt(this.st.songStart);
      }
      const key = JSON.stringify([okList.map(p => [p.id, p.dur, p.trans, p.move]), this.st.dur, this.st.style, this.st.move, this.st.design, this.st.fit, this.st.beatOn, this.st.songStart, this.song && this.song.path, !!this.beat]);
      if (this.planCache && this.planKey === key) return this.planCache;
      let beat = null;
      if (this.beat && this.st.beatOn && this.song) { const s = this.st.songStart, nb = this.beat.beats.find(b => b >= s - .02); if (nb != null) beat = { period: this.beat.period, offset: Math.max(0, nb - s) }; }
      try {
        this.planCache = E.fsPlan({ photos: okList.map(p => ({ dur: p.dur, trans: p.trans, move: p.move })), dur: this.st.dur, style: E.FS_STYLES[this.st.style] || E.FS_STYLES.elegante,
          move: this.st.move, beat, fit: this.st.fit && this.song ? Math.max(10, this.song.duration - this.st.songStart) : null, introMin: d.intro, outroMin: d.outro });
      } catch (e) { this.planCache = null; }
      this.planKey = key;
      return this.planCache;
    }
    outDir() {
      const v = this.st.values, d = v.date || SA.ui.todayISO(), who = B.safeName(v.title || v.subtitle || '') || 'fotos';
      return B.join(B.paths.documents, 'Saucedo', B.safeName(`${d} Fotosecuencia ${who}`));
    }
    summary() {
      const el = this.q('summary'), plan = this.plan();
      if (!plan) { el.textContent = 'Agrega fotos para ver cuánto va a durar.'; this.syncTime(); return; }
      const docs = B.paths.documents || '', dir = this.outDir(), shown = dir.startsWith(docs) ? 'Documentos' + dir.slice(docs.length).split(/[\\/]/).join(' › ') : dir;
      const w = E.WEIGHTS[this.st.weight] || E.WEIGHTS.normal, n = this.st.formats.length, mb = Math.max(1, Math.round(plan.total / 60 * w.mbMin));
      const how = { suave: 'transiciones suaves', elegante: 'transiciones elegantes', dinamica: 'transiciones dinámicas', cortes: 'solo cortes' }[this.st.style] || '';
      el.innerHTML = `Duración: <strong>${fmt(plan.total)}</strong> · ${plan.segments.length} fotos · ${how}` +
        (this.song ? ` · ♪ ${esc(this.song.name)}` : ' · <strong>sin música</strong>') + `<br>${n === 1 ? 'Se crea 1 video' : `Se crean ${n} videos`} de unos ${mb} MB en ${esc(shown)}`;
      this.syncTime();
    }

    /* ---------- Vista previa ---------- */
    // La vista previa usa el último formato que se eligió.
    fmtPreview() { return E.FORMATS[this.pvFmt && this.st.formats.includes(this.pvFmt) ? this.pvFmt : this.st.formats[0]]; }
    sizePreview() {
      const cv = this.q('pv'), r = this.q('stage').getBoundingClientRect(); if (r.width < 50) return;
      const f = this.fmtPreview(), maxW = r.width - 32, maxH = r.height - 32;
      let fw = maxW, fh = fw * f.H / f.W; if (fh > maxH) { fh = maxH; fw = fh * f.W / f.H; }
      const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = Math.round(fw * dpr), H = Math.round(fh * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; this.comp.clear(); }
      cv.style.width = fw + 'px'; cv.style.height = fh + 'px';
    }
    // Foto acomodada al cuadro (como en el video: llena la pantalla o completa con fondo difuminado), con su color.
    compOf(p, W, H) {
      const k = p.id, c0 = this.comp.get(k);
      if (c0 && c0.width === W && c0.height === H) { this.comp.delete(k); this.comp.set(k, c0); return c0; }
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true }), img = p.thumb;
      const differ = Math.abs(Math.log((img.width / img.height) / (W / H))) > .35;
      if (!differ) C.drawFit(x, img, W, H, 'cover');
      else { x.filter = 'blur(14px) brightness(.8)'; C.drawFit(x, img, W, H, 'cover', 1.15); x.filter = 'none'; C.drawFit(x, img, W, H, 'contain'); }
      if (this.st.enhance) C.colorCanvas(x, W, H, p.stats, { auto: true, style: 'natural' });
      this.comp.set(k, c);
      while (this.comp.size > 14) this.comp.delete(this.comp.keys().next().value);
      return c;
    }
    // Cuadro de la foto k en el tiempo t, con su movimiento (igual que zoompan en FFmpeg).
    photoFrame(k, t, plan, okList) {
      return (ctx, W, H) => {
        const p = okList[k], img = this.compOf(p, W, H), sg = plan.segments[k], L = sg.len, pr = Math.max(0, Math.min(1, (t - plan.starts[k]) / L)), Z = ZOOM;
        let z = 1 + Z, fx = .5, fy = .5;
        const mv = sg.move;
        if (mv === 'in') z = 1 + Z * pr; else if (mv === 'out') z = 1 + Z - Z * pr; else if (mv === 'none') z = 1;
        else if (mv === 'left') fx = pr; else if (mv === 'right') fx = 1 - pr; else if (mv === 'up') fy = pr; else if (mv === 'down') fy = 1 - pr;
        ctx.save(); ctx.translate(-(W * z - W) * fx, -(H * z - H) * fy); ctx.scale(z, z); ctx.drawImage(img, 0, 0); ctx.restore();
      };
    }
    drawAt(t) {
      const cv = this.q('pv'), W = cv.width, H = cv.height, ctx = cv.getContext('2d'), plan = this.plan(), okList = this.ok();
      if (!W || !plan) { ctx.clearRect(0, 0, W, H); return; }
      const n = okList.length;
      let k = 0; while (k + 1 < n && t >= plan.starts[k + 1]) k++;
      ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      // ¿Está en medio de una transición?
      if (k > 0 && t < plan.starts[k] + plan.eff[k - 1]) {
        const p = (t - plan.starts[k]) / plan.eff[k - 1], type = plan.Ts[k - 1] ? plan.transitions[k - 1] : 'corte';
        TR.draw(ctx, W, H, this.photoFrame(k - 1, t, plan, okList), this.photoFrame(k, t, plan, okList), type, p);
      } else this.photoFrame(k, t, plan, okList)(ctx, W, H);
      // Letras
      const d = this.design(), th = this.theme(), data = this.data(true);
      if (d.all) A.draw(D()[d.all], ctx, W, H, t, plan.total, data, th);
      if (d.in && t < plan.intro.b) this.layer(ctx, D()[d.in], t - plan.intro.a, plan.intro.b - plan.intro.a, data, th, .5, .7, plan.intro.b - t);
      if (d.out && plan.outro && t >= plan.outro.a) this.layer(ctx, D()[d.out], t - plan.outro.a, plan.outro.b - plan.outro.a, data, th, .9, 0, 9);
      this.captions(plan, okList).forEach(c => {
        if (t < c.a || t > c.b) return;
        ctx.save(); ctx.globalAlpha = Math.min(1, (t - c.a) / .4, (c.b - t) / .4); this.drawCaption(ctx, W, H, c.text, th, c.k); ctx.restore();
      });
      if (S.wm) SA.drawWatermark(ctx, W, H, S, SA.VIDEO_WM_SCALE);
      ctx.restore();
      // Entrada y salida en negro
      const fa = Math.max(t < .5 ? 1 - t / .5 : 0, t > plan.total - 1 ? (t - (plan.total - 1)) : 0);
      if (fa > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fa)})`; ctx.fillRect(0, 0, W, H); }
    }
    layer(ctx, design, lt, dur, data, th, fin, fout, left) {
      if (!design) return;
      if (!this._lc || this._lc.width !== ctx.canvas.width || this._lc.height !== ctx.canvas.height) this._lc = Object.assign(document.createElement('canvas'), { width: ctx.canvas.width, height: ctx.canvas.height });
      const lx = this._lc.getContext('2d'); lx.clearRect(0, 0, this._lc.width, this._lc.height); lx.save();
      A.draw(design, lx, this._lc.width, this._lc.height, design.static ? 3 : Math.min(lt, dur), dur, data, th); lx.restore();
      ctx.save();
      let a = 1; if (design.static && fin) a = Math.min(a, lt / fin); if (fout && left < fout) a = Math.min(a, left / fout);
      ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.drawImage(this._lc, 0, 0); ctx.restore();
    }
    // Letreros de las fotos: se ven cuando la foto está completa (sin encimarse con el título ni el final).
    captions(plan, okList) {
      const out = [], d = this.design();
      okList.forEach((p, k) => {
        if (!p.caption) return;
        let a = plan.shown[k].a + .2, b = plan.shown[k].b - .1;
        if (d.in && a < plan.intro.b) a = plan.intro.b + .1;
        if (d.out && plan.outro && b > plan.outro.a) b = plan.outro.a - .1;
        if (b - a > .8) out.push({ a, b, text: p.caption, k });
      });
      return out;
    }
    drawCaption(ctx, W, H, text, th, k) {
      if (this.st.capStyle === 'globo') { A.draw(D().globo, ctx, W, H, 2, 3, { word: text, k }, th); return; }
      SA.withShadow(th.shadow, () => {
        const u = Math.min(W, H) / 1080, x = 80 * u, y = H - 110 * u;
        const g = ctx.createLinearGradient(0, H * .6, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
        ctx.fillStyle = g; ctx.fillRect(0, H * .6, W * .7, H * .4);
        ctx.fillStyle = th.accent; ctx.fillRect(x, y - 58 * u, 70 * u, 3 * u);
        A.text(ctx, text, x, y, { s: 76 * u, f: A.F.script, color: th.text, align: 'left', shadow: 14 * u, maxW: W * .6 });
      });
    }
    loop() {
      let last = performance.now();
      const step = now => {
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        const plan = this.plan();
        if (this.playing && plan) {
          this.t += dt;
          if (this.stopAt && this.t >= this.stopAt) { this.stopAt = 0; this.setPlaying(false); }
          if (this.t >= plan.total) { this.t = plan.total; this.setPlaying(false); }
        }
        if (!this.root.hidden) { if (plan) this.drawAt(Math.min(this.t, plan.total)); this.syncTime(); }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    syncTime() {
      const plan = this.plan(), seek = this.q('seek'), tot = plan ? plan.total : 0;
      seek.max = String(tot); if (document.activeElement !== seek) seek.value = String(Math.min(this.t, tot));
      this.q('time').textContent = `${fmt(Math.min(this.t, tot))} / ${fmt(tot)}`;
    }
    act_play() { this.setPlaying(!this.playing); }
    setPlaying(on) {
      const plan = this.plan();
      if (on && (!plan)) return;
      if (on && plan && this.t >= plan.total - .05) this.t = 0;
      this.playing = on; if (!on) this.stopAt = 0;
      this.q('playBtn').textContent = on ? '❚❚ Pausa' : '▶ Ver';
      if (on) this.playAudio(); else this.stopAudio();
    }
    async playAudio() {
      if (!this.song) return;
      SA.music.stop();
      try {
        if (!this.audio) this.audio = new Audio();
        if (this.audioPath !== this.song.path) { this.audioPath = this.song.path; this.audio.src = await B.previewSrc(this.song.path); }
        this.audio.currentTime = (this.st.songStart || 0) + this.t; this.audio.volume = .85;
        await this.audio.play();
      } catch (e) {}
    }
    stopAudio() { if (this.audio) this.audio.pause(); }

    /* ---------- Crear ---------- */
    async writeCanvas(c, path) { const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png')); await B.writeBlob(path, blob); }
    // Foto preparada para el video: 1.5 veces el tamaño (para el movimiento), con su color. Devuelve el brillo donde va el logo.
    async makeStill(p, W, H, out) {
      const bmp = await createImageBitmap(await B.readBlob(p.path));
      const SW = Math.round(W * 1.5 / 2) * 2, SH = Math.round(H * 1.5 / 2) * 2;
      const img = C.downscale(bmp, Math.max(SW, SH) * 1.15); bmp.close && bmp.close();
      if (this.st.enhance) { const x = img.getContext('2d', { willReadFrequently: true }); C.colorCanvas(x, img.width, img.height, p.stats, { auto: true, style: 'natural' }); }
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high';
      if (Math.abs(Math.log((img.width / img.height) / (W / H))) <= .35) C.drawFit(ctx, img, SW, SH, 'cover');
      else { ctx.filter = 'blur(48px) brightness(.8)'; C.drawFit(ctx, img, SW, SH, 'cover', 1.15); ctx.filter = 'none'; C.drawFit(ctx, img, SW, SH, 'contain'); }
      const luma = SA.wmZoneLuma(c, W, H, S, SA.VIDEO_WM_SCALE);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('jpg')), 'image/jpeg', .9));
      c.width = c.height = 0; img.width = img.height = 0;
      await B.writeBlob(out, blob);
      return luma;
    }
    async renderLayer(design, W, H, dur, data, th, path, onFrame) {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
      if (design.static) { A.draw(design, ctx, W, H, 3, dur, data, th); await this.writeCanvas(c, path + '.png'); return { path: path + '.png', seq: false }; }
      const N = Math.ceil(dur * E.FPS) + 2;
      for (let f = 0; f < N; f++) {
        if (this.cancelled) return null;
        ctx.clearRect(0, 0, W, H); ctx.save(); A.draw(design, ctx, W, H, f / E.FPS, dur, data, th); ctx.restore();
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
      if (this.photos.some(p => p.status === 'loading')) { toast('Espera a que terminen de cargar las fotos.'); return; }
      if (!this.ok().length) { toast('Agrega por lo menos una foto.'); return; }
      if (this.design().in && !(this.st.values.title || '').trim()) { toast('Escribe el título (paso 2).'); const f = this.root.querySelector('[data-f="title"]'); f.scrollIntoView({ block: 'center' }); f.focus(); return; }
      this.setPlaying(false); SA.music.stop();
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
        if (this.cancelled) toast('Se canceló la fotosecuencia.');
        else if (outs.length) {
          this.lastOut = outs[outs.length - 1]; this.q('done').hidden = false;
          const mins = (performance.now() - this.t0) / 60000;
          toast(`Listo en ${mins < 1 ? 'menos de un minuto' : Math.round(mins) + ' min'}: ${outs.length === 1 ? 'la fotosecuencia quedó' : 'los videos quedaron'} en Documentos › Saucedo.`, 7000);
        }
      } catch (e) {
        if (!this.cancelled) SA.showError(e.message || 'No se pudo crear la fotosecuencia.', e.detail || String(e && e.stack || e));
        else toast('Se canceló la fotosecuencia.');
      } finally {
        this.busy = false; create.disabled = false; create.textContent = 'Crear fotosecuencia'; this.q('progress').hidden = true;
      }
    }
    async renderOne(fk, dir, prefix) {
      const F = E.FORMATS[fk], wt = E.WEIGHTS[this.st.weight] || E.WEIGHTS.normal, k = wt.H / Math.min(F.W, F.H);
      const W = Math.round(F.W * k / 2) * 2, H = Math.round(F.H * k / 2) * 2, sep = B.paths.sep;
      const plan = this.plan(), okList = this.ok(), d = this.design(), th = this.theme(), data = this.data(false);
      const tmp = await B.newJobDir();
      try {
        const est = plan.lens.reduce((s, x) => s + x, 0) * (1 + .5 * (okList.length > 12)) + plan.total * 1.2;
        const totalW = okList.length * 1.2 + 4 + est;
        let done = 0;
        // 1. Fotos (ya al tamaño del video: así FFmpeg trabaja ligero)
        const media = [], luma = [];
        for (let i = 0; i < okList.length; i++) {
          if (this.cancelled) return null;
          this.setProgress(done / totalW, `${prefix}Preparando fotos: ${i + 1} de ${okList.length}`);
          const still = B.join(tmp, `foto_${String(i + 1).padStart(3, '0')}.jpg`);
          try { luma[i] = await this.makeStill(okList[i], W, H, still); }
          catch (e) { throw Object.assign(new Error(`No se pudo preparar la foto «${okList[i].name}». Quítala y vuelve a intentar.`), { detail: String(e) }); }
          media.push({ kind: 'image', still, name: okList[i].name }); done += 1.2;
        }
        // 2. Logo
        const wmPaths = {};
        if (S.wm) for (const v of ['negro', 'blanco', 'original']) {
          if (v === 'original' && !SA.logos.original) continue;
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          SA.drawWatermark(c.getContext('2d'), W, H, S, SA.VIDEO_WM_SCALE, v);
          wmPaths[v] = B.join(tmp, `marca_${v}.png`); await this.writeCanvas(c, wmPaths[v]);
        }
        const wmFor = s => !S.wm ? null : (wmPaths[S.wmColor === 'auto' || !S.wmColor ? SA.wmVariantFor(luma[s.m]) : S.wmColor] || wmPaths.blanco);
        // 3. Letras: título, final, barras de cine y letreros de las fotos
        const layers = [];
        if (d.all) { const r = await this.renderLayer(D()[d.all], W, H, plan.total, data, th, B.join(tmp, 'capa_todo')); if (!r) return null; layers.push(Object.assign({ a: 0, b: plan.total }, r)); }
        if (d.in) {
          const r = await this.renderLayer(D()[d.in], W, H, plan.intro.b - plan.intro.a, data, th, B.join(tmp, 'capa_inicio'), f => this.setProgress((done + f * 2) / totalW, `${prefix}Preparando el título`));
          if (!r) return null; layers.push(Object.assign({ a: plan.intro.a, b: plan.intro.b, fin: r.seq ? 0 : .5, fout: .7 }, r)); done += 2;
        }
        if (d.out && plan.outro) {
          const r = await this.renderLayer(D()[d.out], W, H, plan.outro.b - plan.outro.a, data, th, B.join(tmp, 'capa_final'), f => this.setProgress((done + f * 2) / totalW, `${prefix}Preparando el final`));
          if (!r) return null; layers.push(Object.assign({ a: plan.outro.a, b: plan.outro.b, fin: r.seq ? 0 : .9, fout: 0 }, r)); done += 2;
        }
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        for (const c of this.captions(plan, okList)) {
          const x = cv.getContext('2d'); x.clearRect(0, 0, W, H); x.save(); this.drawCaption(x, W, H, c.text, th, c.k); x.restore();
          const path = B.join(tmp, `letrero_${c.k}.png`); await this.writeCanvas(cv, path);
          layers.push({ path, seq: false, a: c.a, b: c.b, fin: .4, fout: .4 });
        }
        // 4. FFmpeg
        const fname = F.name, base = B.safeName(`Fotosecuencia ${this.st.values.title || ''} ${fname}`).replace(/\s+/g, ' ').trim();
        const out = await B.freeName(dir, base, 'mp4');
        const audio = this.song ? { path: this.song.path, start: this.st.songStart || 0 } : null;
        const job = E.fsJob({ plan, media, tmp, sep, W, H, zoom: ZOOM, wmFor, layers, fadeIn: .5, audio, encoderArgs: E.encoderFor(this.encoder, this.st.weight), audioBitrate: wt.audio, out });
        const jobW = job.steps.reduce((s, x) => s + x.weight, 0), scale = est / jobW;
        for (const step of job.steps) {
          if (this.cancelled) return null;
          const label = prefix + (step.stage === 'toma' ? `Moviendo las fotos: ${step.n} de ${step.of}` : step.stage === 'grupo' ? `Uniendo con transiciones: ${step.n} de ${step.of}` : 'Terminando el video');
          const onT = tt => this.setProgress((done + Math.min(1, tt / step.seconds) * step.weight * scale) / totalW, label);
          onT(0);
          let r = await B.run('ffmpeg', step.args, onT);
          if (this.cancelled) return null;
          if (r.code !== 0 && step.final && this.encoder !== 'libx264') {
            this.encoder = 'libx264';
            r = await B.run('ffmpeg', E.tplFinalArgs(Object.assign({}, step.finalOpts, { encoderArgs: E.encoderFor('libx264', this.st.weight) })), onT);
          }
          if (this.cancelled) return null;
          if (r.code !== 0) {
            const who = step.media != null ? okList[step.media].name : null;
            throw Object.assign(new Error(who ? `No se pudo usar la foto «${who}». Quítala y vuelve a intentar.` : 'FFmpeg no pudo terminar el video. Revisa que haya espacio en el disco e intenta de nuevo.'), { detail: r.stderr });
          }
          done += step.weight * scale;
        }
        this.setProgress(1, prefix + 'Listo');
        return out;
      } finally { B.removeJobDir(tmp); }
    }
  }
  SA.Fotosecuencia = Fotosecuencia;
})();
