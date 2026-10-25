// Imita window.__TAURI__ para probar la interfaz en un navegador normal (ver mock_server.py).
window.__TAURI__ = {
  core: {
    invoke: async (cmd, args, opts) => {
      const isRaw = args instanceof Uint8Array;
      const r = await fetch('/invoke/' + cmd, { method: 'POST', body: isRaw ? args : JSON.stringify(args || {}),
        headers: Object.assign({}, (opts && opts.headers) || {}) });
      if (!r.ok) throw new Error(await r.text());
      if (cmd === 'read_file') return await r.arrayBuffer();
      return await r.json();
    },
    convertFileSrc: p => '/file?path=' + encodeURIComponent(p)
  },
  event: { listen: async () => () => {} }
};
