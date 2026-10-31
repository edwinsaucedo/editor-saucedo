/* Música incluida: canciones originales del programa (libres para redes), su ritmo exacto
 * y la ventana para elegir música con recomendaciones, como en CapCut. */
(function () {
  'use strict';
  const SA = window.SA, B = SA.bridge;
  const { esc } = SA.ui;
  const M = SA.music = {};
  const fmt = s => window.Engine.fmtTime(s);

  M.list = () => SA.MUSICA || [];
  M.get = id => M.list().find(x => x.id === id) || null;
  M.available = () => !!(B.paths && B.paths.music) && M.list().length > 0;
  M.path = id => { const t = M.get(id); return t && B.paths.music ? B.join(B.paths.music, t.file) : null; };
  M.len = t => t.end || t.duration;
  // Canción lista para usar en una plantilla o película.
  M.song = id => {
    const t = M.get(id); if (!t || !M.available()) return null;
    return { path: M.path(id), name: t.name, duration: M.len(t), start: 0, builtin: id, mood: t.mood, beat: M.beat(id) };
  };
  // El ritmo se conoce de fábrica (la canción se compuso a ese tempo): no hay que analizarla.
  M.beat = id => {
    const t = M.get(id); if (!t) return null;
    // Valses y baladas con rubato: cada tiempo ya viene medido (no están parejos).
    if (t.beats && t.beats.length > 8) {
      const bs = t.beats.filter(x => x <= M.len(t) - .05), df = bs.slice(1).map((x, i) => x - bs[i]).sort((a, b) => a - b);
      const period = df[Math.floor(df.length / 2)];
      return { bpm: 60 / period, period, beats: bs, meter: t.meter || 4 };
    }
    const period = 60 / t.bpm, beats = [];
    for (let x = 0; x < M.len(t) - 0.05; x += period) beats.push(Math.round(x * 1000) / 1000);
    return { bpm: t.bpm, period, beats, meter: t.meter || 4 };
  };
  // Dónde empezar para un video corto: en la parte más pegajosa (el coro), al inicio de un compás.
  M.bestStart = (id, len) => {
    const t = M.get(id); if (!t || !t.hot) return 0;
    const meter = t.meter || 4, bar = 60 / t.bpm * meter;
    let s = t.hot;
    if (s + len > M.len(t) - 2) s = Math.max(0, M.len(t) - 2 - len);
    if (t.beats && t.beats.length > 8) {   // al inicio de un compás, según los tiempos medidos
      let i = 0; while (i + 1 < t.beats.length && t.beats[i + 1] <= s + 1e-3) i++;
      return t.beats[Math.floor(i / meter) * meter] || 0;
    }
    return Math.max(0, Math.floor(s / bar + 1e-6) * bar);
  };
  // Si el programa se instaló en otra carpeta, la ruta guardada se actualiza.
  M.resolve = song => { if (song && song.builtin && M.get(song.builtin)) { song.path = M.path(song.builtin); song.beat = M.beat(song.builtin); } return song; };
  M.label = song => song ? (song.builtin ? `${song.name}` : song.name) : 'Sin música';
  M.sub = song => song ? [song.builtin ? (M.get(song.builtin) || {}).mood : null, song.builtin ? 'música incluida' : 'de tu computadora', fmt(song.duration)].filter(Boolean).join(' · ') : '';

  /* ---------- Escuchar ---------- */
  let audio = null, playingId = null, stopT = 0, onStop = null;
  M.stop = () => {
    clearTimeout(stopT);
    if (audio) { audio.pause(); }
    const was = playingId; playingId = null;
    if (onStop) { const f = onStop; onStop = null; f(was); }
  };
  M.play = async (song, from, cb) => {
    M.stop();
    try {
      audio = audio || new Audio();
      let src;
      try { src = await B.previewSrc(song.path); } catch (e) { src = URL.createObjectURL(await B.readBlob(song.path, 'audio/mpeg')); }
      audio.src = src; audio.volume = 0.9;
      await new Promise((res, rej) => { audio.onloadedmetadata = res; audio.onerror = () => rej(new Error('audio')); });
      audio.currentTime = from || 0;
      await audio.play();
      playingId = song.builtin || song.path; onStop = cb || null;
      stopT = setTimeout(M.stop, 25000);
      audio.onended = M.stop;
      return true;
    } catch (e) { SA.ui.toast('No se pudo reproducir aquí, pero sí se usará en el video.'); return false; }
  };
  M.playing = () => playingId;
  M.progress = () => audio && !audio.paused ? audio.currentTime : null;

  /* ---------- Ventana para elegir ---------- */
  // opts: { title, forName, suggest:[ids], current: song, allowNone, noneLabel } → { kind:'builtin', id } | { kind:'file', path } | { kind:'none' } | null
  M.pick = (opts = {}) => new Promise(resolve => {
    const all = M.list(), sug = (opts.suggest || []).filter(id => M.get(id));
    const cur = opts.current && opts.current.builtin;
    const others = all.filter(t => !sug.includes(t.id));
    const row = (t, i, rec) => `<div class="mrow${cur === t.id ? ' on' : ''}" data-id="${t.id}">
        <button class="mplay" type="button" data-mact="play" aria-label="Escuchar ${esc(t.name)}"><span class="ic">▶</span></button>
        <div class="minfo"><div class="mname">${esc(t.name)}${rec && i === 0 ? '<span class="mstar">Recomendada</span>' : ''}</div>
          <div class="mdesc"><span class="mmood">${esc(t.mood)}</span> · ${fmt(M.len(t))} · ${esc(t.desc)}</div><i class="mbar"><b></b></i></div>
        <button class="${cur === t.id ? 'btn' : 'primary small'}" type="button" data-mact="use">${cur === t.id ? 'En uso ✓' : 'Usar'}</button></div>`;
    const wrap = document.createElement('div');
    wrap.className = 'modal mpick'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'mpTitle');
    wrap.innerHTML = `<div class="modal-card">
      <div class="mp-head"><h2 id="mpTitle">${esc(opts.title || 'Elige la música')}</h2><button class="mp-x" type="button" data-mact="close" aria-label="Cerrar">×</button></div>
      <p class="hint">Toca ▶ para escuchar la mejor parte. Es música original del programa: puedes subir los videos a Facebook, Instagram, TikTok y YouTube sin problemas de derechos.</p>
      ${sug.length ? `<h3 class="mp-h">Recomendadas${opts.forName ? ` para «${esc(opts.forName)}»` : ''}</h3><div class="mlist">${sug.map((id, i) => row(M.get(id), i, true)).join('')}</div>` : ''}
      <h3 class="mp-h">${sug.length ? 'Más música incluida' : 'Música incluida'}</h3>
      <div class="mlist">${others.map((t, i) => row(t, i, false)).join('')}</div>
      <div class="mp-foot"><button class="btn" type="button" data-mact="file">Usar una canción de mi computadora…</button>
        ${opts.allowNone ? `<button class="link" type="button" data-mact="none">${esc(opts.noneLabel || 'Sin música')}</button>` : ''}</div>
    </div>`;
    document.body.appendChild(wrap);
    const done = val => { M.stop(); cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); wrap.remove(); resolve(val); };
    const onKey = e => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    let raf = 0;
    const tick = () => {
      const id = M.playing(), t = id && M.get(id);
      wrap.querySelectorAll('.mrow').forEach(r => {
        const on = r.dataset.id === id;
        r.classList.toggle('playing', on);
        r.querySelector('.ic').textContent = on ? '■' : '▶';
        const bar = r.querySelector('.mbar b');
        if (on && t) { const p = M.progress(); bar.style.width = p == null ? '0' : Math.min(100, (p / M.len(t)) * 100).toFixed(1) + '%'; } else bar.style.width = '0';
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    wrap.addEventListener('click', async e => {
      if (e.target === wrap) { done(null); return; }
      const b = e.target.closest('[data-mact]'); if (!b) return;
      const act = b.dataset.mact, r = b.closest('.mrow'), id = r && r.dataset.id;
      if (act === 'close') done(null);
      else if (act === 'none') done({ kind: 'none' });
      else if (act === 'use') done({ kind: 'builtin', id });
      else if (act === 'play') {
        if (M.playing() === id) { M.stop(); return; }
        const s = M.song(id); if (s) M.play(s, M.bestStart(id, 25));
      } else if (act === 'file') {
        M.stop();
        const p = await B.pick('audio', false);
        if (p && p.length) done({ kind: 'file', path: p[0] });
      }
    });
    const first = wrap.querySelector('[data-mact="use"]'); if (first) first.focus();
  });

  // Sugerencias por momento de la película.
  M.forMoment = key => ({
    llegada: ['nuestro-momento', 'domingo-feliz', 'brillar'], ceremonia: ['promesa', 'para-siempre', 'eternamente'],
    entrada: ['vals-de-las-rosas', 'eternamente', 'nuestra-historia'], vals: ['vals-de-la-luna', 'vals-de-quince', 'vals-de-las-rosas'],
    brindis: ['primer-baile', 'para-siempre', 'nuestro-momento'], sorpresa: ['noche-de-neon', 'impacto', 'dia-de-fiesta'],
    fiesta: ['fiesta-en-el-pueblo', 'dia-de-fiesta', 'noche-de-neon'], despedida: ['eternamente', 'promesa', 'para-siempre'],
  }[key] || ['primer-baile', 'para-siempre', 'eternamente']);
})();
