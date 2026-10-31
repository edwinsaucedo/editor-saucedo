/* Arranque: pestañas, arrastrar archivos, mensajes de error. */
(function () {
  'use strict';
  const SA = window.SA;
  const { $, $$ } = SA.ui;
  const B = SA.bridge;

  /* Mensaje de error con detalles técnicos plegados */
  SA.showError = (msg, detail) => {
    $('#errMsg').textContent = msg;
    $('#errDetail').textContent = detail || 'Sin detalles.';
    $('#errModal').hidden = false;
    $('#errClose').focus();
  };
  $('#errClose').addEventListener('click', () => { $('#errModal').hidden = true; });
  $('#errCopy').addEventListener('click', async () => {
    const text = `${$('#errMsg').textContent}\n\n${$('#errDetail').textContent}`;
    try { await navigator.clipboard.writeText(text); SA.ui.toast('Detalles copiados. Pégalos en un mensaje para Karen.'); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#errDetail')); getSelection().removeAllRanges(); getSelection().addRange(r); }
  });

  let current = 'fotos';
  const tabs = {};
  function show(name) {
    current = name;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    if (name === 'fotos') SA.photos.refresh();
    else if (name === 'pelicula') { if (tabs.pelicula) tabs.pelicula.renderBoard(); }
    else if (name === 'plantillas' && tabs.plantillas) tabs.plantillas.sizePreview();
    else if (name === 'fotosec' && tabs.fotosec) tabs.fotosec.sizePreview();
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));

  document.addEventListener('keydown', e => {
    if (!$('#errModal').hidden && e.key === 'Escape') { $('#errModal').hidden = true; return; }
    if (e.target && (e.target.id === 'phSplit' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
    if (document.querySelector('.modal:not([hidden])')) return;
    // Atajos de la película (cortar, deshacer, reproducir…), también con el video seleccionado
    if (tabs[current] && tabs[current].onKey && tabs[current].onKey(e)) { e.preventDefault(); return; }
    if (e.target && e.target.tagName === 'VIDEO') return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    if (current === 'fotos') SA.photos.keyNav(dir); else tabs[current] && tabs[current].keyNav(dir);
  });

  async function start() {
    if (!B.available) {
      SA.ui.toast('Esta pantalla es parte del programa Editor Saucedo y no funciona sola en el navegador.', 15000);
    }
    try { await B.init(); } catch (e) { console.error(e); }
    try {
      await Promise.all(['400 20px "SA Script"', '600 20px "SA Serif"', '600 20px "SA Caps"', '700 20px "SA Caps"', '800 20px "SA Caps"', '400 20px "SA Body"', '400 20px "SA VHS"', '300 20px "SA Fina"', '300 20px "SA Garamond"', 'italic 400 20px "SA Garamond"']
        .map(f => document.fonts.load(f)));
    } catch (e) {}
    await SA.loadStoredLogo();
    SA.photos.init();
    tabs.plantillas = new SA.Plantillas($('#view-plantillas'));
    tabs.fotosec = new SA.Fotosecuencia($('#view-fotosec'));
    tabs.pelicula = new SA.Pelicula($('#view-pelicula'));
    if (B.available) tabs.pelicula.tryReopenLast().catch(() => {});
    const overlay = $('#overlay');
    B.onDrop({
      enter: () => { overlay.hidden = false; },
      leave: () => { overlay.hidden = true; },
      drop: paths => {
        overlay.hidden = true;
        if (!paths.length) return;
        if (current === 'fotos') SA.photos.addPaths(paths); else tabs[current].addPaths(paths);
      }
    });
    // Revisa en segundo plano qué tarjeta de video puede usar para exportar más rápido.
    if (B.available) setTimeout(() => B.detectEncoder().catch(() => {}), 1500);
  }
  start();
})();
