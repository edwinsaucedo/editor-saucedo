/* Pestaña Película del evento: editor guiado por momentos de la fiesta. */
(function () {
  'use strict';
  const SA = window.SA;
  const { $$, esc, toast } = SA.ui;
  const B = SA.bridge, E = window.Engine, C = SA.color, S = SA.settings;

  // Momentos con lo que normalmente conviene en cada uno (sonido de las tomas, música y consejo).
  const MOMENTS = [
    { key: 'llegada', name: 'Llegada', vol: .6, tip: 'Aquí luce una canción suave de fondo; el sonido del lugar queda bajito.' },
    { key: 'ceremonia', name: 'Misa o ceremonia', vol: 1, tip: 'Se deja el sonido original para que se escuche al padre o al juez. Mejor sin música.' },
    { key: 'entrada', name: 'Entrada', vol: .8, tip: 'Si en el salón sonó la canción de entrada, deja el sonido original. Si no, ponle música.' },
    { key: 'vals', name: 'Vals', vol: 1, tip: 'La canción del vals ya se escucha en el salón: deja el sonido original y no pongas música encima.' },
    { key: 'brindis', name: 'Brindis y discursos', vol: 1.15, tip: 'Lo importante es la voz: sonido original un poco más fuerte y sin música (o muy bajita).' },
    { key: 'sorpresa', name: 'Baile sorpresa', vol: 1, tip: 'Sonido original: es la mezcla que bailaron.' },
    { key: 'fiesta', name: 'Fiesta', vol: .8, tip: 'Las tomas cortas de 3 a 6 segundos se ven mejor. Recorta las largas.' },
    { key: 'despedida', name: 'Despedida', vol: .6, tip: 'Cierra con una canción tranquila; la música baja sola si alguien habla.' }
  ];
  const FLAG = {
    negra: { t: 'En negro', d: 'Parece grabada con la tapa puesta o la cámara apagada. Conviene quitarla.', bad: true },
    oscura: { t: 'Muy oscura', d: 'Está muy oscura. "Mejorar colores" la aclara un poco; si se ve mal, quítala.', bad: true },
    corta: { t: 'Muy corta', d: 'Dura menos de 2 segundos; casi no se alcanza a ver.', bad: true },
    larga: { t: 'Larga', d: 'Dura más de 5 minutos. Recórtala para usar solo lo importante.' },
    sinsonido: { t: 'Sin sonido', d: 'No tiene sonido o casi no se oye. Se usa con la música del momento.' },
    vertical: { t: 'Celular vertical', d: 'Grabada en vertical: va al centro con el fondo difuminado de la misma toma.' }
  };
  const MIN_LEN = 1.5;
  // Edición avanzada: transiciones que se pueden elegir (nombre de FFmpeg → nombre para el usuario).
  const TRANS = SA.trans.TYPES, TDUR = SA.trans.DURS;
  const PIP_SIZES = [['s', 'Chico'], ['m', 'Mediano'], ['l', 'Grande']];
  const PIP_POS = [['tl', 'Arriba a la izquierda'], ['tr', 'Arriba a la derecha'], ['bl', 'Abajo a la izquierda'], ['br', 'Abajo a la derecha']];
  const SPEEDS = [[0.5, '0.5×'], [0.75, '0.75×'], [1, 'Normal'], [1.5, '1.5×'], [2, '2×']];
  const ROTS = [[0, 'Normal'], [90, '↻ 90°'], [180, '180°'], [270, '↺ 90°']];
  const ZOOMS = [[1, 'Normal'], [1.15, '115 %'], [1.3, '130 %'], [1.5, '150 %']];
  const QUALITY = { '720': { W: 1280, H: 720, name: 'Ligera 720p' }, '1080': { W: 1920, H: 1080, name: 'Normal 1080p' }, '2160': { W: 3840, H: 2160, name: 'Máxima 4K' } };
  // Al acortar sola, estos momentos no se recortan (se pueden cambiar en cada momento).
  const PROTECT = ['ceremonia', 'vals', 'brindis'];
  const COLOR0 = { b: 0, c: 0, s: 0, w: 0 };
  const RECENTS = 'saucedo-peliculas';
  const fmt = s => E.fmtTime(s);
  const hhmm = t => t ? new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

  class Pelicula {
    constructor(root) {
      this.root = root; this.p = null; this.rt = {}; this.selected = new Set(); this.focus = null; this.panel = null;
      this.queue = []; this.pumping = false; this.busy = false;
      this.build(); this.bind();
      SA.onBrandChange(() => this.syncStyle());
      this.showStart();
    }
    q(n) { return this.root.querySelector(`[data-el="${n}"]`); }

    /* ================= Pantalla ================= */
    build() {
      const themes = Object.entries(SA.cards.THEMES).map(([k, v]) => `<button type="button" class="chip" data-v="${k}"><span class="sw" style="background:${v.accent}"></span>${v.name}</button>`).join('');
      const styles = Object.entries(C.STYLES).map(([k, v]) => `<button type="button" class="chip" data-v="${k}">${esc(v.name)}</button>`).join('');
      this.root.innerHTML = `
      <aside class="steps" aria-label="Pasos de la película">
        <div data-el="stepsOff" class="steps-off"><p class="hint">Empieza una película nueva o abre una guardada.</p></div>
        <div data-el="stepsOn" hidden>
          <section class="step">
            <h2><span class="num">1</span>Evento</h2>
            <label class="field"><span class="lbl">Nombre</span><input class="input" data-pf="name" type="text" autocomplete="off"></label>
            <div class="row2">
              <label class="field"><span class="lbl">Fecha</span><input class="input" data-pf="date" type="date"></label>
              <label class="field"><span class="lbl">Lugar</span><input class="input" data-pf="place" type="text" placeholder="Opcional" autocomplete="off"></label>
            </div>
            <div class="links"><button class="link" type="button" data-act="newProject">Nueva película</button><button class="link" type="button" data-act="openProject">Abrir otra</button></div>
            <p class="hint" data-el="savedHint"></p>
          </section>
          <section class="step">
            <h2><span class="num">2</span>Material</h2>
            <button class="drop" type="button" data-act="add"><strong>Agregar videos y fotos</strong><span>de la cámara y de los celulares, o arrástralos aquí</span></button>
            <div class="links"><button class="link" type="button" data-act="folder">Elegir una carpeta completa</button></div>
            <p class="count" data-el="count" aria-live="polite"></p>
            <div class="sources" data-el="sources"></div>
            <div class="advice" data-el="advice" hidden></div>
          </section>
          <section class="step">
            <h2><span class="num">3</span>Estilo</h2>
            <div class="field"><span class="lbl">Transiciones</span><div class="seg wrap" data-el="mood">${['momento', 'elegante', 'suave', 'dinamico', 'corte'].map(k => `<button type="button" data-v="${k}">${E.FILM_MOODS[k].name}</button>`).join('')}</div>
              <p class="hint" data-el="moodHint"></p></div>
            <button class="big" type="button" data-act="enhance"><span class="t">Mejorar colores</span><span class="pill" data-el="enhState">Activado</span></button>
            <div class="field"><span class="lbl">Estilo de color</span><div class="chips" data-el="style" role="radiogroup">${styles}</div></div>
            <div class="sw-row"><button class="switch" type="button" role="switch" data-act="denoise" data-el="denoise" aria-labelledby="pDenoise"></button><span class="sw-state" id="pDenoise">Reducir el ruido del salón</span></div>
            <div class="field"><span class="lbl">Color de las letras</span><div class="chips" data-el="theme" role="radiogroup">${themes}</div></div>
            <div class="field"><span class="lbl">Sombra de las letras (letreros, resumen y reel)</span><div class="seg" data-el="shadow" role="radiogroup">${SA.SHADOWS.map(([k, n]) => `<button type="button" data-v="${k}">${n}</button>`).join('')}</div></div>
            <div class="sw-row"><button class="switch" type="button" role="switch" data-act="wm" data-el="wm" aria-labelledby="pWm"></button><span class="sw-state" id="pWm">Marca de agua</span></div>
            <div class="field" data-el="wmSizeBox"><span class="lbl">Tamaño del logo</span><div class="seg" data-el="wmSize" role="radiogroup" aria-label="Tamaño del logo"><button type="button" data-v="s">Chico</button><button type="button" data-v="m">Mediano</button><button type="button" data-v="l">Grande</button></div></div>
            <div class="field"><span class="lbl">Canción de la portada y los créditos</span>
              <div class="song-mini"><span data-el="pSong">Sin canción</span><button class="btn" type="button" data-act="pSong">Elegir</button><button class="link" type="button" data-act="pSongOff" data-el="pSongOff" hidden>Quitar</button></div></div>
          </section>
          <section class="step">
            <h2><span class="num">4</span>Crear</h2>
            <div class="field"><span class="lbl">Qué crear</span>
              <div class="chips" data-el="outputs" role="group" aria-label="Qué crear">
                <button type="button" class="chip fmt" data-v="pelicula">Película completa</button>
                <button type="button" class="chip fmt" data-v="resumen">Resumen</button>
                <button type="button" class="chip fmt" data-v="reel">Reel vertical</button>
              </div></div>
            <div class="hl-opts" data-el="hlOpts" hidden>
              <div class="field" data-el="resOpt"><span class="lbl">Duración del resumen</span><div class="seg" data-el="resDur"><button type="button" data-v="180">3 min</button><button type="button" data-v="240">4 min</button><button type="button" data-v="300">5 min</button></div></div>
              <div class="field" data-el="reelOpt"><span class="lbl">Duración del reel</span><div class="seg" data-el="reelDur"><button type="button" data-v="30">30 s</button><button type="button" data-v="45">45 s</button><button type="button" data-v="60">60 s</button></div>
                <span class="lbl">Tomas horizontales en el reel</span><div class="seg" data-el="reelFit"><button type="button" data-v="blur">Completas con fondo</button><button type="button" data-v="cover">Llenar la pantalla</button></div></div>
              <div class="field"><span class="lbl">Canción del resumen y del reel</span>
                <div class="song-mini"><span data-el="hlSong">Sin canción</span><button class="btn" type="button" data-act="hlSong">Elegir</button></div>
                <div class="stepper" data-el="hlStartRow" hidden><span class="lbl">Empieza en</span><button type="button" data-act="hlStart" data-v="-5">−5 s</button><output data-el="hlStart">0:00</output><button type="button" data-act="hlStart" data-v="5">+5 s</button></div>
                <p class="hint">Se eligen solas las mejores partes de cada momento (bien iluminadas, nítidas, con movimiento y aplausos) y se corta al ritmo de esta canción.</p></div>
            </div>
            <div class="field" data-el="qualityBox"><span class="lbl">Calidad del archivo de la película</span><div class="seg" data-el="quality">${Object.entries(QUALITY).map(([k, v]) => `<button type="button" data-v="${k}">${v.name}</button>`).join('')}</div>
              <p class="hint" data-el="qualityHint"></p></div>
            ${SA.ui.codecHtml()}
            <p class="summary" data-el="summary"></p>
            <button class="primary" type="button" data-act="create" data-el="create">Crear película</button>
            <div class="progress" data-el="progress" hidden>
              <div class="prog-row"><span data-el="progText">Preparando…</span><button class="link" type="button" data-act="cancel">Pausar</button></div>
              <div class="bar"><i data-el="bar"></i></div>
              <p class="prog-sub" data-el="progSub"></p>
            </div>
            <div class="done-row" data-el="done" hidden><button class="btn" type="button" data-act="watch">Ver película</button><button class="btn" type="button" data-act="openDir">Abrir la carpeta</button></div>
            <p class="hint">Si se pausa o se apaga la computadora, al volver a crear sigue donde se quedó. Necesita unos 20 GB libres por cada hora de película.</p>
          </section>
        </div>
      </aside>

      <section class="mesa pel" aria-label="Película">
        <div class="start" data-el="start">
          <div class="start-card">
            <p class="start-k">Película del evento</p>
            <h2 class="start-t">¿Cómo se llama el evento?</h2>
            <label class="field"><span class="lbl">Nombre</span><input class="input" data-el="newName" type="text" placeholder="XV Ana Sofía" autocomplete="off"></label>
            <label class="field"><span class="lbl">Fecha</span><input class="input" data-el="newDate" type="date"></label>
            <button class="primary" type="button" data-act="start">Empezar</button>
            <div class="recents" data-el="recents"></div>
            <button class="link" type="button" data-act="openProject">Abrir una película guardada…</button>
          </div>
        </div>

        <div class="film-ed" data-el="editor" hidden>
          <div class="film-top">
            <div class="player">
              <div class="screen" data-el="screen">
                <video data-el="video" controls preload="metadata"></video>
                <img data-el="img" alt="" hidden>
                <video class="pip-prev" data-el="pipVid" muted playsinline preload="auto" hidden></video>
                <p class="lbl-prev" data-el="lblPrev" hidden></p>
                <canvas class="tprev" data-el="tprev" hidden></canvas>
                <p class="screen-msg" data-el="screenMsg">Elige una toma de abajo para verla aquí.</p>
              </div>
              <div class="trim" data-el="trimBox" hidden>
                <div class="track" data-el="track" title="Toca para ir a ese punto"><div class="keep" data-el="keep"></div><div class="head" data-el="head"></div></div>
                <div class="trim-row">
                  <button class="navbtn" type="button" data-act="markIn">Empieza aquí</button>
                  <span class="trim-txt" data-el="trimTxt"></span>
                  <button class="navbtn" type="button" data-act="markOut">Termina aquí</button>
                </div>
                <div class="trim-row small">
                  <button class="navbtn cutbtn" type="button" data-act="split" title="Atajo: tecla S">✂ Cortar aquí</button>
                  <button class="navbtn" type="button" data-act="playRange">▶ Ver lo que se usa</button>
                  <button class="navbtn" type="button" data-act="resetTrim">Usar toda la toma</button>
                </div>
                <p class="trim-cuts" data-el="trimCuts" hidden></p>
              </div>
            </div>
            <div class="detail" data-el="detail"><p class="hint">Toca una toma para recortarla y ajustar su sonido, o el nombre de un momento para elegir su música.</p></div>
          </div>
          <div class="toolbar" data-el="toolbar">
            <button class="tbtn" type="button" data-act="undo" data-el="undoBtn" disabled title="Atajo: Ctrl+Z">↶ Deshacer</button>
            <button class="tbtn" type="button" data-act="shorten">✂ Acortar la película…</button>
            <button class="tbtn" type="button" data-act="keys">Atajos del teclado</button>
            <span class="tb-len" data-el="tbLen"></span>
          </div>
          <div class="actionbar" data-el="actionbar" hidden>
            <span data-el="selCount"></span>
            <label class="send">Mandar a <select class="select" data-el="sendTo"></select></label>
            <button class="navbtn" type="button" data-act="excludeSel">No usar</button>
            <button class="navbtn" type="button" data-act="clearSel">Quitar selección</button>
          </div>
          <div class="board" data-el="board" aria-label="Momentos de la película"></div>
        </div>
      </section>`;
      this.q('newDate').value = SA.ui.todayISO();
    }

    bind() {
      const R = this.root;
      R.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || !R.contains(b)) return;
        const a = b.dataset.act, fn = this['act_' + a];
        if (fn) fn.call(this, b, e);
      });
      $$('[data-pf]', R).forEach(inp => inp.addEventListener('input', () => {
        if (!this.p) return;
        this.p[inp.dataset.pf] = inp.value; this.dirty(); this.summary();
      }));
      const seg = (name, key) => SA.ui.seg(this.q(name), '', v => { this.p[key] = v; this.dirty(); this.syncStyle(); this.summary(); });
      SA.ui.seg(this.q('wmSize'), S.size || 'm', v => { S.size = v; SA.brandChanged(); });
      SA.ui.seg(this.q('mood'), '', v => { this.p.mood = v; this.dirty(); this.syncStyle(); this.summary(); this.renderBoard(); });
      seg('style', 'style'); seg('theme', 'theme'); seg('quality', 'quality'); seg('shadow', 'shadow');
      SA.ui.codec(R);
      $$('[data-el="outputs"] .chip', R).forEach(b => b.addEventListener('click', () => {
        const set = new Set(this.p.outputs || ['pelicula']); set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
        if (!set.size) { toast('Elige por lo menos una cosa para crear.'); return; }
        this.p.outputs = ['pelicula', 'resumen', 'reel'].filter(x => set.has(x)); this.dirty(); this.syncOutputs(); this.summary();
      }));
      const hseg = (name, key, num) => SA.ui.seg(this.q(name), '', v => { this.hl()[key] = num ? +v : v; this.dirty(); this.syncOutputs(); this.summary(); });
      hseg('resDur', 'res', true); hseg('reelDur', 'reel', true); hseg('reelFit', 'fit');
      this.q('sendTo').addEventListener('change', e => { const v = e.target.value; e.target.value = ''; if (v) this.sendSelected(v); });
      this.q('newName').addEventListener('keydown', e => { if (e.key === 'Enter') this.act_start(); });
      // Reproductor
      const v = this.q('video');
      v.addEventListener('timeupdate', () => this.onTime());
      v.addEventListener('error', () => this.onVideoError());
      this.q('track').addEventListener('click', e => {
        const c = this.clip(this.focus); if (!c || c.kind !== 'video') return;
        const cut = e.target.closest('.cutr'), sib = e.target.closest('.sib');
        if (cut) { this.restoreCut(+cut.dataset.i); return; }
        if (sib) { this.focusClip(sib.dataset.id); return; }
        const r = this.q('track').getBoundingClientRect();
        v.currentTime = Math.max(0, Math.min(c.duration, (e.clientX - r.left) / r.width * c.duration));
      });
      v.addEventListener('loadedmetadata', () => this.applyPreviewLook());
      ['play', 'pause', 'seeked'].forEach(ev => v.addEventListener(ev, () => this.syncPip()));
      // Video girado (sin controles): un clic reproduce o pausa.
      v.addEventListener('click', () => { if (!v.controls) v.paused ? v.play() : v.pause(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (this.focus) this.applyPreviewLook(); }).observe(this.q('screen'));
    }

    /* ================= Proyecto ================= */
    recents() { try { return JSON.parse(localStorage.getItem(RECENTS) || '[]'); } catch (e) { return []; } }
    remember() {
      const list = this.recents().filter(r => r.path !== this.p.path);
      list.unshift({ path: this.p.path, name: this.p.name, date: this.p.date });
      try { localStorage.setItem(RECENTS, JSON.stringify(list.slice(0, 8))); localStorage.setItem(RECENTS + '-ultima', this.p.path); } catch (e) {}
    }
    showStart() {
      this.p = null;
      this.q('start').hidden = false; this.q('editor').hidden = true;
      this.q('stepsOn').hidden = true; this.q('stepsOff').hidden = false;
      const rec = this.recents();
      this.q('recents').innerHTML = rec.length ? '<p class="lbl">Películas recientes</p>' + rec.map((r, i) =>
        `<button class="recent" type="button" data-act="openRecent" data-i="${i}"><strong>${esc(r.name)}</strong><span>${esc(r.date || '')}</span></button>`).join('') : '';
    }
    async tryReopenLast() {
      let last = null; try { last = localStorage.getItem(RECENTS + '-ultima'); } catch (e) {}
      if (last && await B.exists(last)) await this.openPath(last, true);
    }
    act_start() {
      const name = this.q('newName').value.trim();
      if (!name) { toast('Escribe el nombre del evento, por ejemplo "XV Ana Sofía".'); this.q('newName').focus(); return; }
      const date = this.q('newDate').value || SA.ui.todayISO();
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const dir = B.join(B.paths.documents, 'Saucedo', `${date} ${B.safeName(name)}`, 'Película');
      this.load({
        v: 1, id, name, date, place: '', theme: 'dorado', mood: 'momento', enhance: true, style: 'natural', denoise: true, music: null,
        sources: {}, clips: {},
        moments: MOMENTS.map(m => ({ id: m.key, key: m.key, name: m.name, title: true, vol: m.vol, music: null, clips: [], manual: false })),
        path: B.join(dir, 'proyecto-saucedo.json'), dir
      });
      this.saveNow();
      this.q('newName').value = '';
    }
    act_newProject() { this.flush(); this.showStart(); this.q('newName').focus(); }
    async act_openProject() {
      const p = await B.pick('project', false);
      if (p.length) this.openPath(p[0]);
    }
    act_openRecent(b) { const r = this.recents()[+b.dataset.i]; if (r) this.openPath(r.path); }
    async openPath(path, quiet) {
      try {
        const p = JSON.parse(await B.readText(path));
        if (!p || !p.moments || !p.clips) throw new Error('formato');
        p.path = path; p.dir = path.replace(/[\\/][^\\/]+$/, '');
        this.load(p);
      } catch (e) { if (!quiet) toast('No se pudo abrir esa película. Elige el archivo proyecto-saucedo.json de la carpeta Película.'); }
    }
    async load(p) {
      this.flush();
      this.p = p; this.rt = {}; this.selected.clear(); this.focus = null; this.panel = null; this.undo = []; this.syncUndo();
      // Música incluida: la ruta se actualiza por si el programa se instaló en otra carpeta.
      [p.music, p.hl && p.hl.music].concat(p.moments.map(m => m.music)).forEach(m => SA.music.resolve(m));
      this.cache = await B.filmCacheDir(p.id);
      this.q('start').hidden = true; this.q('editor').hidden = false;
      this.q('stepsOn').hidden = false; this.q('stepsOff').hidden = true;
      $$('[data-pf]', this.root).forEach(inp => { inp.value = p[inp.dataset.pf] || ''; });
      this.q('done').hidden = true;
      this.remember(); this.syncStyle(); this.syncOutputs(); this.renderBoard(); this.renderSources(); this.summary(); this.showDetail();
      this.q('savedHint').textContent = 'Se guarda solo en ' + this.shown(p.dir);
      // Miniaturas y revisión de lo que falte (las ya hechas vienen de la carpeta de trabajo).
      Object.values(p.clips).forEach(c => this.queue.push(c.id));
      this.pump();
    }
    shown(dir) { const d = B.paths.documents; return dir.startsWith(d) ? 'Documentos' + dir.slice(d.length).split(/[\\/]/).join(' › ') : dir; }
    dirty() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 1200); }
    flush() { if (this.saveT) { clearTimeout(this.saveT); this.saveT = null; if (this.p) this.saveNow(); } }
    async saveNow() {
      if (!this.p) return;
      this.saveT = null; this.p.updated = Date.now();
      try { await B.writeText(this.p.path, JSON.stringify(this.p)); }
      catch (e) { toast('No se pudo guardar la película. Revisa que haya espacio en el disco.'); }
    }

    /* ================= Material ================= */
    clip(id) { return this.p && this.p.clips[id]; }
    time(c) { const sh = (this.p.sources[c.dir] || {}).shift || 0; return (c.t || 0) + sh * 3600e3 + (c.split ? (c.in || 0) * 1000 : 0); }
    momentOf(id) { return this.p.moments.find(m => m.clips.includes(id)); }
    act_add() { B.pick('media', true).then(p => p.length && this.addPaths(p)); }
    act_folder() { B.pickFolder().then(p => p && this.addPaths([p])); }
    async addPaths(paths) {
      if (!this.p) { toast('Primero escribe el nombre del evento y toca Empezar.'); return; }
      const list = await B.listMedia(paths);
      const vis = list.filter(f => f.kind === 'video' || f.kind === 'image');
      const known = new Set(Object.values(this.p.clips).map(c => c.path));
      const news = vis.filter(f => !known.has(f.path));
      if (!news.length) { toast(vis.length ? 'Esas tomas ya estaban en la película.' : 'No encontré videos ni fotos en lo que agregaste.'); return; }
      const times = await B.fileTimes(news.map(f => f.path));
      news.forEach((f, i) => {
        const id = 'c' + E.hash(f.path).slice(0, 12);
        this.p.clips[id] = { id, path: f.path, name: f.name, kind: f.kind, dir: f.path.replace(/[\\/][^\\/]+$/, ''), mtime: times[i] || 0, t: times[i] || 0,
          duration: f.kind === 'image' ? 4 : 0, in: 0, out: 0, len: 4, vol: 1, mute: false, excluded: false, w: 0, h: 0, hasAudio: false, ready: false };
        this.queue.push(id);
      });
      Object.values(this.p.clips).forEach(c => { if (!this.p.sources[c.dir]) this.p.sources[c.dir] = { shift: 0 }; });
      this.dirty(); this.renderBoard(); this.renderSources(); this.pump();
      toast(`Se agregaron ${news.length} ${news.length === 1 ? 'toma' : 'tomas'}. Las estoy revisando…`);
    }
    async pump() {
      if (this.pumping) return; this.pumping = true;
      const p = this.p;
      while (this.queue.length && this.p === p) {
        const id = this.queue.shift(), c = p.clips[id];
        if (!c) continue;
        try { await this.prepare(c); } catch (e) { (this.rt[id] = this.rt[id] || {}).error = true; }
        this.refreshCard(id); this.counts();
        if (this.focus === id) this.showDetail();
      }
      this.pumping = false;
      if (this.p === p) { this.renderBoard(); this.renderSources(); this.renderAdvice(); this.summary(); this.dirty(); }
    }
    // Lee datos, saca miniatura y revisa la toma (todo queda guardado para la próxima vez).
    async prepare(c) {
      const rt = this.rt[c.id] = this.rt[c.id] || {};
      const thumbPath = B.join(this.cache, `cuadro_${E.hash(c.split ? c.path + '@' + (c.in || 0) : c.path)}.jpg`);
      if (c.kind === 'image') {
        if (!c.ready) {
          const bmp = await createImageBitmap(await B.readBlob(c.path));
          c.w = bmp.width; c.h = bmp.height; c.ready = true;
          c.scan = { flags: c.h > c.w ? ['vertical'] : [] };
          rt.thumb = C.downscale(bmp, 360); bmp.close && bmp.close();
          return;
        }
        if (!rt.thumb) { const bmp = await createImageBitmap(await B.readBlob(c.path)); rt.thumb = C.downscale(bmp, 360); bmp.close && bmp.close(); }
        return;
      }
      if (!c.ready) {
        const r = await B.run('ffprobe', E.probeArgs(c.path));
        if (r.code !== 0 || !r.stdout.trim()) throw new Error('probe');
        const info = E.parseProbe(r.stdout);
        if (!info.hasVideo) throw new Error('sin video');
        Object.assign(c, { w: info.width, h: info.height, duration: info.duration, hasAudio: info.hasAudio });
        c.out = c.duration;
        const ct = E.creationTime(r.stdout);
        c.t = ct || (c.mtime ? c.mtime - c.duration * 1000 : 0);
        c.ready = true;
      }
      if (!(await B.exists(thumbPath))) {
        const at = c.split ? (c.in || 0) + Math.min(1, this.clipLen(c) * .3) : Math.min(2, c.duration * .3);
        let r = await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-ss', String(at), '-i', c.path, '-frames:v', '1', '-vf', 'scale=360:-2', thumbPath]);
        if (r.code !== 0 || !(await B.exists(thumbPath))) await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-i', c.path, '-frames:v', '1', '-vf', 'scale=360:-2', thumbPath]);
      }
      try { rt.thumb = await createImageBitmap(await B.readBlob(thumbPath, 'image/jpeg')); } catch (e) {}
      if (!c.scan) {
        const r = await B.run('ffmpeg', E.scanArgs(c.path, c.hasAudio), null, true);
        c.scan = E.parseScan(r.stderr || '', { duration: c.duration, hasAudio: c.hasAudio, width: c.w, height: c.h });
      }
    }
    counts() {
      if (!this.p) return;
      const all = Object.values(this.p.clips), ready = all.filter(c => c.ready).length;
      const vids = all.filter(c => c.kind === 'video'), dur = vids.reduce((s, c) => s + (c.duration || 0), 0);
      const pend = this.queue.length + (this.pumping ? 1 : 0);
      this.q('count').textContent = !all.length ? 'Todavía no hay material.'
        : `${all.length} tomas · ${fmt(dur)} de video` + (pend && ready < all.length ? ` · revisando ${ready} de ${all.length}…` : '');
    }
    renderSources() {
      if (!this.p) return;
      const groups = {};
      Object.values(this.p.clips).forEach(c => { (groups[c.dir] = groups[c.dir] || []).push(c); });
      const dirs = Object.keys(groups);
      this.q('sources').innerHTML = dirs.length < 2 ? '' : '<p class="lbl">Si una cámara tenía otra hora, corrígela aquí</p>' + dirs.map(d => {
        const cs = groups[d].filter(c => c.ready).sort((a, b) => this.time(a) - this.time(b));
        const sh = (this.p.sources[d] || {}).shift || 0;
        return `<div class="src"><div class="src-t"><strong>${esc(B.baseName(d))}</strong><span>${groups[d].length} tomas · desde ${hhmm(cs[0] && this.time(cs[0]))}</span></div>
          <div class="src-b"><button type="button" data-act="shift" data-d="${esc(d)}" data-v="-1">−1 h</button><output>${sh > 0 ? '+' : ''}${sh} h</output><button type="button" data-act="shift" data-d="${esc(d)}" data-v="1">+1 h</button></div></div>`;
      }).join('');
      this.counts();
    }
    act_shift(b) { const s = this.p.sources[b.dataset.d] = this.p.sources[b.dataset.d] || { shift: 0 }; s.shift = Math.max(-12, Math.min(12, s.shift + (+b.dataset.v))); this.dirty(); this.renderSources(); this.renderBoard(); }
    renderAdvice() {
      const el = this.q('advice'); if (!this.p) return;
      const cnt = {};
      Object.values(this.p.clips).forEach(c => { if (!c.excluded && c.scan) c.scan.flags.forEach(f => { cnt[f] = (cnt[f] || 0) + 1; }); });
      const items = ['negra', 'oscura', 'corta', 'larga'].filter(f => cnt[f]).map(f => `${cnt[f]} ${FLAG[f].t.toLowerCase()}`);
      el.hidden = !items.length;
      el.innerHTML = items.length ? `<p><strong>Revisión:</strong> ${items.join(' · ')}.</p>` + (cnt.negra ? `<button class="btn" type="button" data-act="dropBlack">No usar las tomas en negro</button>` : '') +
        '<p class="hint">Las tomas marcadas tienen un punto de color; tócalas para ver qué se recomienda.</p>' : '';
    }
    act_dropBlack() {
      this.snap(); let n = 0;
      Object.values(this.p.clips).forEach(c => { if (!c.excluded && c.scan && c.scan.flags.includes('negra')) { this.exclude(c.id, true); n++; } });
      this.dirty(); this.renderBoard(); this.renderAdvice(); this.summary();
      toast(`Se quitaron ${n} tomas en negro. Están en la columna "No se usan" por si quieres regresarlas.`);
    }

    /* ================= Tablero de momentos ================= */
    unassigned() {
      const inM = new Set(this.p.moments.flatMap(m => m.clips));
      return Object.values(this.p.clips).filter(c => !inM.has(c.id) && !c.excluded).sort((a, b) => this.time(a) - this.time(b));
    }
    clipLen(c) { return c.kind === 'image' ? (c.len || 4) : E.keptRanges(c).reduce((s, r) => s + r[1] - r[0], 0) / (c.speed || 1); }
    cutSecs(c) { const a0 = c.in || 0, b0 = c.out || c.duration; return (c.cuts || []).reduce((s, r) => s + Math.max(0, Math.min(b0, r[1]) - Math.max(a0, r[0])), 0); }
    renderBoard() {
      if (!this.p) return;
      const board = this.q('board');
      const sx = board.scrollLeft;
      const cols = [];
      const un = this.unassigned();
      // Sin acomodar, en grupos por hora (si pasan más de 10 min entre tomas, empieza otro grupo)
      let html = '', last = null, g = 0;
      un.forEach(c => {
        const t = this.time(c);
        if (!last || t - (this.time(last) + this.clipLen(last) * 1000) > 10 * 60e3) {
          g++;
          html += `<div class="grp"><span>${hhmm(t)}</span><button class="link" type="button" data-act="selGroup" data-g="${g}">Seleccionar grupo</button></div>`;
        }
        html += this.cardHtml(c, g);
        last = c;
      });
      cols.push(`<div class="col un"><div class="col-h"><strong>Sin acomodar</strong><span>${un.length} tomas</span></div>
        <div class="col-b">${html || '<p class="col-empty">Aquí aparecen las tomas nuevas, ordenadas por la hora en que se grabaron.</p>'}</div></div>`);
      this.p.moments.forEach((m, i) => {
        const cs = m.clips.map(id => this.p.clips[id]).filter(Boolean);
        const dur = cs.reduce((s, c) => s + this.clipLen(c), 0);
        cols.push(`<div class="col${this.panel === m.id ? ' on' : ''}"><button class="col-h" type="button" data-act="openMoment" data-m="${m.id}">
          <strong>${i + 1}. ${esc(m.name)}</strong><span>${cs.length} tomas · ${fmt(dur)}${m.music ? ' · ♪' : ''}</span></button>
          <div class="col-b">${cs.map((c, k) => (k ? this.joinHtml(c, m) : '') + this.cardHtml(c)).join('') || '<p class="col-empty">Selecciona tomas y usa "Mandar a".</p>'}</div></div>`);
      });
      const ex = Object.values(this.p.clips).filter(c => c.excluded);
      cols.push(`<div class="col ex"><div class="col-h"><strong>No se usan</strong><span>${ex.length} tomas</span></div><div class="col-b">${ex.map(c => this.cardHtml(c)).join('') || '<p class="col-empty">Las tomas que quites quedan aquí.</p>'}</div></div>`);
      cols.push(`<div class="col add"><button class="btn" type="button" data-act="addMoment">+ Agregar momento</button></div>`);
      board.innerHTML = cols.join('');
      board.scrollLeft = sx;
      Object.keys(this.p.clips).forEach(id => this.paintCard(id));
      this.syncSel();
    }
    cardHtml(c, g) {
      const flags = (c.scan && c.scan.flags || []).filter(f => FLAG[f] && FLAG[f].bad);
      return `<button class="cc${this.selected.has(c.id) ? ' sel' : ''}${this.focus === c.id ? ' focus' : ''}" type="button" data-act="pickClip" data-id="${c.id}"${g ? ` data-g="${g}"` : ''}>
        <canvas width="160" height="90"></canvas>
        <span class="cc-t">${hhmm(this.time(c))}</span><span class="cc-d">${c.kind === 'image' ? 'FOTO' : fmt(this.clipLen(c))}</span>
        ${flags.length ? `<span class="cc-f" title="${esc(flags.map(f => FLAG[f].t).join(', '))}"></span>` : ''}
        ${c.mute || (c.kind === 'video' && !c.hasAudio && c.ready) ? '<span class="cc-m" title="Sin sonido">🔇</span>' : ''}
        ${this.badges(c)}</button>`;
    }
    // Entre dos tomas del tablero: qué transición lleva (toca para verla y cambiarla).
    transOf(c, m) {
      const t = (c.trans && c.trans.type) || (m && m.trans && m.trans.type);
      if (t) return { type: t, own: true, dur: (c.trans && c.trans.type ? c.trans.dur : m.trans.dur) || .8 };
      const mood = this.moodOf(m);
      return { type: mood.T ? (mood.list[0] || 'fade') : 'corte', own: false, dur: mood.T || .8, mood: this.p.mood, varies: new Set(mood.list).size > 1 };
    }
    // Estilo de transiciones de un momento: el de la película, o el que le toca al momento con "Según el momento".
    moodOf(m) {
      const mood = E.FILM_MOODS[this.p.mood] || E.FILM_MOODS.suave;
      return mood.byMoment ? E.momentMood(m && m.key) : mood;
    }
    autoTransName(t, m) {
      return t.mood === 'momento' ? `Según el momento (${E.momentMood(m && m.key).desc})` : t.mood === 'elegante' ? 'Elegante (cambia en cada toma)' : t.mood === 'dinamico' ? 'Dinámica (cambia en cada toma)' : SA.trans.name(t.type);
    }
    joinHtml(c, m) {
      const t = this.transOf(c, m), name = !t.own && t.varies ? this.autoTransName(t, m).replace(/ \(.*\)$/, '') : SA.trans.name(t.type);
      return `<button class="tj${t.own ? ' own' : ''}" type="button" data-act="tjoin" data-id="${c.id}" title="Transición: ${esc(name)}. Toca para verla o cambiarla.">⇄ ${esc(name)}</button>`;
    }
    act_tjoin(b) {
      this.focusClip(b.dataset.id);
      const d = this.q('detail'), adv = d.querySelector('[data-el="adv"]');
      if (adv && !adv.open) { adv.open = true; this.advOpen(true); }
      const g = d.querySelector('.trans-grid'); if (g) g.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => this.act_previewTrans(), 250);
    }
    // Marcas pequeñas en la tarjeta: partes quitadas, velocidad, letrero, transición propia.
    badges(c) {
      const b = [];
      if (c.cuts && c.cuts.length && this.cutSecs(c) > 0.5) b.push(`<span class="cc-b" title="Tiene partes quitadas">✂</span>`);
      if (c.speed && c.speed !== 1) b.push(`<span class="cc-b" title="Velocidad">${c.speed}×</span>`);
      if (c.label) b.push('<span class="cc-b" title="Letrero en pantalla">T</span>');
      if (c.trans && c.trans.type && c.trans.type !== 'auto') b.push('<span class="cc-b" title="Transición propia">⇄</span>');
      if (c.pip) b.push('<span class="cc-b" title="Doble toma">▣</span>');
      return b.length ? `<span class="cc-bs">${b.join('')}</span>` : '';
    }
    refreshCard(id) {
      const el = this.q('board').querySelector(`.cc[data-id="${id}"]`), c = this.clip(id);
      if (el && c) { el.outerHTML = this.cardHtml(c, el.dataset.g); }
      this.paintCard(id);
    }
    paintCard(id) {
      const el = this.q('board').querySelector(`[data-id="${id}"] canvas`);
      const rt = this.rt[id];
      if (!el) return;
      const ctx = el.getContext('2d');
      ctx.fillStyle = '#3A3733'; ctx.fillRect(0, 0, 160, 90);
      if (rt && rt.thumb) C.drawFit(ctx, rt.thumb, 160, 90, 'cover');
      else { ctx.fillStyle = '#CFCAC0'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(rt && rt.error ? 'No se pudo leer' : 'Revisando…', 80, 50); }
    }
    act_pickClip(b, e) {
      const id = b.dataset.id;
      if (e.shiftKey && this.lastPick) {
        const ids = $$('.cc', this.q('board')).map(x => x.dataset.id);
        const a = ids.indexOf(this.lastPick), z = ids.indexOf(id);
        if (a >= 0 && z >= 0) ids.slice(Math.min(a, z), Math.max(a, z) + 1).forEach(x => this.selected.add(x));
      } else if (e.ctrlKey || e.metaKey) {
        this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
      } else {
        this.selected.clear(); this.selected.add(id);
      }
      this.lastPick = id;
      this.focus = id; this.panel = null;
      this.syncSel(); this.showDetail(); this.loadPlayer();
    }
    act_selGroup(b) {
      this.selected.clear();
      $$(`.cc[data-g="${b.dataset.g}"]`, this.q('board')).forEach(x => this.selected.add(x.dataset.id));
      this.syncSel();
    }
    act_clearSel() { this.selected.clear(); this.syncSel(); }
    syncSel() {
      $$('.cc', this.q('board')).forEach(x => { x.classList.toggle('sel', this.selected.has(x.dataset.id)); x.classList.toggle('focus', this.focus === x.dataset.id); });
      const n = this.selected.size, bar = this.q('actionbar');
      bar.hidden = !n;
      if (!n) return;
      this.q('selCount').textContent = `${n} ${n === 1 ? 'toma seleccionada' : 'tomas seleccionadas'}`;
      this.q('sendTo').innerHTML = '<option value="">elige…</option>' + this.p.moments.map((m, i) => `<option value="${m.id}">${i + 1}. ${esc(m.name)}</option>`).join('') + '<option value="_un">Sin acomodar</option>';
    }
    sendSelected(mid) {
      this.snap();
      const ids = [...this.selected];
      this.p.moments.forEach(m => { m.clips = m.clips.filter(id => !this.selected.has(id)); });
      ids.forEach(id => { this.p.clips[id].excluded = false; });
      if (mid !== '_un') {
        const m = this.p.moments.find(x => x.id === mid);
        m.clips.push(...ids);
        if (!m.manual) m.clips.sort((a, b) => this.time(this.p.clips[a]) - this.time(this.p.clips[b]));
        toast(`${ids.length} ${ids.length === 1 ? 'toma' : 'tomas'} a "${m.name}".`);
      }
      this.selected.clear(); this.dirty(); this.renderBoard(); this.summary(); this.renderAdvice();
    }
    exclude(id, on) {
      const c = this.p.clips[id]; c.excluded = on;
      if (on) this.p.moments.forEach(m => { m.clips = m.clips.filter(x => x !== id); });
    }
    act_excludeSel() { this.snap(); [...this.selected].forEach(id => this.exclude(id, true)); this.selected.clear(); this.dirty(); this.renderBoard(); this.summary(); this.renderAdvice(); }
    act_addMoment() {
      const id = 'm' + Date.now().toString(36);
      this.p.moments.push({ id, key: 'otro', name: 'Momento nuevo', title: true, vol: 1, music: null, clips: [], manual: false });
      this.dirty(); this.panel = id; this.focus = null; this.renderBoard(); this.showDetail();
      const inp = this.q('detail').querySelector('[data-mf="name"]'); if (inp) { inp.focus(); inp.select(); }
    }

    /* ================= Panel de detalle ================= */
    act_openMoment(b) {
      this.panel = b.dataset.m; this.focus = null; this.selected.clear(); this.syncSel(); this.renderBoard(); this.showDetail();
      const v = this.q('video'), m = this.curMoment();
      v.pause(); v.removeAttribute('src'); v.load(); v.hidden = true; this.q('img').hidden = true;
      const msg = this.q('screenMsg'); msg.hidden = false;
      msg.textContent = `${m.name}: ${m.clips.length} tomas. Toca una toma para verla y recortarla.`;
    }
    showDetail() {
      const d = this.q('detail');
      if (!this.p) return;
      // Otra toma u otro momento: el panel empieza arriba; la misma: se queda donde estaba.
      const who = this.panel || this.focus || '';
      if (who !== this.detailFor) { d.scrollTop = 0; this.detailFor = who; }
      if (this.panel) return this.momentPanel(d);
      const c = this.clip(this.focus);
      if (!c) { d.innerHTML = '<p class="hint">Toca una toma para recortarla y ajustar su sonido, o el nombre de un momento para elegir su música.</p>'; return; }
      const m = this.momentOf(c.id), i = m ? m.clips.indexOf(c.id) : -1;
      const flags = (c.scan && c.scan.flags || []).filter(f => FLAG[f]);
      d.innerHTML = `
        <h3 class="d-t">${esc(c.name)}</h3>
        <p class="d-sub">${hhmm(this.time(c))} · ${c.kind === 'image' ? 'Foto' : `Video de ${fmt(c.duration)}`}${c.w ? ` · ${c.w} × ${c.h}` : ''} · ${esc(B.baseName(c.dir))}</p>
        <p class="d-sub">${m ? `En <strong>${esc(m.name)}</strong>, lugar ${i + 1} de ${m.clips.length}` : c.excluded ? 'No se usa en la película' : 'Sin acomodar'}</p>
        ${flags.map(f => `<p class="flag${FLAG[f].bad ? ' bad' : ''}"><strong>${FLAG[f].t}.</strong> ${FLAG[f].d}</p>`).join('')}
        ${c.kind === 'video' ? `
          <div class="field"><span class="lbl">Sonido de esta toma</span>
            <div class="sw-row"><button class="switch" type="button" role="switch" data-act="mute" aria-checked="${!c.mute && c.hasAudio}" ${c.hasAudio ? '' : 'disabled'} aria-label="Usar el sonido"></button><span>${c.hasAudio ? (c.mute ? 'Sin sonido (solo música)' : 'Se usa el sonido original') : 'Esta toma no tiene sonido'}</span></div>
            ${c.hasAudio && !c.mute ? `<div class="slider"><input type="range" min="0" max="150" step="5" value="${Math.round(c.vol * 100)}" data-cf="vol" aria-label="Volumen de esta toma"><output>${Math.round(c.vol * 100)} %</output></div>` : ''}
          </div>` : `
          <div class="field"><span class="lbl">Cuánto dura la foto</span><div class="stepper"><button type="button" data-act="photoLen" data-v="-1">−1 s</button><output>${c.len || 4} s</output><button type="button" data-act="photoLen" data-v="1">+1 s</button></div></div>`}
        ${c.kind === 'video' ? this.cutsInfo(c) : ''}
        ${this.advHtml(c)}
        <div class="d-actions">
          ${m ? `<button class="navbtn dark" type="button" data-act="moveClip" data-v="-1" ${i <= 0 ? 'disabled' : ''}>‹ Antes</button><button class="navbtn dark" type="button" data-act="moveClip" data-v="1" ${i >= m.clips.length - 1 ? 'disabled' : ''}>Después ›</button>` : ''}
          ${c.excluded ? '<button class="btn" type="button" data-act="restoreClip">Volver a usar</button>' : '<button class="btn" type="button" data-act="excludeClip">No usar esta toma</button>'}
        </div>`;
      const vol = d.querySelector('[data-cf="vol"]');
      if (vol) vol.addEventListener('input', () => { c.vol = vol.value / 100; vol.nextElementSibling.textContent = `${vol.value} %`; this.applyPreviewVolume(); this.dirty(); });
      this.bindAdv(d, c);
      this.renderTrim(); this.applyPreviewLook();
    }

    /* ================= Edición avanzada ================= */
    cutsInfo(c) {
      const n = (c.cuts || []).length, secs = this.cutSecs(c);
      if (!n || secs < 0.5) return '';
      return `<p class="flag tip"><strong>✂ ${n} ${n === 1 ? 'parte quitada' : 'partes quitadas'} (${fmt(secs)}).</strong> Están en gris en la barra debajo del video: toca una para regresarla.</p>
        <button class="link" type="button" data-act="restoreAllCuts">Regresar todas las partes quitadas</button>`;
    }
    transGrid(cur, act) {
      return SA.trans.gridHtml(TRANS, cur, act) + '<button class="btn small-btn" type="button" data-act="previewTrans">▶ Ver la transición en grande</button>';
    }
    // Imágenes para las muestras: la toma anterior y esta (o las dos primeras del momento).
    transImgs(c) {
      const th = id => this.rt[id] && this.rt[id].thumb || null;
      if (this.panel) { const m = this.curMoment(); return { a: th(m.clips[0]), b: th(m.clips[1] || m.clips[0]), auto: this.transOf({}, m).type }; }
      const m = this.momentOf(c.id), i = m ? m.clips.indexOf(c.id) : -1;
      return { a: i > 0 ? th(m.clips[i - 1]) : null, b: th(c.id), auto: this.transOf(Object.assign({}, c, { trans: null }), m).type };
    }
    act_previewTrans() {
      const c = this.clip(this.focus), cv = this.q('tprev'), sc = this.q('screen');
      const m = this.panel ? this.curMoment() : c && this.momentOf(c.id);
      if (!c && !m) return;
      const im = this.transImgs(c || {}), t = this.panel ? this.transOf({}, m) : this.transOf(c, m);
      if (this.stopTP) this.stopTP();
      const r = sc.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      let w = r.width, h = w * 9 / 16; if (h > r.height) { h = r.height; w = h * 16 / 9; }
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.hidden = false; this.q('video').pause();
      const nm = !t.own && t.varies ? this.autoTransName(t, m) : SA.trans.name(t.type);
      this.stopTP = SA.trans.play(cv, im.a, im.b, t.type, t.type === 'corte' ? 0 : t.dur, { times: 2, label: (x, W, H) => {
        x.save(); x.font = `700 ${Math.round(H * .055)}px "SA Body",sans-serif`; x.fillStyle = 'rgba(0,0,0,.55)';
        const tw = x.measureText(nm).width; x.fillRect(W * .03, H * .04, tw + H * .06, H * .1); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(nm, W * .03 + H * .03, H * .09); x.restore();
      }, onEnd: () => { cv.hidden = true; this.stopTP = null; } });
      cv.onclick = () => { if (this.stopTP) this.stopTP(); cv.hidden = true; };
    }
    advSeg(name, list, val) {
      return `<div class="seg small" data-cv="${name}" role="radiogroup">${list.map(([v, t]) => `<button type="button" data-v="${v}" aria-checked="${String(v) === String(val)}">${t}</button>`).join('')}</div>`;
    }
    advHtml(c) {
      const tr = c.trans || {}, video = c.kind === 'video', col = Object.assign({}, COLOR0, c.color || {});
      return `<details class="adv" data-el="adv"${this.advOpen() ? ' open' : ''}><summary>Opciones avanzadas</summary>
        <div class="field"><span class="lbl">Transición al empezar esta toma</span>${this.transGrid(tr.type, 'setTrans')}
          ${tr.type && tr.type !== 'auto' && tr.type !== 'corte' ? `<span class="lbl">Duración de la transición</span>${this.advSeg('tdur', TDUR, tr.dur || 0.8)}` : ''}</div>
        ${video ? `
        <div class="field"><span class="lbl">Velocidad (menos de 1× es cámara lenta)</span>${this.advSeg('speed', SPEEDS, c.speed || 1)}</div>
        <div class="field"><span class="lbl">Acercar (recorta los bordes)</span>${this.advSeg('zoom', ZOOMS, c.zoom || 1)}</div>
        <div class="field"><span class="lbl">Girar (videos grabados de lado o de cabeza)</span>${this.advSeg('rot', ROTS, c.rot || 0)}</div>
        <div class="field"><span class="lbl">Color de esta toma</span>
          ${[['b', 'Brillo'], ['c', 'Contraste'], ['s', 'Saturación'], ['w', 'Calidez']].map(([k, t]) => `<label class="cslider"><span>${t}</span><input type="range" min="-100" max="100" step="5" value="${col[k]}" data-col="${k}" aria-label="${t}"><output>${col[k] > 0 ? '+' : ''}${col[k]}</output></label>`).join('')}
          <div class="links"><button class="link" type="button" data-act="colorReset">Restablecer</button><button class="link" type="button" data-act="colorAll">Igual en todo el momento</button></div></div>
        <div class="sw-row"><button class="switch" type="button" role="switch" data-act="stab" aria-checked="${!!c.stab}" aria-label="Estabilizar"></button><span>Estabilizar (quita el temblor; tarda un poco más)</span></div>
        ${this.pipHtml(c)}` : ''}
        <label class="field"><span class="lbl">Letrero en pantalla (opcional)</span><input class="input" type="text" data-cv="label" maxlength="40" placeholder="Ej. Los padrinos" value="${esc(c.label || '')}" autocomplete="off"></label>
      </details>`;
    }
    pipHtml(c) {
      const P = c.pip;
      if (!P) return `<div class="field"><span class="lbl">Doble toma</span><p class="hint">Pon otra toma en un cuadro encima de esta, por ejemplo la del dron o la de otra cámara.</p>
        <button class="btn" type="button" data-act="pipAdd">+ Agregar doble toma</button></div>`;
      const st = (act, step, val) => `<div class="stepper"><button type="button" data-act="${act}" data-v="-${step}">−${step} s</button><output>${val}</output><button type="button" data-act="${act}" data-v="${step}">+${step} s</button></div>`;
      return `<div class="field pipbox"><span class="lbl">Doble toma</span>
        <div class="pip-row"><canvas class="pip-th" width="112" height="63" data-el="pipTh"></canvas><div class="pip-n"><strong>${esc(P.name)}</strong><span>${fmt(P.dur)}${P.hasAudio ? '' : ' · sin sonido'}</span></div><button class="link" type="button" data-act="pipAdd">Cambiar</button></div>
        <span class="lbl">Tamaño del cuadro</span>${this.advSeg('pipSize', PIP_SIZES, P.size || 'm')}
        <span class="lbl">Lugar</span><div class="pos four" data-el="pipPos" role="radiogroup">${PIP_POS.map(([k, t]) => `<button type="button" data-act="pipPos" data-v="${k}" aria-label="${t}" title="${t}" aria-checked="${(P.pos || 'tr') === k}"></button>`).join('')}</div>
        <span class="lbl">Aparece en el segundo</span>${st('pipAt', 1, fmt(P.at))}<button class="link" type="button" data-act="pipHere">Que aparezca donde va el video</button>
        <span class="lbl">Cuánto dura</span>${st('pipLen', 1, Math.round(P.len) + ' s')}
        <span class="lbl">Qué parte de la doble toma se ve</span>${st('pipFrom', 2, 'desde ' + fmt(P.from))}
        <div class="sw-row"><button class="switch" type="button" role="switch" data-act="pipFrame" aria-checked="${P.frame !== false}" aria-label="Marco blanco"></button><span>Marco blanco</span></div>
        ${P.hasAudio ? `<div class="sw-row"><button class="switch" type="button" role="switch" data-act="pipAudio" aria-checked="${!!P.audio}" aria-label="Sonido de la doble toma"></button><span>Usar también su sonido</span></div>` : ''}
        <button class="link danger" type="button" data-act="pipOff">Quitar doble toma</button></div>`;
    }
    advOpen(v) {
      if (v != null) { try { localStorage.setItem('saucedo-avanzado', v ? '1' : '0'); } catch (e) {} return v; }
      try { return localStorage.getItem('saucedo-avanzado') === '1'; } catch (e) { return false; }
    }
    bindAdv(d, c) {
      const adv = d.querySelector('[data-el="adv"]');
      if (!adv) return;
      adv.addEventListener('toggle', () => this.advOpen(adv.open));
      SA.trans.animate(adv, () => this.transImgs(c));
      $$('.seg[data-cv]', adv).forEach(g => g.addEventListener('click', e => {
        const b = e.target.closest('button[data-v]'); if (!b) return;
        this.snap();
        const k = g.dataset.cv, v = k === 'pipSize' ? 0 : +b.dataset.v;
        if (k === 'tdur') c.trans = Object.assign({}, c.trans, { dur: v });
        else if (k === 'pipSize') { c.pip.size = b.dataset.v; }
        else if (k === 'rot') c.rot = v || undefined;
        else c[k] = v === 1 ? undefined : v;
        this.changedClip(c);
      }));
      let snapped = false;
      $$('[data-col]', adv).forEach(r => {
        r.addEventListener('pointerdown', () => { if (!snapped) { this.snap(); snapped = true; } });
        r.addEventListener('input', () => {
          c.color = Object.assign({}, COLOR0, c.color || {}, { [r.dataset.col]: +r.value });
          if (!c.color.b && !c.color.c && !c.color.s && !c.color.w) c.color = undefined;
          r.nextElementSibling.textContent = `${+r.value > 0 ? '+' : ''}${r.value}`;
          this.applyPreviewLook(); this.dirty();
        });
      });
      const lb = adv.querySelector('[data-cv="label"]');
      lb.addEventListener('focus', () => this.snap(), { once: true });
      lb.addEventListener('input', () => { c.label = lb.value.trim() || undefined; this.applyPreviewLook(); this.dirty(); });
      lb.addEventListener('change', () => this.refreshCard(c.id));
      const ph = adv.querySelector('[data-el="pipTh"]');
      if (ph && c.pip) { const t = c.pip.clip && this.rt[c.pip.clip] && this.rt[c.pip.clip].thumb; if (t) C.drawFit(ph.getContext('2d'), t, ph.width, ph.height, 'cover'); else this.pipThumb(c.pip).then(im => { if (im && ph.isConnected) C.drawFit(ph.getContext('2d'), im, ph.width, ph.height, 'cover'); }); }
    }
    changedClip(c) { this.dirty(); this.showDetail(); this.refreshCard(c.id); this.summary(); }
    act_setTrans(b) {
      const c = this.clip(this.focus); if (!c) return;
      this.snap();
      c.trans = b.dataset.v === 'auto' ? undefined : { type: b.dataset.v, dur: (c.trans && c.trans.dur) || 0.8 };
      this.changedClip(c); this.renderBoard();
    }
    act_stab() { const c = this.clip(this.focus); this.snap(); c.stab = !c.stab || undefined; this.changedClip(c); }
    act_colorReset() { const c = this.clip(this.focus); this.snap(); c.color = undefined; this.changedClip(c); }
    act_colorAll() {
      const c = this.clip(this.focus), m = this.momentOf(c.id);
      if (!m) { toast('Primero manda esta toma a un momento.'); return; }
      this.snap();
      let n = 0; m.clips.forEach(id => { const x = this.p.clips[id]; if (x && x.kind === 'video' && x !== c) { x.color = c.color ? Object.assign({}, c.color) : undefined; n++; } });
      this.dirty(); toast(`Se puso el mismo color en ${n} ${n === 1 ? 'toma' : 'tomas'} de "${m.name}".`);
    }
    // Vista previa: color, giro, acercamiento, velocidad y letrero sobre el reproductor.
    applyPreviewLook() {
      const c = this.clip(this.focus), v = this.q('video'), lp = this.q('lblPrev');
      const plain = () => { v.style.filter = v.style.transform = v.style.clipPath = ''; v.controls = true; this.syncPip(); };
      if (!c) { plain(); lp.hidden = true; return; }
      lp.hidden = !c.label; lp.textContent = c.label || '';
      const sh = this.p.shadow || 'auto';
      lp.style.textShadow = sh === 'none' ? 'none' : sh === 'strong' ? '3px 4px 4px rgba(0,0,0,.9)' : sh === 'soft' ? '0 2px 14px rgba(0,0,0,.7)' : '';
      if (c.kind !== 'video') { plain(); return; }
      const col = Object.assign({}, COLOR0, c.color || {}), f = [];
      if (col.b) f.push(`brightness(${(1 + col.b / 250).toFixed(3)})`);
      if (col.c) f.push(`contrast(${(1 + col.c / 250).toFixed(3)})`);
      if (col.s) f.push(`saturate(${Math.max(0, 1 + col.s / 100).toFixed(3)})`);
      if (col.w > 0) f.push(`sepia(${(col.w / 350).toFixed(3)})`); else if (col.w < 0) f.push(`hue-rotate(${(col.w / 8).toFixed(1)}deg) saturate(${(1 + col.w / 400).toFixed(3)})`);
      v.style.filter = f.join(' ');
      // Giro y acercamiento: el cuadro del video se gira y se escala; el recorte (clip-path) deja ver solo
      // la parte central que quedará en la película. Con el video girado no se muestran los controles.
      const rot = c.rot || 0, z = c.zoom || 1, side = rot % 180 !== 0;
      const ew = v.clientWidth || 1, eh = v.clientHeight || 1, ar = (v.videoWidth || c.w || 16) / (v.videoHeight || c.h || 9);
      const w = Math.min(ew, eh * ar), h = w / ar, sc = (side ? Math.min(ew / h, eh / w) : 1) * z;
      const ix = (ew - w) / 2 + w * (1 - 1 / z) / 2, iy = (eh - h) / 2 + h * (1 - 1 / z) / 2;
      v.style.clipPath = z > 1 ? `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px)` : '';
      v.style.transform = rot || z !== 1 ? `rotate(${rot}deg) scale(${sc.toFixed(4)})` : '';
      v.controls = !rot;
      try { v.playbackRate = c.speed || 1; v.preservesPitch = true; } catch (e) {}
      this.syncPip();
    }

    /* ---------- Doble toma ---------- */
    // Ventana elegida para elegir la otra toma: videos del proyecto o uno de la computadora.
    pickPip(c) {
      return new Promise(resolve => {
        const vids = Object.values(this.p.clips).filter(x => x.kind === 'video' && x.ready && x.path !== c.path).sort((a, b) => this.time(a) - this.time(b));
        const wrap = document.createElement('div');
        wrap.className = 'modal pippick'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
        wrap.innerHTML = `<div class="modal-card">
          <div class="mp-head"><h2>Elige la doble toma</h2><button class="mp-x" type="button" data-pk="close" aria-label="Cerrar">×</button></div>
          <p class="hint">Se verá en un cuadro encima de «${esc(c.name)}». Por ejemplo, la toma del dron o la de otra cámara en el mismo momento.</p>
          <div class="pk-grid">${vids.map(x => `<button type="button" class="pk" data-pk="${x.id}"><canvas width="192" height="108"></canvas><strong>${esc(x.name)}</strong><span>${hhmm(this.time(x))} · ${fmt(x.duration)}</span></button>`).join('') || '<p class="hint">No hay otros videos en esta película.</p>'}</div>
          <div class="mp-foot"><button class="btn" type="button" data-pk="file">Usar un video de mi computadora…</button><button class="btn" type="button" data-pk="close">Cancelar</button></div></div>`;
        document.body.appendChild(wrap);
        $$('.pk', wrap).forEach(b => { const t = this.rt[b.dataset.pk] && this.rt[b.dataset.pk].thumb, cv = b.querySelector('canvas'); if (t) C.drawFit(cv.getContext('2d'), t, cv.width, cv.height, 'cover'); });
        const done = v => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
        const onKey = e => { if (e.key === 'Escape') done(null); };
        document.addEventListener('keydown', onKey);
        wrap.addEventListener('click', async e => {
          if (e.target === wrap) return done(null);
          const b = e.target.closest('[data-pk]'); if (!b) return;
          const k = b.dataset.pk;
          if (k === 'close') return done(null);
          if (k === 'file') {
            const ps = await B.pick('media', false); if (!ps || !ps.length) return;
            try {
              const pr = await B.probe(ps[0]); if (!pr.hasVideo) throw new Error('sin video');
              return done({ path: ps[0], name: B.baseName(ps[0]), w: pr.width, h: pr.height, dur: pr.duration, hasAudio: pr.hasAudio, from: 0 });
            } catch (err) { toast('Ese archivo no se pudo leer como video.'); return; }
          }
          const x = this.p.clips[k];
          done({ clip: x.id, path: x.path, name: x.name, w: x.w, h: x.h, dur: x.duration, hasAudio: !!x.hasAudio, from: x.in || 0 });
        });
      });
    }
    async act_pipAdd() {
      const c = this.clip(this.focus); if (!c || c.kind !== 'video') return;
      const r = await this.pickPip(c); if (!r) return;
      this.snap();
      const v = this.q('video'), a0 = c.in || 0, b0 = c.out || c.duration;
      const at = c.pip ? c.pip.at : (v.currentTime > a0 && v.currentTime < b0 - 2 ? Math.round(v.currentTime) : a0);
      c.pip = Object.assign({ size: 'm', pos: 'tr', frame: true, audio: false }, c.pip ? { size: c.pip.size, pos: c.pip.pos, frame: c.pip.frame } : {}, r, { at });
      c.pip.len = Math.max(1, Math.min(c.pip.len || 8, b0 - at, r.dur - r.from));
      if (r.clip && !this.p.clips[r.clip].excluded) toast('Listo. Si no quieres que esa toma salga también sola en la película, tócala y usa "No usar esta toma".', 7000);
      this.changedClip(c);
    }
    pipFix(c) {
      const P = c.pip, a0 = c.in || 0, b0 = c.out || c.duration;
      P.at = Math.max(a0, Math.min(b0 - 1, P.at));
      P.from = Math.max(0, Math.min(P.dur - 1, P.from));
      P.len = Math.max(1, Math.min(P.len, b0 - P.at, P.dur - P.from));
    }
    pipStep(key, b) { const c = this.clip(this.focus); if (!c || !c.pip) return; this.snap(); c.pip[key] = (c.pip[key] || 0) + (+b.dataset.v); this.pipFix(c); this.changedClip(c); }
    act_pipAt(b) { this.pipStep('at', b); }
    act_pipLen(b) { this.pipStep('len', b); }
    act_pipFrom(b) { this.pipStep('from', b); }
    act_pipHere() { const c = this.clip(this.focus); if (!c || !c.pip) return; this.snap(); c.pip.at = Math.round(this.q('video').currentTime * 10) / 10; this.pipFix(c); this.changedClip(c); }
    act_pipPos(b) { const c = this.clip(this.focus); this.snap(); c.pip.pos = b.dataset.v; this.changedClip(c); }
    act_pipFrame() { const c = this.clip(this.focus); this.snap(); c.pip.frame = c.pip.frame === false; this.changedClip(c); }
    act_pipAudio() { const c = this.clip(this.focus); this.snap(); c.pip.audio = !c.pip.audio; this.changedClip(c); }
    act_pipOff() { const c = this.clip(this.focus); this.snap(); c.pip = undefined; this.changedClip(c); }
    async pipThumb(P) {
      try {
        const out = B.join(this.cache, `cuadro_${E.hash(P.path + '@pip')}.jpg`);
        if (!(await B.exists(out))) await B.run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', '-ss', String(Math.min(P.dur * .3, (P.from || 0) + 1)), '-i', P.path, '-frames:v', '1', '-vf', 'scale=240:-2', out]);
        return await createImageBitmap(await B.readBlob(out, 'image/jpeg'));
      } catch (e) { return null; }
    }
    // Copia ligera para ver un video que el reproductor no abre (.MTS, HEVC…).
    async proxyFor(path, dur, onMsg) {
      const out = B.join(this.cache, `vista_${E.hash(path)}.mp4`);
      if (await B.exists(out)) return out;
      const r = await B.run('ffmpeg', ['-y', '-hide_banner', '-nostats', '-progress', 'pipe:1', '-i', path, '-vf', 'scale=-2:540,format=yuv420p', '-r', '30',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out],
        t => onMsg && onMsg(Math.min(99, Math.round(t / Math.max(1, dur) * 100))));
      return r.code === 0 ? out : null;
    }
    // La doble toma en la vista previa: un segundo video en la esquina, al mismo tiempo que la toma.
    async syncPip() {
      const c = this.clip(this.focus), v = this.q('video'), pv = this.q('pipVid'), P = c && c.kind === 'video' ? c.pip : null;
      if (!P) { if (!pv.hidden) { pv.hidden = true; pv.pause(); } return; }
      if (pv.dataset.path !== P.path) {
        pv.dataset.path = P.path; pv.dataset.ok = '';
        let src = null;
        const prox = B.join(this.cache, `vista_${E.hash(P.path)}.mp4`);
        try { src = await B.previewSrc((await B.exists(prox)) ? prox : P.path); } catch (e) {}
        pv.onerror = async () => { if (pv.dataset.fixing) return; pv.dataset.fixing = '1'; const o = await this.proxyFor(P.path, P.dur); if (o && pv.dataset.path === P.path) pv.src = await B.previewSrc(o); };
        if (src) pv.src = src;
        pv.onloadeddata = () => { pv.dataset.ok = '1'; this.syncPip(); };
        return;
      }
      const t = v.currentTime, inside = t >= P.at && t < P.at + P.len;
      // Tamaño y lugar sobre la imagen (no sobre las franjas negras)
      const sc = this.q('screen'), ew = sc.clientWidth, eh = sc.clientHeight, ar = (v.videoWidth || 16) / (v.videoHeight || 9);
      const vw = Math.min(ew, eh * ar), vh = vw / ar, x0 = (ew - vw) / 2, y0 = (eh - vh) / 2, m = Math.min(vw, vh) * .045;
      const par = (pv.videoWidth || P.w || 16) / (pv.videoHeight || P.h || 9);
      let w = vw * (E.PIP_SIZES[P.size] || .38), h = w / par; if (h > vh * .62) { h = vh * .62; w = h * par; }
      const pos = P.pos || 'tr';
      Object.assign(pv.style, { width: w + 'px', height: h + 'px', left: (pos[1] === 'l' ? x0 + m : x0 + vw - m - w) + 'px', top: (pos[0] === 't' ? y0 + m : y0 + vh - m - h) + 'px',
        outline: P.frame === false ? 'none' : `${Math.max(2, Math.round(Math.min(vw, vh) * .006))}px solid #fff` });
      pv.hidden = !inside || !pv.dataset.ok || !!c.rot;
      if (!inside || pv.hidden) { pv.pause(); return; }
      const want = P.from + (t - P.at);
      if (Math.abs(pv.currentTime - want) > .35) pv.currentTime = want;
      if (!v.paused && pv.paused) pv.play().catch(() => {}); else if (v.paused && !pv.paused) pv.pause();
    }
    // Para crear: en qué parte de cada pedazo (sin las partes quitadas) va la doble toma.
    pipWindows(c) {
      const P = c.pip; if (!P || !P.path) return [];
      const sp = c.speed || 1, A0 = P.at, A1 = P.at + P.len;
      let elapsed = 0;
      return E.keptRanges(c).map(([r0, r1]) => {
        const o0 = Math.max(A0, r0), o1 = Math.min(A1, r1);
        if (o1 - o0 < .3) return null;
        const a = (o0 - r0) / sp, from = (P.from || 0) + elapsed;
        let b = (o1 - r0) / sp;
        if (from + (b - a) > P.dur) b = a + Math.max(0, P.dur - from);
        elapsed += b - a;
        return b - a < .3 ? null : { path: P.path, from: Math.round(from * 1000) / 1000, a: Math.round(a * 1000) / 1000, b: Math.round(b * 1000) / 1000,
          size: P.size || 'm', pos: P.pos || 'tr', frame: P.frame !== false, audio: !!P.audio, hasAudio: !!P.hasAudio };
      });
    }

    /* ---------- Acortar la película ---------- */
    async act_shorten() {
      if (!this.p || this.busy) return;
      if (this.pumping) { toast('Espera a que termine la revisión del material.'); return; }
      const units = this.units(), cur = this.filmLen(units);
      if (units.length <= 2) { toast('Primero manda tomas a los momentos.'); return; }
      if (cur < 8 * 60) { toast('La película dura menos de 8 minutos: no hace falta acortarla.'); return; }
      const label = x => x >= 3600 ? `${Math.floor(x / 3600)} h${x % 3600 ? ` ${Math.round(x % 3600 / 60)} min` : ''}` : `${Math.round(x / 60)} min`;
      const opts = [5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300].map(m => m * 60).filter(x => x < cur - 60 && x >= cur * .2);
      if (!opts.length) { toast('La película ya está muy corta.'); return; }
      const ms = units.filter(u => u.moment);
      const wrap = document.createElement('div');
      wrap.className = 'modal shorten'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
      wrap.innerHTML = `<div class="modal-card">
        <div class="mp-head"><h2>Acortar la película</h2><button class="mp-x" type="button" data-sact="close" aria-label="Cerrar">×</button></div>
        <p>Ahora dura <strong>${fmt(cur)}</strong>. ¿Cuánto quieres que dure?</p>
        <div class="chips sh-opts">${opts.map(x => `<button type="button" class="chip" data-sv="${x}">${label(x)}</button>`).join('')}</div>
        <p class="hint">Se quitan primero las partes oscuras, sin movimiento, sin sonido o fuera de foco. Cada toma conserva por lo menos unos segundos, y lo que se quita queda en gris para regresarlo si quieres.</p>
        <div class="field"><span class="lbl">Momentos que no se recortan (toca para marcar o desmarcar)</span><div class="chips">${ms.map(u => `<button type="button" class="chip" data-sm="${u.moment.id}" aria-pressed="${this.isProtected(u.moment)}">${esc(u.moment.name)}</button>`).join('')}</div></div>
        <div class="progress" data-s="prog" hidden><div class="prog-row"><span data-s="ptext">Revisando…</span></div><div class="bar"><i data-s="bar"></i></div></div>
        <div class="modal-actions"><button class="btn" type="button" data-sact="close">Cancelar</button><button class="primary small" type="button" data-sact="go" disabled>Acortar</button></div>
      </div>`;
      document.body.appendChild(wrap);
      let target = null, stop = false, running = false;
      const onEsc = e => { if (e.key === 'Escape' && !running) close(); };
      const close = () => { stop = true; wrap.remove(); document.removeEventListener('keydown', onEsc); };
      document.addEventListener('keydown', onEsc);
      wrap.addEventListener('click', async e => {
        if (e.target === wrap && !running) { close(); return; }
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.sv) { target = +b.dataset.sv; $$('[data-sv]', wrap).forEach(x => x.setAttribute('aria-pressed', String(x === b))); wrap.querySelector('[data-sact="go"]').disabled = false; }
        else if (b.dataset.sm) { const m = this.p.moments.find(x => x.id === b.dataset.sm); m.protect = !this.isProtected(m); b.setAttribute('aria-pressed', String(m.protect)); this.dirty(); }
        else if (b.dataset.sact === 'close') { if (running) B.cancel(); close(); }
        else if (b.dataset.sact === 'go' && target && !running) {
          running = true; b.disabled = true;
          const prog = wrap.querySelector('[data-s="prog"]'), pt = wrap.querySelector('[data-s="ptext"]'), bar = wrap.querySelector('[data-s="bar"]');
          prog.hidden = false;
          try {
            const r = await this.shortenTo(target, (f, txt) => { bar.style.width = (f * 100).toFixed(1) + '%'; pt.textContent = txt; }, () => stop);
            if (stop) return;
            close();
            if (r && !r.parts) toast('No encontré partes que se puedan quitar sin dejar las tomas demasiado cortas. Prueba desmarcando algún momento protegido.', 10000);
            else if (r) toast(`Listo: la película pasó de ${fmt(cur)} a ${fmt(r.after)}${r.short ? ' (es lo más corto posible sin tocar los momentos protegidos ni dejar tomas de menos de 3 segundos)' : ''}. Se quitaron ${r.parts} partes; están en gris en cada toma por si quieres regresar alguna, o usa Deshacer.`, 12000);
          } catch (err) { close(); SA.showError('No se pudo acortar la película.', String(err && err.stack || err)); }
        }
      });
    }
    // Revisa segundo a segundo las tomas que se pueden recortar y quita lo menos bueno hasta llegar a la duración.
    async shortenTo(target, onProg, stopped) {
      const units = this.units(), before = this.filmLen(units);
      const clips = units.filter(u => u.moment && !this.isProtected(u.moment)).flatMap(u => u.clips).filter(c => c.kind === 'video');
      if (!clips.length) { toast('Todos los momentos están marcados para no recortarse.'); return null; }
      // 1. Revisión por segundo (una vez por archivo; los pedazos de un mismo archivo la comparten)
      await this.analyzeHl(clips, (f, k, n) => onProg(f * .9, `Revisando segundo a segundo: archivo ${k + 1} de ${n}`), stopped);
      if (stopped()) return null;
      onProg(.95, 'Eligiendo qué quitar');
      this.snap();
      const plan = E.planShorten(clips.map(c => ({ id: c.id, in: c.in || 0, out: c.out || c.duration, duration: c.duration, cuts: c.cuts, hl: c.hl, speed: c.speed || 1 })), before - target);
      let parts = 0;
      Object.entries(plan.cuts).forEach(([id, list]) => {
        const c = this.p.clips[id]; parts += list.length;
        const all = (c.cuts || []).concat(list).sort((x, y) => x[0] - y[0]), merged = [];
        all.forEach(r => { const l = merged[merged.length - 1]; if (l && r[0] <= l[1] + .05) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); });
        c.cuts = merged;
      });
      const after = this.filmLen();
      this.dirty(); this.renderBoard(); this.showDetail(); this.summary();
      return { after, parts, short: after > target + 60 };
    }

    // Revisión segundo a segundo de los videos que aún no la tienen. Se hace una vez por archivo
    // y se comparte con todos los pedazos de ese archivo. onProg(fracción, i, total)
    async analyzeHl(list, onProg, stopped) {
      const all = Object.values(this.p.clips).filter(c => c.kind === 'video'), byPath = {};
      all.forEach(c => { (byPath[c.path] = byPath[c.path] || []).push(c); });
      Object.values(byPath).forEach(g => { const h = g.find(c => c.hl); if (h) g.forEach(c => { c.hl = c.hl || h.hl; }); });
      const todo = [...new Set(list.filter(c => c.kind === 'video' && !c.hl).map(c => c.path))];
      for (let i = 0; i < todo.length; i++) {
        if (stopped && stopped()) return;
        const c0 = byPath[todo[i]][0], n = todo.length;
        onProg(i / n, i, n);
        const r = await B.run('ffmpeg', E.hlArgs(c0.path, c0.hasAudio), t => onProg((i + Math.min(1, t / Math.max(1, c0.duration))) / n, i, n), true);
        const hl = E.hlParse(r.stderr || '');
        const packed = { v: hl.v.map(x => [Math.round(x[0] * 10) / 10, Math.round(x[1]), Math.round(x[2] * 10) / 10, Math.round(x[3] * 100) / 100]), a: hl.a.map(x => [Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10]) };
        byPath[todo[i]].forEach(c => { c.hl = packed; });
      }
    }

    /* ---------- Tijeras, partes quitadas y deshacer ---------- */
    act_split() {
      const c = this.clip(this.focus), v = this.q('video');
      if (!c || c.kind !== 'video' || !c.ready) return;
      const t = Math.round(v.currentTime * 10) / 10, a = c.in || 0, b = c.out || c.duration;
      if (t - a < MIN_LEN || b - t < MIN_LEN) { toast('Pon el video justo donde quieres cortar: por lo menos 1.5 segundos después del inicio y antes del final de esta toma.', 6000); return; }
      this.snap();
      const id = c.id.split('_')[0] + '_' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
      const n = JSON.parse(JSON.stringify(c));
      n.id = id; n.in = t; n.out = b; n.label = undefined; n.trans = undefined;
      n.cuts = (c.cuts || []).filter(r => r[1] > t).map(r => [Math.max(t, r[0]), r[1]]);
      c.cuts = (c.cuts || []).filter(r => r[0] < t).map(r => [r[0], Math.min(t, r[1])]);
      c.out = t; c.split = n.split = true;
      if (n.scan && n.scan.flags) n.scan = Object.assign({}, n.scan, { flags: n.scan.flags.filter(f => f !== 'larga') });
      this.p.clips[id] = n;
      const m = this.momentOf(c.id);
      if (m) { m.clips.splice(m.clips.indexOf(c.id) + 1, 0, id); }
      this.rt[id] = { thumb: (this.rt[c.id] || {}).thumb, proxy: (this.rt[c.id] || {}).proxy };
      this.queue.push(id, c.id); this.pump();
      this.dirty(); this.renderBoard(); this.showDetail(); this.summary();
      toast('Listo: la toma quedó en dos pedazos. Si no quieres uno, tócalo y usa "No usar esta toma" (o la tecla Supr).', 7000);
    }
    focusClip(id) {
      const c = this.clip(id); if (!c) return;
      this.focus = id; this.panel = null; this.selected.clear(); this.selected.add(id);
      this.syncSel(); this.showDetail(); this.loadPlayer();
    }
    restoreCut(i) {
      const c = this.clip(this.focus); if (!c || !c.cuts || !c.cuts[i]) return;
      this.snap(); c.cuts.splice(i, 1); if (!c.cuts.length) c.cuts = undefined;
      this.dirty(); this.showDetail(); this.refreshCard(c.id); this.summary();
      toast('Se regresó esa parte a la película.');
    }
    act_restoreAllCuts() { const c = this.clip(this.focus); if (!c) return; this.snap(); c.cuts = undefined; this.dirty(); this.showDetail(); this.refreshCard(c.id); this.summary(); }
    snap() {
      if (!this.p) return;
      this.undo = this.undo || [];
      this.undo.push(JSON.stringify({ clips: this.p.clips, moments: this.p.moments }));
      if (this.undo.length > 60) this.undo.shift();
      this.syncUndo();
    }
    syncUndo() { const b = this.q('undoBtn'); if (b) b.disabled = !(this.undo && this.undo.length); }
    act_undo() {
      if (!this.p || !this.undo || !this.undo.length) { toast('No hay nada que deshacer.'); return; }
      const st = JSON.parse(this.undo.pop());
      this.p.clips = st.clips; this.p.moments = st.moments;
      Object.keys(this.p.clips).forEach(id => { if (!this.rt[id] || !this.rt[id].thumb) this.queue.push(id); });
      if (this.focus && !this.p.clips[this.focus]) this.focus = null;
      this.selected.clear(); this.syncUndo();
      this.dirty(); this.renderBoard(); this.showDetail(); this.summary(); this.pump();
      toast('Se deshizo el último cambio.');
    }
    act_keys() {
      SA.ui.toast('Atajos: S = cortar aquí · I = empieza aquí · O = termina aquí · Espacio = reproducir/pausar · Supr = no usar la toma · Ctrl+Z = deshacer · ← → = toma anterior o siguiente', 12000);
    }
    onKey(e) {
      if (!this.p || this.root.hidden || this.q('editor').hidden) return false;
      const k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { this.act_undo(); return true; }
      const c = this.clip(this.focus);
      if (!c || e.altKey) return false;
      if (k === 's' && !e.ctrlKey && !e.metaKey || (e.ctrlKey && k === 'b')) { if (c.kind === 'video') this.act_split(); return true; }
      if (k === 'delete' || k === 'supr') { if (!c.excluded) this.act_excludeClip(); return true; }
      if (k === ' ' && c.kind === 'video') { const v = this.q('video'); v.paused ? v.play() : v.pause(); return true; }
      if (k === 'i' && c.kind === 'video') { this.act_markIn(); return true; }
      if (k === 'o' && c.kind === 'video') { this.act_markOut(); return true; }
      return false;
    }
    act_mute() { const c = this.clip(this.focus); c.mute = !c.mute; this.dirty(); this.showDetail(); this.applyPreviewVolume(); this.renderBoard(); }
    act_photoLen(b) { const c = this.clip(this.focus); c.len = Math.max(2, Math.min(15, (c.len || 4) + (+b.dataset.v))); this.dirty(); this.showDetail(); this.renderBoard(); this.summary(); }
    act_moveClip(b) {
      const c = this.clip(this.focus), m = this.momentOf(c.id), i = m.clips.indexOf(c.id), j = i + (+b.dataset.v);
      if (j < 0 || j >= m.clips.length) return;
      this.snap(); [m.clips[i], m.clips[j]] = [m.clips[j], m.clips[i]]; m.manual = true;
      this.dirty(); this.renderBoard(); this.showDetail();
    }
    act_excludeClip() { this.snap(); this.exclude(this.focus, true); this.dirty(); this.renderBoard(); this.showDetail(); this.summary(); this.renderAdvice(); }
    act_restoreClip() { this.snap(); this.exclude(this.focus, false); this.dirty(); this.renderBoard(); this.showDetail(); this.summary(); }

    momentPanel(d) {
      const m = this.p.moments.find(x => x.id === this.panel);
      if (!m) { this.panel = null; return this.showDetail(); }
      const tip = (MOMENTS.find(x => x.key === m.key) || {}).tip;
      const cs = m.clips.map(id => this.p.clips[id]).filter(Boolean), i = this.p.moments.indexOf(m);
      d.innerHTML = `
        <label class="field"><span class="lbl">Nombre del momento</span><input class="input" data-mf="name" type="text" value="${esc(m.name)}" autocomplete="off"></label>
        ${tip ? `<p class="flag tip"><strong>Recomendación.</strong> ${esc(tip)}</p>` : ''}
        <div class="sw-row"><button class="switch" type="button" role="switch" data-act="mTitle" aria-checked="${m.title}" aria-label="Título de capítulo"></button><span>Empieza con el título "${esc(m.name)}"</span></div>
        <div class="field"><span class="lbl">Volumen del sonido de las tomas</span>
          <div class="slider"><input type="range" min="0" max="150" step="5" value="${Math.round(m.vol * 100)}" data-mf="vol" aria-label="Volumen de las tomas"><output>${Math.round(m.vol * 100)} %</output></div></div>
        <div class="field"><span class="lbl">Música de este momento</span>
          ${m.music ? `<div class="song">
            <span class="song-name">${esc(m.music.name)} · ${fmt(m.music.duration)}</span>
            <div class="stepper"><span class="lbl">Empieza en</span><button type="button" data-act="mStart" data-v="-5">−5 s</button><output>${fmt(m.music.start)}</output><button type="button" data-act="mStart" data-v="5">+5 s</button><button class="btn" type="button" data-act="mListen">Escuchar</button></div>
            <div class="slider"><input type="range" min="5" max="100" step="5" value="${Math.round(m.music.vol * 100)}" data-mf="mvol" aria-label="Volumen de la música"><output>${Math.round(m.music.vol * 100)} %</output></div>
            <p class="hint">La música baja sola cuando alguien habla en las tomas.</p>
            <div class="links"><button class="link" type="button" data-act="mSong">Cambiar música</button><button class="link danger" type="button" data-act="mSongOff">Quitar música</button></div></div>`
          : `<button class="btn" type="button" data-act="mSong">Elegir música</button>`}
        </div>
        <details class="adv" data-el="adv"${this.advOpen() ? ' open' : ''}><summary>Opciones avanzadas del momento</summary>
          <div class="field"><span class="lbl">Transición entre las tomas de este momento</span>${this.transGrid(m.trans && m.trans.type, 'setMTrans')}
            ${m.trans && m.trans.type !== 'corte' ? `<span class="lbl">Duración</span>${this.advSeg('mtdur', TDUR, m.trans.dur || 0.8)}` : ''}
            <p class="hint">Las tomas que tengan su propia transición la conservan.</p></div>
          <div class="sw-row"><button class="switch" type="button" role="switch" data-act="mProtect" aria-checked="${this.isProtected(m)}" aria-label="No recortar"></button><span>No recortar este momento al usar "Acortar la película"</span></div>
        </details>
        <p class="d-sub">${cs.length} tomas · ${fmt(cs.reduce((s, c) => s + this.clipLen(c), 0))} antes de transiciones</p>
        <div class="d-actions">
          <button class="navbtn dark" type="button" data-act="mMove" data-v="-1" ${i <= 0 ? 'disabled' : ''}>‹ Mover momento</button>
          <button class="navbtn dark" type="button" data-act="mMove" data-v="1" ${i >= this.p.moments.length - 1 ? 'disabled' : ''}>Mover momento ›</button>
          ${m.manual ? '<button class="link" type="button" data-act="mSort">Ordenar por hora</button>' : ''}
          ${!cs.length ? '<button class="link danger" type="button" data-act="mDelete">Borrar momento</button>' : ''}
        </div>`;
      const name = d.querySelector('[data-mf="name"]');
      name.addEventListener('input', () => { m.name = name.value || 'Momento'; this.dirty(); clearTimeout(this.nameT); this.nameT = setTimeout(() => this.renderBoard(), 400); });
      const vol = d.querySelector('[data-mf="vol"]');
      vol.addEventListener('input', () => { m.vol = vol.value / 100; vol.nextElementSibling.textContent = `${vol.value} %`; this.dirty(); });
      const mv = d.querySelector('[data-mf="mvol"]');
      if (mv) mv.addEventListener('input', () => { m.music.vol = mv.value / 100; mv.nextElementSibling.textContent = `${mv.value} %`; if (this.audio) this.audio.volume = Math.min(1, m.music.vol); this.dirty(); });
      const adv = d.querySelector('[data-el="adv"]');
      adv.addEventListener('toggle', () => this.advOpen(adv.open));
      SA.trans.animate(adv, () => this.transImgs({}));
      const md = adv.querySelector('[data-cv="mtdur"]');
      if (md) md.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; this.snap(); m.trans = Object.assign({}, m.trans, { dur: +b.dataset.v }); this.dirty(); this.showDetail(); this.summary(); });
      this.q('trimBox').hidden = true;
    }
    isProtected(m) { return m.protect != null ? !!m.protect : PROTECT.includes(m.key); }
    act_setMTrans(b) { const m = this.curMoment(); this.snap(); m.trans = b.dataset.v === 'auto' ? undefined : { type: b.dataset.v, dur: (m.trans && m.trans.dur) || 0.8 }; this.dirty(); this.showDetail(); this.summary(); this.renderBoard(); }
    act_mProtect() { const m = this.curMoment(); m.protect = !this.isProtected(m); this.dirty(); this.showDetail(); }
    curMoment() { return this.p.moments.find(x => x.id === this.panel); }
    act_mTitle() { const m = this.curMoment(); m.title = !m.title; this.dirty(); this.showDetail(); this.summary(); }
    async act_mSong() {
      const m = this.curMoment(); this.stopAudio();
      const song = await this.chooseSong({ title: `Música para «${m.name}»`, forName: m.name, suggest: SA.music.forMoment(m.key), current: m.music });
      if (!song) return;
      m.music = Object.assign(song, { vol: .6 });
      this.dirty(); this.showDetail(); this.renderBoard();
    }
    // Ventana de música (incluida o de la computadora) → canción lista para guardar en el proyecto.
    async chooseSong(opts) {
      const r = await SA.music.pick(opts);
      if (!r || r.kind === 'none') return null;
      if (r.kind === 'builtin') return SA.music.song(r.id);
      return this.readSong(r.path);
    }
    act_mSongOff() { this.stopAudio(); const m = this.curMoment(); m.music = null; this.dirty(); this.showDetail(); this.renderBoard(); }
    act_mStart(b) { const m = this.curMoment(); m.music.start = Math.max(0, Math.min(Math.floor(m.music.duration - 10), m.music.start + (+b.dataset.v))); this.dirty(); this.showDetail(); if (this.audio && !this.audio.paused) this.audio.currentTime = m.music.start; }
    act_mListen(b) { const m = this.curMoment(); this.listen(m.music, b); }
    act_mMove(b) {
      const ms = this.p.moments, i = ms.findIndex(x => x.id === this.panel), j = i + (+b.dataset.v);
      if (j < 0 || j >= ms.length) return;
      [ms[i], ms[j]] = [ms[j], ms[i]]; this.dirty(); this.renderBoard(); this.showDetail(); this.summary();
    }
    act_mSort() { const m = this.curMoment(); m.manual = false; m.clips.sort((a, b) => this.time(this.p.clips[a]) - this.time(this.p.clips[b])); this.dirty(); this.renderBoard(); this.showDetail(); }
    act_mDelete() { this.snap(); this.p.moments = this.p.moments.filter(x => x.id !== this.panel); this.panel = null; this.dirty(); this.renderBoard(); this.showDetail(); this.summary(); }

    async readSong(path) {
      try {
        const info = await B.probe(path);
        if (!info.hasAudio || !info.duration) throw new Error('sin audio');
        return { path, name: B.baseName(path), duration: info.duration, start: 0 };
      } catch (e) { toast('No se pudo leer esa canción. Prueba con un MP3 o M4A.'); return null; }
    }
    async listen(song, btn) {
      if (this.audio && !this.audio.paused) { this.stopAudio(); return; }
      try {
        if (this.audioPath !== song.path) { if (this.audioUrl) URL.revokeObjectURL(this.audioUrl); this.audioUrl = URL.createObjectURL(await B.readBlob(song.path)); this.audioPath = song.path; }
        this.audio = this.audio || new Audio();
        this.audio.src = this.audioUrl; this.audio.currentTime = song.start || 0; this.audio.volume = Math.min(1, song.vol || .6);
        await this.audio.play(); if (btn) btn.textContent = 'Detener';
        clearTimeout(this.audioT); this.audioT = setTimeout(() => this.stopAudio(), 20000);
      } catch (e) { toast('No se puede escuchar aquí, pero sí se usará en la película.'); }
    }
    stopAudio() { if (this.audio) this.audio.pause(); clearTimeout(this.audioT); $$('[data-act="mListen"]', this.root).forEach(b => { b.textContent = 'Escuchar'; }); }

    /* ================= Reproductor y recorte ================= */
    stopVideo() { const v = this.q('video'); v.pause(); }
    async loadPlayer() {
      const c = this.clip(this.focus), v = this.q('video'), img = this.q('img'), msg = this.q('screenMsg');
      this.stopAudio(); this.playRange = false;
      if (this.stopTP) { this.stopTP(); this.stopTP = null; } this.q('tprev').hidden = true;
      if (!c) return;
      msg.hidden = true;
      if (c.kind === 'image') {
        v.pause(); v.removeAttribute('src'); v.load(); v.hidden = true; img.hidden = false;
        if (this.imgUrl) URL.revokeObjectURL(this.imgUrl);
        this.imgUrl = URL.createObjectURL(await B.readBlob(c.path)); img.src = this.imgUrl;
        this.q('trimBox').hidden = true;
        return;
      }
      img.hidden = true; v.hidden = false; msg.hidden = true;
      const rt = this.rt[c.id] = this.rt[c.id] || {};
      this.playing = c.id;
      try { v.src = await B.previewSrc(rt.proxy || c.path); } catch (e) { return this.onVideoError(); }
      v.currentTime = c.in || 0;
      this.applyPreviewVolume();
      this.renderTrim();
    }
    // El reproductor no abre algunos formatos (.MTS, HEVC): se hace una copia ligera solo para ver.
    async onVideoError() {
      const c = this.clip(this.playing); if (!c || c.kind !== 'video') return;
      const rt = this.rt[c.id] = this.rt[c.id] || {};
      if (rt.proxy || rt.making) return;
      const msg = this.q('screenMsg'); msg.hidden = false; msg.textContent = 'Preparando la vista previa de esta toma…';
      rt.making = true;
      const out = B.join(this.cache, `vista_${E.hash(c.path)}.mp4`);
      if (!(await B.exists(out))) {
        const r = await B.run('ffmpeg', ['-y', '-hide_banner', '-nostats', '-progress', 'pipe:1', '-i', c.path, '-vf', 'scale=-2:540,format=yuv420p', '-r', '30',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out],
          t => { msg.textContent = `Preparando la vista previa… ${Math.min(99, Math.round(t / c.duration * 100))} %`; });
        rt.making = false;
        if (r.code !== 0) { msg.textContent = 'Esta toma no se puede ver aquí, pero sí se puede usar en la película.'; return; }
      }
      rt.making = false; rt.proxy = out;
      if (this.playing === c.id) { msg.hidden = true; this.loadPlayer(); }
    }
    applyPreviewVolume() {
      const c = this.clip(this.focus), v = this.q('video'); if (!c) return;
      const m = this.momentOf(c.id);
      v.volume = Math.min(1, (c.mute ? 0 : c.vol) * (m ? m.vol : 1));
    }
    renderTrim() {
      const c = this.clip(this.focus), box = this.q('trimBox');
      if (!c || c.kind !== 'video' || !c.duration) { box.hidden = true; return; }
      box.hidden = false;
      const a = (c.in || 0) / c.duration * 100, b = (c.out || c.duration) / c.duration * 100;
      Object.assign(this.q('keep').style, { left: a + '%', width: (b - a) + '%' });
      this.q('trimTxt').textContent = `Se usa de ${fmt(c.in || 0)} a ${fmt(c.out || c.duration)} · ${fmt(this.clipLen(c))}${c.speed && c.speed !== 1 ? ` (a ${c.speed}×)` : ''}`;
      const track = this.q('track'), head = this.q('head');
      $$('.cutr,.sib', track).forEach(x => x.remove());
      const pct = x => (x / c.duration * 100).toFixed(3) + '%';
      Object.values(this.p.clips).filter(x => x.id !== c.id && x.split && x.path === c.path && !x.excluded).forEach(x => {
        const el = document.createElement('div'); el.className = 'sib'; el.dataset.id = x.id;
        el.title = `Otro pedazo de esta toma (${fmt(x.in || 0)} a ${fmt(x.out || x.duration)}): tócalo para verlo`;
        Object.assign(el.style, { left: pct(x.in || 0), width: pct((x.out || x.duration) - (x.in || 0)) });
        track.insertBefore(el, head);
      });
      (c.cuts || []).forEach((r, i) => {
        const el = document.createElement('div'); el.className = 'cutr'; el.dataset.i = i;
        el.title = `Parte quitada (${fmt(r[0])} a ${fmt(r[1])}): tócala para regresarla`;
        Object.assign(el.style, { left: pct(r[0]), width: pct(r[1] - r[0]) });
        track.insertBefore(el, head);
      });
      const n = (c.cuts || []).length, tc = this.q('trimCuts');
      tc.hidden = !n; tc.textContent = n ? `${n} ${n === 1 ? 'parte quitada' : 'partes quitadas'} (en gris). Toca una para regresarla.` : '';
      this.onTime();
    }
    onTime() {
      const c = this.clip(this.focus), v = this.q('video');
      if (!c || c.kind !== 'video' || !c.duration) return;
      this.q('head').style.left = (v.currentTime / c.duration * 100) + '%';
      if (this.playRange && v.currentTime >= (c.out || c.duration)) { v.pause(); this.playRange = false; }
      this.syncPip();
      // "Ver lo que se usa" se brinca las partes quitadas, como quedará en la película
      if (this.playRange && !v.paused) { const r = (c.cuts || []).find(x => v.currentTime >= x[0] && v.currentTime < x[1] - .05); if (r) v.currentTime = Math.min(r[1], c.out || c.duration); }
    }
    act_markIn() {
      const c = this.clip(this.focus), t = this.q('video').currentTime;
      if (t > (c.out || c.duration) - MIN_LEN) { toast('El inicio tiene que quedar antes del final, con al menos 1.5 segundos de toma.'); return; }
      this.snap(); c.in = Math.round(t * 10) / 10; this.dirty(); this.renderTrim(); this.renderBoard(); this.summary();
    }
    act_markOut() {
      const c = this.clip(this.focus), t = this.q('video').currentTime;
      if (t < (c.in || 0) + MIN_LEN) { toast('El final tiene que quedar después del inicio, con al menos 1.5 segundos de toma.'); return; }
      this.snap(); c.out = Math.round(t * 10) / 10; this.dirty(); this.renderTrim(); this.renderBoard(); this.summary();
    }
    act_playRange() { const c = this.clip(this.focus), v = this.q('video'); v.currentTime = c.in || 0; this.playRange = true; v.play(); }
    act_resetTrim() {
      const c = this.clip(this.focus);
      if (c.split) { toast('Esta toma está cortada en pedazos: para juntarlos usa Deshacer.'); return; }
      this.snap(); c.in = 0; c.out = c.duration; this.dirty(); this.renderTrim(); this.renderBoard(); this.summary(); }
    keyNav(dir) {
      const ids = $$('.cc', this.q('board')).map(x => x.dataset.id);
      const i = ids.indexOf(this.focus) + dir;
      if (i >= 0 && i < ids.length) { this.focus = ids[i]; this.selected.clear(); this.selected.add(ids[i]); this.panel = null; this.syncSel(); this.showDetail(); this.loadPlayer(); }
    }

    /* ================= Estilo ================= */
    syncStyle() {
      if (!this.p) return;
      SA.ui.setSeg(this.q('mood'), this.p.mood);
      this.q('moodHint').textContent = { momento: 'Cada momento con lo suyo: fundidos lentos y luz cálida en la ceremonia y el vals, apertura en la entrada, más ágiles en la fiesta y en gris suave en la despedida.',
        elegante: 'Fundidos lentos, luz cálida, desenfoque y apertura, alternados: para bodas y XV años.', suave: 'Fundido sencillo entre todas las tomas.',
        dinamico: 'Deslizamientos y círculos más rápidos: para fiestas y eventos casuales.', corte: 'Cambio directo de una toma a otra.' }[this.p.mood] || ''; SA.ui.setSeg(this.q('style'), this.p.style); SA.ui.setSeg(this.q('theme'), this.p.theme); SA.ui.setSeg(this.q('shadow'), this.p.shadow || 'auto');
      const enh = this.root.querySelector('[data-act="enhance"]');
      enh.setAttribute('aria-pressed', String(this.p.enhance)); this.q('enhState').textContent = this.p.enhance ? 'Activado' : 'Apagado';
      this.q('denoise').setAttribute('aria-checked', String(this.p.denoise));
      this.q('wm').setAttribute('aria-checked', String(S.wm));
      this.q('wmSizeBox').hidden = !S.wm; SA.ui.setSeg(this.q('wmSize'), S.size || 'm');
      this.q('pSong').textContent = this.p.music ? `♪ ${this.p.music.name} · ${fmt(this.p.music.duration)}` : 'Sin canción';
      const pb = this.root.querySelector('[data-act="pSong"]'); if (pb) pb.textContent = this.p.music ? 'Cambiar' : 'Elegir';
      this.q('pSongOff').hidden = !this.p.music;
      const qk = this.p.quality || '1080';
      SA.ui.setSeg(this.q('quality'), qk);
      this.q('qualityHint').textContent = qk === '2160' ? 'Más nítida para pantallas grandes. Tarda unas 4 veces más, el archivo pesa mucho más y pide una computadora con 16 GB de memoria. Úsala solo si la cámara grabó en 4K.'
        : qk === '720' ? 'Más rápida y ligera, buena para mandar por WhatsApp o subir a redes.' : 'Recomendada: Full HD, como la entregan la mayoría de los estudios.';
    }
    act_enhance() { this.p.enhance = !this.p.enhance; this.dirty(); this.syncStyle(); }
    act_denoise() { this.p.denoise = !this.p.denoise; this.dirty(); this.syncStyle(); }
    act_wm() { S.wm = !S.wm; SA.brandChanged(); }
    async act_pSong() {
      const s = await this.chooseSong({ title: 'Música de la portada y los créditos', forName: 'la película', suggest: ['eternamente', 'primer-baile', 'para-siempre', 'vals-de-la-luna', 'nuestra-historia'], current: this.p.music });
      if (s) { this.p.music = Object.assign(s, { vol: .7 }); this.dirty(); this.syncStyle(); this.summary(); }
    }
    act_pSongOff() { this.p.music = null; this.dirty(); this.syncStyle(); this.summary(); }

    /* ================= Resumen y reel ================= */
    // Resumen y reel: si no hay canción, se propone una incluida (se puede cambiar).
    hl() { return this.p.hl || (this.p.hl = { res: 240, reel: 60, fit: 'blur', music: this.p.music ? null : SA.music.song('brillar') }); }
    syncOutputs() {
      if (!this.p) return;
      const outs = this.p.outputs || ['pelicula'], h = this.hl();
      $$('[data-el="outputs"] .chip', this.root).forEach(b => b.setAttribute('aria-pressed', String(outs.includes(b.dataset.v))));
      const any = outs.includes('resumen') || outs.includes('reel');
      this.q('hlOpts').hidden = !any; this.q('resOpt').hidden = !outs.includes('resumen'); this.q('reelOpt').hidden = !outs.includes('reel');
      SA.ui.setSeg(this.q('resDur'), String(h.res)); SA.ui.setSeg(this.q('reelDur'), String(h.reel)); SA.ui.setSeg(this.q('reelFit'), h.fit);
      const song = h.music || this.p.music;
      this.q('hlSong').textContent = song ? `♪ ${song.name}${h.music ? '' : ' (la de la portada)'}${song.builtin ? ' · incluida' : ''}` : 'Sin canción';
      const hb = this.root.querySelector('[data-act="hlSong"]'); if (hb) hb.textContent = song ? 'Cambiar' : 'Elegir';
      this.q('hlStartRow').hidden = !h.music; if (h.music) this.q('hlStart').textContent = fmt(h.music.start || 0);
      const n = outs.length;
      if (!this.busy) this.q('create').textContent = n === 1 ? { pelicula: 'Crear película', resumen: 'Crear resumen', reel: 'Crear reel' }[outs[0]] : `Crear ${n} videos`;
    }
    async act_hlSong() {
      const s = await this.chooseSong({ title: 'Música del resumen y del reel', forName: 'el resumen y el reel', suggest: ['brillar', 'eternamente', 'primer-baile', 'dia-de-fiesta', 'nuestra-historia', 'noche-de-neon'], current: this.hl().music });
      if (s) { this.hl().music = s; this.dirty(); this.syncOutputs(); this.summary(); }
    }
    act_hlStart(b) { const m = this.hl().music; if (!m) return; m.start = Math.max(0, Math.min(Math.floor(m.duration - 20), (m.start || 0) + (+b.dataset.v))); this.dirty(); this.syncOutputs(); }
    hlMoments() {
      return this.p.moments.map(m => ({ id: m.id, name: m.name, clips: m.clips.map(id => this.p.clips[id]).filter(c => c && c.ready && !c.excluded) })).filter(m => m.clips.length);
    }
    async createHighlights(kinds, chained) {
      if (this.busy) return;
      const p = this.p, h = this.hl(), song = h.music || p.music;
      if (!song) { toast('Elige la canción del resumen y del reel en el paso 4.'); return; }
      const ms = this.hlMoments();
      if (!ms.length) { toast('Manda tomas a por lo menos un momento.'); return; }
      this.flush();
      this.busy = true; this.cancelled = false; if (!chained) this.t0 = performance.now();
      const create = this.q('create'); create.disabled = true; create.textContent = 'Creando…';
      this.q('progress').hidden = false; this.q('done').hidden = true;
      this.q('progress').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const outs = [];
      try {
        this.encoder = await B.detectEncoder(S.codec);
        // 1. Revisar cada toma segundo a segundo (una sola vez; queda guardado)
        await this.analyzeHl(ms.flatMap(m => m.clips), (f, k, n) => this.setProgress(f * .3, `Buscando los mejores momentos: toma ${k + 1} de ${n}`), () => this.cancelled);
        this.dirty();
        // 2. Ritmo de la canción
        if (!song.beat && !this.cancelled) {
          this.setProgress(.3, 'Escuchando el ritmo de la canción');
          const raw = B.join(this.cache, `ritmo_${E.hash(song.path)}.raw`);
          const r = await B.run('ffmpeg', E.songDecodeArgs(song.path, 0, Math.min(song.duration, 600), raw));
          if (r.code === 0) {
            const info = E.detectBeats(new Float32Array(await (await B.readBlob(raw)).arrayBuffer()), 11025);
            if (info) song.beat = { bpm: info.bpm, period: info.period, beats: info.beats.map(b => Math.round(b * 1000) / 1000) };
          }
          this.dirty();
        }
        for (let i = 0; i < kinds.length && !this.cancelled; i++) {
          const out = await this.renderHighlight(kinds[i], song, `${kinds[i] === 'reel' ? 'Reel' : 'Resumen'} · `, i, kinds.length);
          if (out) outs.push(out);
        }
        if (this.cancelled) toast('Se canceló.');
        else if (outs.length) {
          this.lastOut = outs[outs.length - 1]; this.q('done').hidden = false;
          this.q('done').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          toast(`Listo: ${outs.map(o => B.baseName(o)).join(' y ')} en la carpeta de la película.`, 8000);
        }
      } catch (e) {
        if (!this.cancelled) SA.showError(e.message || 'No se pudo crear el resumen.', e.detail || String(e && e.stack || e));
      } finally {
        this.busy = false; create.disabled = false; this.q('progress').hidden = true; this.syncOutputs(); this.dirty();
      }
    }
    async renderHighlight(kind, song, prefix, idx, of) {
      const p = this.p, h = this.hl(), fk = kind === 'reel' ? 'v' : 'h', { W, H } = E.FORMATS[fk], sep = B.paths.sep;
      const start = song.start || 0, avail = Math.max(15, song.duration - start);
      const target = Math.min(kind === 'reel' ? h.reel : h.res, avail);
      const nb = song.beat && song.beat.beats.find(b => b >= start - .02);
      const beat = nb != null ? { period: song.beat.period, offset: nb - start } : null;
      const unit = beat ? E.beatUnit(beat.period, kind === 'reel' ? 2 : 4, kind === 'reel' ? .9 : 1.8, kind === 'reel' ? 2.2 : 3.6) : (kind === 'reel' ? 1.6 : 2.8);
      const intro = beat ? beat.offset + Math.max(1, Math.round((3.6 - beat.offset) / unit)) * unit : 3.6;
      const outro = 5;
      const ms = this.hlMoments();
      const picked = E.pickHighlights(ms.map(m => ({ id: m.id, clips: m.clips.map(c => ({ id: c.id, kind: c.kind, duration: c.duration, in: c.in || 0, out: c.out || c.duration, hl: c.hl, cuts: c.cuts })) })), Math.max(unit * 2, target - intro - outro), unit);
      const flat = [];
      picked.forEach((pm, mi) => pm.picks.forEach((pk, j) => flat.push(Object.assign({ moment: ms.find(m => m.id === pm.id), first: j === 0 }, pk))));
      if (!flat.length) throw new Error('No encontré tomas que se puedan usar. Revisa que los momentos tengan tomas de por lo menos 2 segundos.');
      // Línea de tiempo: inicio con título, tomas al ritmo y final con el logo
      const media = [], segments = [], momentAt = [];
      let t = 0;
      const push = (pk, len) => {
        const c = p.clips[pk.clip], out = (c.out || c.duration);
        const st = c.kind === 'video' ? Math.max(c.in || 0, Math.min(pk.start, out - len)) : 0;
        media.push({ kind: c.kind, path: c.path, width: c.w, height: c.h, duration: c.duration, name: c.name, clip: c, rot: c.rot || 0, vzoom: c.zoom || 1, color: c.color || null });
        segments.push({ m: media.length - 1, len: Math.round(len * 30) / 30, start: Math.round(st * 1000) / 1000, zoomIn: segments.length % 2 === 0 });
        if (pk.first && kind === 'resumen') momentAt.push({ t, name: pk.moment.name });
        t += Math.round(len * 30) / 30;
      };
      // Si hay poco material el video sale más corto (nunca se estira el final para llenar la canción).
      const room = Math.max(0, Math.floor((target - intro - outro) / unit));
      const mids = flat.slice(1, 1 + room);
      let last;
      if (flat.length > 1 + mids.length) last = flat[1 + mids.length];
      else if (mids.length) last = mids.pop();
      else last = flat[0];
      push(flat[0], intro);
      mids.forEach(pk => push(pk, unit));
      push(last, Math.max(outro, Math.min(target - t, outro + unit)));
      const total = t, lastStart = total - segments[segments.length - 1].len;
      const plan = { T: 0, total, segments, transitions: [], cuts: [], intro: { a: 0, b: intro }, outro: { a: lastStart, b: total } };
      const tmp = await B.newJobDir();
      try {
        // Fotos y logo
        for (const m of media) if (m.kind === 'image' && !m.still) {
          const key = E.hash(JSON.stringify([m.path, m.clip.mtime, W, H, p.enhance, p.style]));
          m.still = B.join(this.cache, `foto_${key}.jpg`);
          if (!(await B.exists(m.still))) await this.makeStill(m.clip, W, H, m.still);
        }
        const logoKey = SA.logo ? E.hash(SA.logo.src || 'logo') : 'texto';
        const wmPaths = await this.wmFiles(W, H, logoKey);
        segments.forEach(sg => { sg.wm = this.wmFor(media[sg.m].clip, W, H, wmPaths); });
        // Capas: título, nombres de los momentos y créditos
        const th = Object.assign({ key: p.theme || 'dorado', shadow: p.shadow || 'auto' }, SA.cards.THEMES[p.theme || 'dorado']);
        const data = { title: p.name, subtitle: kind === 'reel' ? '' : 'Lo mejor de la fiesta', date: SA.ui.parseDate(p.date), place: p.place };
        const layers = [];
        const design = kind === 'reel' ? SA.TPL_DESIGNS.impactoIn : SA.TPL_DESIGNS.cineIn;
        const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d');
        const N = Math.ceil((intro + .3) * E.FPS) + 2;
        for (let f = 0; f < N; f++) {
          if (this.cancelled) return null;
          cx.clearRect(0, 0, W, H); cx.save(); SA.anim.draw(design, cx, W, H, f / E.FPS, intro, data, th); cx.restore();
          await this.writeCanvas(c, B.join(tmp, `titulo_${String(f).padStart(4, '0')}.png`));
          if (f % 10 === 0) this.setProgress(.32, `${prefix}Preparando el título`);
        }
        layers.push({ path: B.join(tmp, 'titulo_%04d.png'), seq: true, a: 0, b: intro + .3, fout: .5 });
        for (let i = 0; i < momentAt.length; i++) {
          const ma = momentAt[i]; if (ma.t < intro - .1 || Math.min(total - outro, ma.t + 3) - (ma.t + .2) < 1.2) continue;
          cx.clearRect(0, 0, W, H); this.momentLabel(cx, W, H, ma.name, th);
          const path = B.join(tmp, `momento_${i}.png`); await this.writeCanvas(c, path);
          layers.push({ path, a: ma.t + .2, b: Math.min(total - outro, ma.t + 3), fin: .35, fout: .45 });
        }
        cx.clearRect(0, 0, W, H); cx.drawImage(SA.cards.renderFilmCard('creditos', W, H, data, p.theme || 'dorado'), 0, 0);
        const cred = B.join(tmp, 'creditos.png'); await this.writeCanvas(c, cred);
        layers.push({ path: cred, a: lastStart + .6, b: total, fin: 1 });
        // FFmpeg
        const look = (p.enhance ? ',eq=contrast=1.05:saturation=1.10' : '') + E.videoColor(false, p.style);
        const out = await B.freeName(p.dir, `${kind === 'reel' ? 'Reel' : 'Resumen'} ${B.safeName(p.name)}`, 'mp4');
        const job = E.tplJob({ plan, media, tmp, sep, W, H, look, fit: kind === 'reel' ? h.fit : 'auto', zoom: .06, hwaccel: true, wmFor: sg => sg.wm, layers,
          post: kind === 'resumen' ? 'vignette=angle=PI/5' : '', audio: { path: song.path, start }, encoderArgs: E.ENCODERS[this.encoder], out });
        const tot = job.steps.reduce((s, x) => s + x.weight, 0);
        let done = 0;
        const base = .34 + .66 * idx / of, span = .66 / of;
        for (const step of job.steps) {
          if (this.cancelled) return null;
          const label = prefix + (step.stage === 'toma' ? `toma ${step.n} de ${step.of}` : step.stage === 'grupo' ? `uniendo parte ${step.n} de ${step.of}` : 'terminando');
          const onT = tt => this.setProgress(base + span * (done + Math.min(1, tt / step.seconds) * step.weight) / tot, label);
          onT(0);
          let r = await B.run('ffmpeg', step.args, onT);
          if (this.cancelled) return null;
          if (r.code !== 0 && step.args.includes('-hwaccel')) r = await B.run('ffmpeg', step.args.filter((x, i, arr) => x !== '-hwaccel' && arr[i - 1] !== '-hwaccel'), onT);
          if (r.code !== 0 && step.final && this.encoder !== E.cpuEncoder(this.encoder)) { this.encoder = E.cpuEncoder(this.encoder); r = await B.run('ffmpeg', E.tplFinalArgs(Object.assign({}, step.finalOpts, { encoderArgs: E.ENCODERS[this.encoder] })), onT); }
          if (this.cancelled) return null;
          if (r.code !== 0) {
            const who = step.media != null ? media[step.media].name : null;
            throw Object.assign(new Error(who ? `No se pudo usar la toma «${who}». Quítala ("No usar esta toma") y vuelve a crear.` : 'FFmpeg no pudo terminar el video. Revisa que haya espacio en el disco.'), { detail: r.stderr });
          }
          done += step.weight;
        }
        return out;
      } finally { B.removeJobDir(tmp); }
    }
    // Nombre del momento abajo a la izquierda ("El vals"), como en las películas de evento.
    momentLabel(ctx, W, H, name, th) { SA.withShadow(th && th.shadow, () => this.momentLabel0(ctx, W, H, name, th)); }
    momentLabel0(ctx, W, H, name, th) {
      const u = Math.min(W, H) / 1080, x = 80 * u, y = H - 110 * u, A = SA.anim;
      const g = ctx.createLinearGradient(0, H * .6, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
      ctx.fillStyle = g; ctx.fillRect(0, H * .6, W * .7, H * .4);
      ctx.fillStyle = th.accent; ctx.fillRect(x, y - 58 * u, 70 * u, 3 * u);
      A.text(ctx, name, x, y, { s: 76 * u, f: A.F.script, color: th.text, align: 'left', shadow: 14 * u, maxW: W * .6 });
    }

    /* ================= Resumen y creación ================= */
    units(forReal) {
      const p = this.p, units = [];
      const data = { title: p.name, date: SA.ui.parseDate(p.date), place: p.place };
      units.push({ name: 'Portada', chapter: p.name, card: { kind: 'portada', data, len: 6 }, clips: [], music: p.music });
      let n = 0;
      p.moments.forEach(m => {
        const cs = m.clips.map(id => p.clips[id]).filter(c => c && c.ready && !c.excluded);
        if (!cs.length) return;
        n++;
        units.push({ name: m.name, chapter: m.name, card: m.title ? { kind: 'capitulo', data: { num: n, name: m.name }, len: 3.5 } : null, clips: cs, moment: m, music: m.music });
      });
      units.push({ name: 'Créditos', chapter: 'Créditos', card: { kind: 'creditos', data, len: 6 }, clips: [], music: p.music });
      return units;
    }
    // Duración de la película: cada toma (sin partes quitadas) menos lo que se encima en cada transición.
    filmLen(units) {
      units = units || this.units();
      let total = 0;
      units.forEach(u => {
        const T = this.moodOf(u.moment || { key: 'portada' }).T;
        const parts = [];
        if (u.card) parts.push({ len: u.card.len, card: true });
        u.clips.forEach(c => {
          const sp = c.speed || 1, tr = c.trans || (u.moment && u.moment.trans) || null;
          if (c.kind === 'image') parts.push({ len: c.len || 4, tr });
          else E.keptRanges(c).forEach((r, k) => parts.push({ len: (r[1] - r[0]) / sp, tr: k ? null : tr, join: k > 0 }));
        });
        parts.forEach((x, i) => {
          total += x.len;
          if (!i) return;
          const prev = parts[i - 1];
          let d = x.join ? Math.min(T, .3) : x.tr && x.tr.type && x.tr.type !== 'auto' ? (x.tr.type === 'corte' ? 0 : (x.tr.dur || T || .8)) : T;
          total -= Math.min(d, Math.min(prev.len, x.len) * .45);
        });
      });
      return total;
    }
    summary() {
      const el = this.q('summary'); if (!this.p || !el) return;
      const units = this.units();
      const moments = units.length - 2;
      let clips = 0;
      units.forEach(u => { clips += u.clips.length; });
      const total = this.filmLen(units);
      const tl = this.q('tbLen'); if (tl) tl.textContent = moments ? `Película: ${fmt(total)}` : '';
      const un = this.unassigned().length;
      const outs = this.p.outputs || ['pelicula'], h = this.hl();
      const hs = h.music || this.p.music, avail = hs ? Math.max(15, hs.duration - (hs.start || 0)) : h.res;
      const extra = [outs.includes('resumen') && `resumen de ${fmt(Math.min(h.res, avail))}${avail < h.res ? ' (lo que dura la canción)' : ''}`, outs.includes('reel') && `reel de ${Math.round(Math.min(h.reel, avail))} s`].filter(Boolean);
      el.innerHTML = moments ? (outs.includes('pelicula') ? `Película: <strong>${fmt(total)}</strong> · ${moments} ${moments === 1 ? 'capítulo' : 'capítulos'} · ${clips} tomas` : `${moments} ${moments === 1 ? 'momento' : 'momentos'} · ${clips} tomas`) +
        (extra.length ? `<br>Además: ${extra.join(' y ')}${(h.music || this.p.music) ? '' : ' (<strong>falta elegir la canción</strong>)'}` : '') +
        (un ? `<br><strong>${un} tomas sin acomodar</strong> no van en la película.` : '') + `<br>Se guarda en ${esc(this.shown(this.p.dir))}`
        : 'Manda tomas a por lo menos un momento para crear la película.';
    }
    setProgress(frac, label) {
      frac = Math.max(0, Math.min(1, frac));
      this.q('bar').style.width = (frac * 100).toFixed(1) + '%';
      this.q('progText').textContent = `${label} · ${Math.floor(frac * 100)} %`;
      const el = (performance.now() - this.t0) / 1000, left = frac > .03 ? el * (1 - frac) / frac : null;
      this.q('progSub').textContent = (left != null ? `Faltan unos ${fmt(left)} · ` : 'Calculando el tiempo… · ') + `usando ${E.ENCODER_NAMES[this.encoder] || 'el procesador'}`;
    }
    act_cancel() { if (!this.busy) return; this.cancelled = true; this.q('progText').textContent = 'Pausando…'; B.cancel(); }
    act_watch() { this.lastOut && B.open(this.lastOut); }
    act_openDir() { this.lastOut && B.open(this.lastOut, true); }

    async writeCanvas(c, path) {
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
      await B.writeBlob(path, blob);
    }
    async makeStill(c, W, H, out) {
      const bmp = await createImageBitmap(await B.readBlob(c.path));
      const SW = Math.round(W * .75) * 2, SH = Math.round(H * .75) * 2;
      const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high';
      if ((H > W) === (bmp.height > bmp.width)) C.drawFit(ctx, bmp, SW, SH, 'cover');
      else { ctx.filter = 'blur(48px) brightness(.8)'; C.drawFit(ctx, bmp, SW, SH, 'cover', 1.15); ctx.filter = 'none'; C.drawFit(ctx, bmp, SW, SH, 'contain'); }
      const stats = C.computeStats(C.downscale(bmp, 480)); bmp.close && bmp.close();
      C.colorCanvas(ctx, SW, SH, stats, { auto: this.p.enhance, style: this.p.style });
      const blob = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('jpg')), 'image/jpeg', .92));
      cv.width = cv.height = 0;
      await B.writeBlob(out, blob);
    }

    // Logo negro y blanco para un tamaño de video (archivos que se reusan).
    async wmFiles(W, H, logoKey) {
      const out = {};
      if (!S.wm) return out;
      for (const v of ['negro', 'blanco', 'original']) {
        if (v === 'original' && !SA.logos.original) continue;
        const key = E.hash(JSON.stringify([S.pos, S.size, S.alpha, logoKey, W, H, v]));
        const path = B.join(this.cache, `marca_${v}_${key}.png`);
        if (!(await B.exists(path))) {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          SA.drawWatermark(c.getContext('2d'), W, H, S, SA.VIDEO_WM_SCALE, v);
          await this.writeCanvas(c, path);
        }
        out[v] = path;
      }
      return out;
    }
    wmFor(c, W, H, paths, fit) {
      if (!S.wm || !paths.blanco) return null;
      if (S.wmColor && S.wmColor !== 'auto') return paths[S.wmColor] || paths.blanco;
      const rt = this.rt[c.id] || {};
      const luma = rt.thumb ? SA.wmZoneLuma(rt.thumb, W, H, S, SA.VIDEO_WM_SCALE) : 90;
      return paths[SA.wmVariantFor(luma)];
    }

    async act_create() {
      if (this.busy || !this.p) return;
      const outs = this.p.outputs || ['pelicula'];
      if (!outs.includes('pelicula')) return this.createHighlights(outs);
      if (this.pumping) { toast('Espera a que termine la revisión del material.'); return; }
      const units = this.units();
      if (units.length <= 2) { toast('Manda tomas a por lo menos un momento.'); return; }
      this.flush(); await this.saveNow();
      this.stopVideo(); this.stopAudio();
      this.busy = true; this.cancelled = false; this.t0 = performance.now();
      const create = this.q('create'); create.disabled = true; create.textContent = 'Creando…';
      this.q('progress').hidden = false; this.q('done').hidden = true;
      this.q('progress').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      this.setProgress(0, 'Revisando la computadora');
      let chain = null;
      try {
        this.encoder = await B.detectEncoder(S.codec);
        const cpu = E.cpuEncoder(this.encoder);
        let interGpu = this.encoder !== cpu, out = null;
        for (let attempt = 0; attempt < 3 && !out && !this.cancelled; attempt++) {
          try { out = await this.render(units, interGpu); }
          catch (e) {
            if (e.retryCpu && (interGpu || this.encoder !== cpu)) { interGpu = false; this.encoder = cpu; continue; }
            throw e;
          }
        }
        if (this.cancelled) toast('Película en pausa. Al tocar "Crear película" otra vez, sigue donde se quedó.', 7000);
        else if (out) {
          this.lastOut = out; this.q('done').hidden = false;
          this.q('done').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          const mins = (performance.now() - this.t0) / 60000;
          toast(`La película quedó lista en ${mins < 1 ? 'menos de un minuto' : Math.round(mins) + ' min'}.`, 8000);
          chain = outs.filter(o => o !== 'pelicula');
        }
      } catch (e) {
        if (!this.cancelled) SA.showError(e.message || 'No se pudo crear la película.', e.detail || String(e && e.stack || e));
      } finally {
        this.busy = false; create.disabled = false; this.q('progress').hidden = true; this.syncOutputs();
      }
      if (chain && chain.length && !this.cancelled) await this.createHighlights(chain, true);
    }

    async render(units, interGpu) {
      const Q = QUALITY[this.p.quality || '1080'] || QUALITY['1080'];
      const W = Q.W, H = Q.H, cache = this.cache, p = this.p, sep = B.paths.sep;
      const theme = p.theme || 'dorado', th = Object.assign({ key: theme, shadow: p.shadow || 'auto' }, SA.cards.THEMES[theme]);
      // Letrero de una toma ("Los padrinos"), con el estilo de los nombres de los momentos.
      const labelFor = async text => {
        if (!text) return '';
        const path = B.join(cache, `letrero_${E.hash(JSON.stringify([text, theme, W, H, 1].concat(th.shadow !== 'auto' ? [th.shadow] : [])))}.png`);
        if (!(await B.exists(path))) {
          const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
          this.momentLabel(cv.getContext('2d'), W, H, text, th);
          await this.writeCanvas(cv, path);
        }
        return path;
      };
      // 1. Tarjetas, fotos y marca de agua (se reusan si no cambiaron)
      const logoKey = SA.logo ? E.hash(SA.logo.src || 'logo') : 'texto';
      const wmPaths = await this.wmFiles(W, H, logoKey);
      const wmOf = c => this.wmFor(c, W, H, wmPaths);
      const prepared = [];
      for (const u of units) {
        const segs = [];
        if (u.card) {
          const key = E.hash(JSON.stringify([u.card, theme, logoKey, W, H, 2]));
          const path = B.join(cache, `tarjeta_${key}.png`);
          if (!(await B.exists(path))) await this.writeCanvas(SA.cards.renderFilmCard(u.card.kind, W, H, u.card.data, theme), path);
          segs.push({ kind: 'card', still: path, len: u.card.len });
        }
        let zoom = 0;
        for (const c of u.clips) {
          if (c.kind === 'image') {
            const key = E.hash(JSON.stringify([c.path, c.mtime, W, H, p.enhance, p.style]));
            const still = B.join(cache, `foto_${key}.jpg`);
            if (!(await B.exists(still))) {
              if (this.cancelled) return null;
              this.setProgress(0, `Preparando la foto ${c.name}`);
              await this.makeStill(c, W, H, still);
            }
            segs.push({ kind: 'image', still, len: c.len || 4, zoomIn: zoom++ % 2 === 0, wm: u.moment ? wmOf(c) : null,
              trans: c.trans || (u.moment && u.moment.trans) || null, label: await labelFor(c.label) });
          } else {
            const vol = (c.mute ? 0 : c.vol) * (u.moment ? u.moment.vol : 1), sp = c.speed || 1;
            const tr = c.trans || (u.moment && u.moment.trans) || null, label = await labelFor(c.label);
            // Una toma con partes quitadas se arma con sus pedazos, unidos con un fundido muy corto.
            const pips = this.pipWindows(c);
            E.keptRanges(c).forEach((r, k) => segs.push({ kind: 'video', path: c.path, in: r[0], len: (r[1] - r[0]) / sp, w: c.w, h: c.h, hasAudio: c.hasAudio && vol > 0.001, vol,
              name: c.name, id: c.id, wm: u.moment ? wmOf(c) : null, speed: sp, rot: c.rot || 0, zoom: c.zoom || 1, color: c.color || null, stab: !!c.stab,
              label: k ? '' : label, trans: k ? null : tr, join: k > 0, pip: pips[k] || null }));
          }
        }
        prepared.push({ name: u.name, chapter: u.chapter, segments: segs, noWatermark: !u.moment, mood: this.moodOf(u.moment || { key: 'portada' }), music: u.music ? { path: u.music.path, start: u.music.start || 0, vol: u.music.vol == null ? .6 : u.music.vol } : null });
      }
      const watermark = null;   // ahora cada toma lleva su propia marca (negra o blanca)
      // 2. Pasos de FFmpeg
      const job = E.filmBuild({ W, H, mood: p.mood, enhance: p.enhance, style: p.style, denoise: p.denoise, hwaccel: true, cache, sep, title: p.name,
        watermark, units: prepared, interArgs: interGpu && E.FILM_INTER_GPU[E.interEncoder(this.encoder)] ? E.FILM_INTER_GPU[E.interEncoder(this.encoder)] : E.FILM_INTER,
        encArgs: E.ENCODERS[this.encoder] });
      const total = job.steps.reduce((s, x) => s + x.weight, 0) + job.total * .25;
      let done = 0;
      for (const st of job.steps) {
        if (this.cancelled) return null;
        if (await B.exists(st.out + '.ok')) { done += st.weight; continue; }
        const label = st.stage === 'toma' ? `${st.unitName}: toma ${st.n} de ${st.of}` : st.stage === 'grupo' ? `${st.unitName}: uniendo parte ${st.n} de ${st.of}` : `${st.unitName}: terminando el capítulo`;
        const onT = t => this.setProgress((done + Math.min(1, t / st.seconds) * st.weight) / total, label);
        onT(0);
        let r = await B.run('ffmpeg', st.args, onT);
        if (this.cancelled) return null;
        if (r.code !== 0 && st.args.includes('-hwaccel')) r = await B.run('ffmpeg', st.args.filter((a, i, arr) => a !== '-hwaccel' && arr[i - 1] !== '-hwaccel'), onT);
        if (this.cancelled) return null;
        if (r.code !== 0) {
          // Si falló con la tarjeta de video, se intenta otra vez con el procesador.
          if (interGpu || (st.stage === 'capitulo' && this.encoder !== E.cpuEncoder(this.encoder))) throw Object.assign(new Error('No se pudo usar la tarjeta de video.'), { retryCpu: true, detail: r.stderr });
          const who = st.seg && st.seg.name;
          throw Object.assign(new Error(who ? `No se pudo usar la toma «${who}» de "${st.unitName}". Puede estar dañada o en un formato poco común. Quítala ("No usar esta toma") y vuelve a crear: lo ya hecho no se repite.`
            : 'FFmpeg no pudo terminar un paso de la película. Revisa que haya espacio en el disco y vuelve a intentar: lo ya hecho no se repite.'), { detail: r.stderr });
        }
        await B.writeText(st.out + '.ok', '');
        done += st.weight;
      }
      // 3. Volumen parejo y archivo final
      await B.writeText(job.listPath, job.list); await B.writeText(job.metaPath, job.meta);
      this.setProgress(done / total, 'Emparejando el volumen de toda la película');
      const meas = await B.run('ffmpeg', E.filmMeasureArgs(job.listPath), null, true);
      if (this.cancelled) return null;
      const measured = E.parseLoudnorm(meas.stderr);
      await B.mkdir(p.dir);
      const out = await B.freeName(p.dir, `Película ${B.safeName(p.name)}`, 'mp4');
      const fin = await B.run('ffmpeg', E.filmFinalArgs(job.listPath, job.metaPath, measured, out, E.isHevc(this.encoder)),
        t => this.setProgress((done + Math.min(1, t / job.total) * job.total * .25) / total, 'Guardando la película'));
      if (this.cancelled) return null;
      if (fin.code !== 0) throw Object.assign(new Error('No se pudo guardar la película final. Revisa que haya espacio en el disco.'), { detail: fin.stderr });
      this.setProgress(1, 'Lista');
      return out;
    }
  }

  SA.Pelicula = Pelicula;
})();
