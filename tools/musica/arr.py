"""Ayudantes de arreglo: arpegios, colchones de cuerdas, bajos, acordes rítmicos y pedal."""
from lib import Chord, pitch, drums, fill, snare_roll  # noqa: F401 (se reexportan)


def at(chords, start):
    """Desplaza una progresión [(beat, dur, Chord)] para que empiece en start."""
    return [(start + b, d, c) for b, d, c in chords]


def tr_chords(chords, k):
    return [(b, d, c.transpose(k)) for b, d, c in chords]


def bass_note(c, low=34, high=46):
    p = c.near(c.bass, low)
    return p if p <= high else p - 12


def pedal(song, tr, chords, lift=0.04):
    for b, d, c in chords:
        song.cc(tr, b + 0.01, 64, 127)
        song.cc(tr, b + d - lift, 64, 0)


def arp(song, tr, chords, pattern=(0, 1, 2, 3, 4, 3, 2, 1), step=0.5, vel=60, bass=(34, 46), span=26, accent=8,
        skip_bass=False, gate=1.6):
    """Arpegio de balada: bajo + notas del acorde hacia arriba."""
    for b, d, c in chords:
        bn = bass_note(c, *bass)
        tones = [bn] + c.stack(bn + 5, bn + span)
        n = int(round(d / step))
        for i in range(n):
            idx = pattern[i % len(pattern)]
            if skip_bass and idx == 0:
                continue
            p = tones[min(idx, len(tones) - 1)]
            v = vel + (accent if i % len(pattern) == 0 else 0) - (4 if i % 2 else 0)
            song.note(tr, b + i * step, step * gate, p, v)


def pad(song, tr, chords, low=55, high=76, n=4, vel=60, prev=None, gap=0.02, top=None):
    """Acordes sostenidos con buena conducción de voces."""
    for b, d, c in chords:
        v = c.voicing(low, high, n, prev, top=top)
        for p in v:
            song.note(tr, b, d - gap, p, vel)
        prev = v
    return prev


def roots(song, tr, chords, low=36, high=50, vel=70, rhythm=None, octave=False, fifth=False):
    """Bajo: nota grave del acorde. rhythm = [(offset, dur, rel)] con rel 0=raíz, 7=quinta, 12=octava."""
    for b, d, c in chords:
        r = c.near(c.bass, low)
        if r > high:
            r -= 12
        if rhythm is None:
            song.note(tr, b, d - 0.03, r, vel)
            if octave:
                song.note(tr, b, d - 0.03, r + 12, vel - 12)
            continue
        for off, dur, rel in rhythm:
            if off >= d - 1e-6:
                continue
            if rel == 'n':  # nota de paso hacia el siguiente acorde
                continue
            song.note(tr, b + off, min(dur, d - off) - 0.02, r + rel, vel + (6 if off == 0 else 0))


def walk(song, tr, chords, low=36, vel=72):
    """Bajo caminante sencillo (negras: raíz, 3a/5a, aproximación cromática)."""
    for i, (b, d, c) in enumerate(chords):
        r = c.near(c.bass, low)
        nxt = chords[i + 1][2] if i + 1 < len(chords) else c
        nr = nxt.near(nxt.bass, low)
        beats = int(round(d))
        third = r + (3 if c.minor else 4)
        line = [r, third, r + 7, nr - 1 if nr > r else nr + 1][:beats] if beats >= 4 else [r, r + 7, nr - 1][:beats]
        for k, p in enumerate(line):
            song.note(tr, b + k, 0.95, p, vel + (8 if k == 0 else 0))


def comp(song, tr, chords, rhythm, low=55, high=74, n=4, vel=70, prev=None, top=None):
    """Acordes rítmicos: rhythm = [(offset, dur, accent)]."""
    for b, d, c in chords:
        v = c.voicing(low, high, n, prev, top=top)
        for off, dur, acc in rhythm:
            if off >= d - 1e-6:
                continue
            for p in v:
                song.note(tr, b + off, min(dur, d - off), p, vel + acc)
        prev = v
    return prev


