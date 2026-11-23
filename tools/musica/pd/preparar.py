"""Prepara las grabaciones libres descargadas (out/audio/*.mp3) para el programa.

- Quita silencios del principio y del final y deja el volumen parejo (−16 LUFS, picos de −1.5 dB) sin comprimir la
  dinámica: es música de orquesta y piano grabada por músicos, así que se respeta cómo crece y baja.
- Mide el ritmo con el mismo detector del programa (Engine.detectBeats) y busca la mejor parte (la de más energía
  después de la introducción) para los videos cortos.
- Escribe src-tauri/musica/<id>.mp3 y tools/musica/meta/<id>.json con el crédito y la licencia, y regenera musica-data.js.

Uso: python3 tools/musica/pd/preparar.py [ids...]
"""
import json, os, subprocess, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
AUDIO = os.environ.get('SAUCEDO_PD_AUDIO') or os.path.join(HERE, 'out', 'audio')
META = os.path.join(HERE, '..', 'meta')
DEST = os.path.join(ROOT, 'src-tauri', 'musica')
CATALOGO = json.load(open(os.path.join(HERE, 'catalogo.json'), encoding='utf8'))


def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def loudness(path, chain):
    r = run(['ffmpeg', '-hide_banner', '-i', path, '-af', chain + ',loudnorm=I=-16:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'])
    js = r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1]
    return json.loads(js)


def beats(path, meter):
    """Pulsos con librosa (sigue los cambios de tempo de una orquesta mejor que un detector simple).
    Solo se guardan si el pulso es parejo; en piano con mucho rubato se deja solo el tempo aproximado."""
    import librosa
    y, sr = librosa.load(path, sr=22050, mono=True)
    start = 170 if meter == 3 else 100
    tempo, bt = librosa.beat.beat_track(y=y, sr=sr, units='time', start_bpm=start, tightness=120)
    bt = [round(float(b), 3) for b in bt]
    ibi = np.diff(bt) if len(bt) > 2 else np.array([1.0])
    cv = float(np.std(ibi) / max(1e-6, np.mean(ibi)))
    x = librosa.resample(y, orig_sr=sr, target_sr=11025)
    return float(np.atleast_1d(tempo)[0]), bt, cv, x


def best_part(x, sr, total, beat_list):
    """Inicio de los 30 s con más energía entre el 12 % y el 70 % de la pieza (el tema principal, no el final),
    puesto en el pulso más cercano."""
    hop = sr // 2
    frames = x[:len(x) // hop * hop].reshape(-1, hop).astype(np.float64)
    rms = np.convolve(np.sqrt((frames ** 2).mean(1)), np.ones(60) / 60, mode='valid')
    lo, hi = int(len(rms) * .12), max(int(len(rms) * .12) + 1, int(len(rms) * .7))
    if len(rms) < 5: return 0.0
    t = (lo + int(np.argmax(rms[lo:hi]))) * .5
    if beat_list:
        t = min(beat_list, key=lambda b: abs(b - t))
    return round(float(min(t, max(0, total - 32))), 3)


def main(ids):
    os.makedirs(DEST, exist_ok=True)
    for c in CATALOGO:
        if ids and c['id'] not in ids: continue
        src = os.path.join(AUDIO, c['src'] + '.mp3')
        if not os.path.exists(src):
            print('falta', src); continue
        trim = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.3,areverse'
        m = loudness(src, trim)
        ln = (f"loudnorm=I=-16:TP=-1.5:LRA=20:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
              f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
        fade = ''
        if c.get('cortar'):   # versión más corta: termina con un desvanecido suave
            a, b = c['cortar']
            trim = f"atrim={a}:{b},asetpts=PTS-STARTPTS," + trim
            fade = f",afade=t=out:st={max(0, b - a - 6)}:d=6"
        out = os.path.join(DEST, c['id'] + '.mp3')
        r = run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', trim + ',' + ln + fade + ',aresample=44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '160k', out])
        if r.returncode: print('error', c['id'], r.stderr[-400:]); continue
        dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).stdout)
        tempo, bt, cv, x = beats(out, c.get('meter', 4))
        while tempo > 130 and len(bt) > 16:   # el detector suele contar subdivisiones: se toma uno sí y uno no
            tempo, bt = tempo / 2, bt[::2]
        bl = bt if cv < .12 else []
        bpm = round(tempo) or 90
        hot = best_part(x, 11025, dur, bl or bt)
        meta = {'id': c['id'], 'name': c['name'], 'mood': c['mood'], 'desc': c['desc'], 'tags': c['tags'], 'file': c['id'] + '.mp3',
                'bpm': bpm, 'meter': c.get('meter', 4), 'duration': round(dur, 2), 'hot': hot,
                'sections': [{'name': 'inicio', 't': 0.0}, {'name': 'mejor parte', 't': hot}], 'end': round(dur, 2),
                'real': True, 'credit': c['credit'], 'license': c['license'], 'source': c['source']}
        if len(bl) > 8: meta['beats'] = bl
        json.dump(meta, open(os.path.join(META, c['id'] + '.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        print(f"{c['id']:24} {dur:6.1f} s  {bpm:4} bpm  mejor parte {hot:6.1f} s  pulsos guardados {len(bl)} (variación {cv:.2f})")
    sys.path.insert(0, os.path.join(HERE, '..'))
    import producir
    producir.write_js()


if __name__ == '__main__':
    main(sys.argv[1:])
