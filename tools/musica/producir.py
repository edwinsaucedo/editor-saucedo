"""Produce la música incluida en Editor Saucedo.

Uso:  SAUCEDO_SF2=/ruta/GeneralUser-GS.sf2 python3 producir.py [id ...]
Genera src-tauri/musica/<id>.mp3 y actualiza src/js/musica-data.js con nombre, ánimo, ritmo y secciones.
"""
import importlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'canciones'))
import lib  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src-tauri', 'musica')
WORK = os.environ.get('SAUCEDO_TMP', os.path.join(HERE, '.trabajo'))
META_DIR = os.path.join(HERE, 'meta')


def songs():
    mods = sorted(f[:-3] for f in os.listdir(os.path.join(HERE, 'canciones')) if f.endswith('.py') and not f.startswith('_'))
    return mods


def make(modname):
    mod = importlib.import_module(modname)
    song, warns = mod.build()
    meta = dict(mod.META)
    print(f'♪ {meta["name"]} ({song.bpm} BPM, {song.meter}/4)')
    for w in warns:
        print('  aviso:', w)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(WORK, f'{song.id}.wav')
    info = lib.produce(song, wav, WORK)
    mp3 = os.path.join(OUT, f'{song.id}.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '160k', '-ar', '44100',
                    '-metadata', f'title={meta["name"]}', '-metadata', 'artist=Editor Saucedo',
                    '-metadata', 'comment=Música original incluida en Editor Saucedo. Libre para usar en los videos del negocio.', mp3], check=True)
    hot = song.meta.get('hot')
    meta.update(file=f'{song.id}.mp3', bpm=song.bpm, meter=song.meter, duration=info['duration'],
                hot=round(song.sec(hot), 3) if hot is not None else 0,
                sections=[{'name': n, 't': round(song.sec(b), 3)} for b, n in song.marks],
                end=round(song.sec(song.end_beat), 3) if song.end_beat else info['duration'])
    os.makedirs(META_DIR, exist_ok=True)
    with open(os.path.join(META_DIR, f'{song.id}.json'), 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f'  → {os.path.relpath(mp3, ROOT)} ({os.path.getsize(mp3) / 1e6:.1f} MB)')
    return meta


def write_js():
    metas = []
    for f in sorted(os.listdir(META_DIR)):
        if f.endswith('.json'):
            with open(os.path.join(META_DIR, f), encoding='utf8') as fh:
                metas.append(json.load(fh))
    order = json.load(open(os.path.join(HERE, 'orden.json'), encoding='utf8')) if os.path.exists(os.path.join(HERE, 'orden.json')) else []
    metas.sort(key=lambda m: order.index(m['id']) if m['id'] in order else 99)
    js = ('/* Generado por tools/musica/producir.py: música original incluida (los MP3 están en src-tauri/musica). */\n'
          'window.SA = window.SA || {};\nwindow.SA.MUSICA = ' + json.dumps(metas, ensure_ascii=False, indent=1) + ';\n')
    with open(os.path.join(ROOT, 'src', 'js', 'musica-data.js'), 'w', encoding='utf8') as f:
        f.write(js)
    print(f'musica-data.js: {len(metas)} canciones')


if __name__ == '__main__':
    if not lib.SF2:
        sys.exit('Falta SAUCEDO_SF2 (ruta a GeneralUser-GS.sf2)')
    ids = sys.argv[1:] or songs()
    for m in ids:
        make(m)
    write_js()