def strum(song, tr, chords, pattern, low=52, high=76, vel=78, spread=0.012, prev=None):
    """Rasgueo de guitarra: pattern = 'D.DU.UDU' en octavos (D abajo, U arriba)."""
    for b, d, c in chords:
        v = c.voicing(low, high, 5 if len(c.pcs) >= 3 else 4, prev)
        v = sorted(set(v + [c.near(c.bass, low - 5)]))
        steps = len(pattern)
        unit = song.meter / steps
        for i, ch in enumerate(pattern):
            off = i * unit
            if off >= d - 1e-6 or ch not in 'DUdu':
                continue
            notes = v if ch in 'Dd' else list(reversed(v[1:]))
            acc = 10 if ch == 'D' else (-4 if ch == 'U' else -14)
            for k, p in enumerate(notes):
                song.note(tr, b + off + k * spread, unit * 1.6, p, vel + acc - k)
        prev = v
    return prev


def melody(song, tr, notes, start, vel=80, octave_double=None, accent_long=6, transpose=0):
    for b, d, p in notes:
        if p is None:
            continue
        v = vel + (accent_long if d >= 1.5 else 0) - (6 if d <= 0.25 else 0)
        song.note(tr, start + b, d, p + transpose, v)
        if octave_double:
            song.note(tr, start + b, d, p + transpose + octave_double, v - 16)


def counter(song, tr, chords, start_pitch, low=62, high=79, vel=58, per_bar=2):
    """Línea secundaria lenta: notas del acorde que se mueven por grado conjunto."""
    p = pitch(start_pitch)
    down = True
    for b, d, c in chords:
        k = max(1, int(round(per_bar * d / song.meter)))
        for i in range(k):
            cands = [x for x in c.stack(low, high) if x != p] or [p]
            if down:
                below = [x for x in cands if x < p]
                p = max(below) if below else min(cands, key=lambda x: abs(x - p))
            else:
                above = [x for x in cands if x > p]
                p = min(above) if above else min(cands, key=lambda x: abs(x - p))
            if p <= low + 3:
                down = False
            if p >= high - 3:
                down = True
            song.note(tr, b + i * d / k, d / k - 0.03, p, vel)


def roll(song, tr, beat, beats, p, v0=40, v1=100, rate=6):
    """Redoble de timbal (rate golpes por tiempo) con crescendo."""
    n = int(beats * rate)
    for i in range(n):
        song.note(tr, beat + i / rate, 1 / rate, p, v0 + (v1 - v0) * i / max(1, n - 1))


def swell(song, tr, beat, beats, a=40, b=120):
    song.ramp(tr, beat, beats, 11, a, b)


def chord_at(chords, beat):
    for b, d, c in chords:
        if b <= beat + 1e-6 < b + d:
            return c
    return chords[-1][2]


SCALE = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10], 'harm': [0, 2, 3, 5, 7, 8, 11]}


def harmonize(song, tr, notes, start, tonic, chords, steps=-2, vel=64, scale='major', alt=None):
    """Segunda voz a una tercera (steps=-2) o sexta (steps=-5) diatónica por debajo."""
    t = tonic % 12
    for b, d, p in notes:
        if p is None:
            continue
        c = chord_at(chords, start + b)
        sc = SCALE[alt(c) if alt else scale]
        pcs = sorted((t + x) % 12 for x in sc)
        rel = (p - t) % 12
        deg = min(range(7), key=lambda i: abs(sc[i] - rel))
        nd = deg + steps
        octs, idx = divmod(nd, 7)
        q = p - rel + sc[idx] + 12 * octs
        song.note(tr, start + b, d, q, vel)


def trap_hats(song, tr, start, bars, note=42, vel=1.0, rng=None, rolls=True):
    """Hi-hats de trap: octavos con ráfagas de semicorcheas y redobles de tresillos."""
    import random as _r
    rng = rng or _r.Random(3)
    for k in range(bars):
        b0 = start + k * song.meter
        t = 0.0
        while t < song.meter - 1e-6:
            beat_pos = t
            choice = rng.random() if rolls else 0
            last = beat_pos >= song.meter - 1 - 1e-6
            if rolls and last and k % 2 == 1:
                n = 6 if choice < .5 else 8
                for i in range(n):
                    song.note(tr, b0 + t + i / n, 1 / n * .8, note, (60 + 40 * i / n) * vel)
                t += 1
            elif rolls and choice < .25:
                for i in range(4):
                    song.note(tr, b0 + t + i * .25, .2, note, (70 + (14 if i == 0 else 0)) * vel)
                t += 1
            else:
                song.note(tr, b0 + t, .4, note, 92 * vel)
                song.note(tr, b0 + t + .5, .4, note, 64 * vel)
                t += 1
