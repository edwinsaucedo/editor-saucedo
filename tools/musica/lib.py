"""Estudio de música de Editor Saucedo.

Compone canciones en MIDI (con ayudantes para acordes, arpegios, baterías y melodías),
las toca con un banco de sonidos (GeneralUser GS, uso comercial permitido), mezcla cada
instrumento por separado (ecualización, reverberación, compresión lateral) y masteriza
a -14 LUFS con limitador. Todo es determinista: la misma semilla da la misma canción.
"""
import json
import math
import os
import random
import subprocess
import tempfile

import mido
import numpy as np
import pyloudnorm
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

SR = 48000
SF2 = os.environ.get('SAUCEDO_SF2', '')

# ----------------------------------------------------------------- notas y acordes
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def pitch(s):
    """'C#4' → 61, 'Bb3' → 58 (C4 = 60). Un número se regresa igual."""
    if isinstance(s, (int, np.integer)):
        return int(s)
    s = s.strip()
    n, i = PC[s[0].upper()], 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1
        i += 1
    return n + 12 * (int(s[i:]) + 1)


QUAL = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
    'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14], 'dim': [0, 3, 6],
    'aug': [0, 4, 8], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '9': [0, 4, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14],
    'm9': [0, 3, 7, 10, 14], '7sus4': [0, 5, 7, 10], 'm7b5': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9],
    '13': [0, 4, 10, 14, 21], '6/9': [0, 4, 7, 9, 14], 'm11': [0, 3, 7, 10, 17], '7b9': [0, 4, 7, 10, 13],
    'maj7#11': [0, 4, 7, 11, 18], '5': [0, 7],
}


class Chord:
    def __init__(self, sym):
        self.sym = sym
        body, bass = sym, None
        if '/' in sym:
            a, b = sym.rsplit('/', 1)
            if b and b[0] in PC:
                body, bass = a, b
        r, i = PC[body[0]], 1
        while i < len(body) and body[i] in '#b':
            r += 1 if body[i] == '#' else -1
            i += 1
        self.root = r % 12
        q = body[i:]
        if q not in QUAL:
            raise ValueError(f'acorde desconocido: {sym}')
        self.ivs = QUAL[q]
        self.minor = 3 in self.ivs and 4 not in self.ivs
        if bass:
            b, j = PC[bass[0]], 1
            while j < len(bass) and bass[j] in '#b':
                b += 1 if bass[j] == '#' else -1
                j += 1
            self.bass = b % 12
        else:
            self.bass = self.root
        self.pcs = sorted(set((self.root + x) % 12 for x in self.ivs))
        # tonos "fuertes" para melodías: los del acorde (las tensiones 9/11/13 se toleran)
        self.tones = set(self.pcs)

    def transpose(self, k):
        c = Chord.__new__(Chord)
        c.__dict__.update(self.__dict__)
        c.root = (self.root + k) % 12
        c.bass = (self.bass + k) % 12
        c.pcs = sorted(set((p + k) % 12 for p in self.pcs))
        c.tones = set(c.pcs)
        c.sym = f'{self.sym}{k:+d}'
        return c

    def near(self, pc, low):
        """Primera nota con esa clase de altura en o arriba de low."""
        return low + ((pc - low) % 12)

    def stack(self, low, high):
        """Todas las notas del acorde entre low y high, de grave a agudo."""
        return [p for p in range(low, high + 1) if p % 12 in self.pcs]

    def voicing(self, low, high, n=4, prev=None, drop5=True, top=None):
        """Acorde en posición cerrada dentro de [low, high], lo más cerca del anterior (conducción de voces)."""
        order = [(self.root + x) % 12 for x in self.ivs]
        uniq = []
        for p in order:
            if p not in uniq:
                uniq.append(p)
        if len(uniq) > n and drop5 and len(uniq) >= 4:
            fifth = (self.root + 7) % 12
            if fifth in uniq and len(uniq) - 1 >= n:
                uniq.remove(fifth)
        uniq = uniq[:max(n, 3)] if len(uniq) > n else uniq
        cands = []
        for inv in range(len(uniq)):
            seq = uniq[inv:] + uniq[:inv]
            for o in range(1, 8):
                start = seq[0] + 12 * o
                v = [start]
                for p in seq[1:]:
                    v.append(v[-1] + ((p - v[-1]) % 12 or 12))
                while len(v) < n:
                    v.append(v[len(v) - len(seq)] + 12)
                if v[0] >= low and v[-1] <= high:
                    cands.append(v)
        if not cands:
            return self.stack(low, high)[:n]
        if top is not None:
            cands.sort(key=lambda v: (abs(v[-1] - top), v[0]))
            return cands[0]
        if prev:
            pc = sum(prev) / len(prev)
            cands.sort(key=lambda v: (sum(min(abs(a - b) for b in prev) for a in v), abs(sum(v) / len(v) - pc)))
        else:
            mid = (low + high) / 2
            cands.sort(key=lambda v: abs(sum(v) / len(v) - mid))
        return cands[0]


def prog(text, meter=4):
    """'Eb | Bb/D | Cm Ab | F:3 C:1' → [(beat, dur, Chord)] (los compases se separan con |)."""
    out, beat = [], 0.0
    for bar in [b.strip() for b in text.split('|')]:
        if not bar:
            continue
        items = bar.split()
        durs = []
        for it in items:
            if ':' in it:
                s, d = it.rsplit(':', 1)
                durs.append((s, float(d)))
            else:
                durs.append((it, None))
        fixed = sum(d for _, d in durs if d)
        free = [s for s, d in durs if d is None]
        each = (meter - fixed) / len(free) if free else 0
        for s, d in durs:
            dd = d if d is not None else each
            out.append((beat, dd, Chord(s)))
            beat += dd
        if abs(sum(d if d is not None else each for _, d in durs) - meter) > 1e-6:
            raise ValueError(f'compás que no suma {meter}: {bar}')
    return out


def mel(text, meter=4, octave_shift=0):
    """'G5:1 F5:.5 r:.5 | ...' → [(beat, dur, pitch|None)]. Revisa que cada compás sume lo correcto."""
    out, beat = [], 0.0
    for bi, bar in enumerate([b.strip() for b in text.split('|')]):
        if not bar:
            continue
        tot = 0.0
        for it in bar.split():
            n, d = it.rsplit(':', 1)
            d = float(d)
            p = None if n in ('r', '-') else pitch(n) + 12 * octave_shift
            out.append((beat + tot, d, p, n == '-'))
            tot += d
        if abs(tot - meter) > 1e-6:
            raise ValueError(f'compás {bi + 1} de la melodía suma {tot}, no {meter}: {bar}')
        beat += meter
    # "-" liga con la nota anterior
    res = []
    for b, d, p, tie in out:
        if tie and res and res[-1][2] is not None:
            pb, pd, pp = res[-1]
            res[-1] = (pb, pd + d, pp)
        else:
            res.append((b, d, p))
    return res


# ----------------------------------------------------------------- canción
class Track:
    def __init__(self, name, program=0, bank=0, drum=False, pan=64, chorus=0, human=(6, 6), legato=1.0, vel_add=0, roll=0.0):
        self.name, self.program, self.bank, self.drum = name, program, bank, drum
        self.vel_add = vel_add
        self.roll = roll   # ms entre notas de un mismo acorde (como una mano que no toca todo exacto)
        self.pan, self.chorus, self.human, self.legato = pan, chorus, human, legato
        self.notes = []   # (beat, dur, pitch, vel)
        self.ccs = []     # (beat, cc, value)
        self.bends = []   # (beat, value -8192..8191)


class Song:
    def __init__(self, sid, bpm, meter=4, seed=1, swing=0.0, swing_unit=0.5):
        self.id, self.bpm, self.meter = sid, bpm, meter
        self.rng = random.Random(seed)
        self.swing, self.swing_unit = swing, swing_unit
        self.tracks = {}
        self.marks = []       # (beat, nombre)
        self.cursor = 0.0     # en tiempos
        self.end_beat = None
        self.kicks = []       # tiempos (beats) del bombo para la compresión lateral
        self.mix = {}         # nombre de pista → ajustes de mezcla
        self.master = {}
        self.meta = {}
        self.tempo = [(0.0, float(bpm))]   # cambios de tempo (rubato): [(tiempo, bpm)]

    # tiempo
    @property
    def spb(self):
        return 60.0 / self.bpm

    def tempo_map(self):
        m = {}
        for b, v in self.tempo:
            m[round(b, 6)] = v
        return sorted(m.items())

    def sec(self, beat):
        """Segundos hasta el tiempo `beat`, con los cambios de tempo."""
        tm = self.tempo_map()
        if len(tm) == 1:
            return beat * 60.0 / tm[0][1]
        t, prev_b, prev_v = 0.0, 0.0, tm[0][1]
        for b, v in tm[1:]:
            if b >= beat:
                break
            t += (b - prev_b) * 60.0 / prev_v
            prev_b, prev_v = b, v
        return t + (beat - prev_b) * 60.0 / prev_v

    def rit(self, beat, beats, to=0.9, back=True, step=0.25):
        """Ritardando: el tempo baja poco a poco hasta `to` × el tempo base (y vuelve al terminar)."""
        n = max(1, int(round(beats / step)))
        for i in range(n):
            f = (i + 1) / n
            self.tempo.append((beat + i * step, self.bpm * (1 + (to - 1) * f * f)))
        if back:
            self.tempo.append((beat + beats, float(self.bpm)))

    def beat_times(self, end_beat=None):
        end = end_beat if end_beat is not None else (self.end_beat or 0)
        return [round(self.sec(b), 3) for b in range(int(end) + 1)]

    def section(self, name, bars):
        b = self.cursor
        self.marks.append((b, name))
        self.cursor += bars * self.meter
        return b

    def bar(self, n):
        return n * self.meter

    # pistas
    def track(self, name, **kw):
        if name not in self.tracks:
            self.tracks[name] = Track(name, **kw)
        return self.tracks[name]

    def note(self, tr, beat, dur, p, vel=80):
        if p is None:
            return
        t = self.tracks[tr] if isinstance(tr, str) else tr
        t.notes.append((float(beat), float(dur), int(pitch(p)), int(max(1, min(127, vel)))))

    def cc(self, tr, beat, num, val):
        t = self.tracks[tr] if isinstance(tr, str) else tr
        t.ccs.append((float(beat), int(num), int(max(0, min(127, val)))))

    def ramp(self, tr, beat, dur, num, a, b, steps=24):
        for i in range(steps + 1):
            self.cc(tr, beat + dur * i / steps, num, a + (b - a) * i / steps)

    # MIDI
    def _swing(self, beat):
        if not self.swing:
            return beat
        u = self.swing_unit
        pos = (beat / u) % 2
        if abs(pos - 1) < 1e-3:
            base = beat - u
            return base + 2 * u * self.swing
        return beat

    def write_midi(self, path, names, tail=4.0):
        tpb = 960
        mf = mido.MidiFile(ticks_per_beat=tpb)
        meta = mido.MidiTrack()
        num = self.meter
        meta.append(mido.MetaMessage('time_signature', numerator=num, denominator=4, time=0))
        now_t = 0
        for b, v in self.tempo_map():
            tick = int(round(b * tpb))
            meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(v), time=tick - now_t))
            now_t = tick
        mf.tracks.append(meta)
        ch_free = [c for c in range(16) if c != 9]
        last = 0.0
        for name in names:
            t = self.tracks[name]
            ch = 9 if t.drum else ch_free.pop(0)
            ev = []
            if not t.drum:
                ev.append((0, 0, mido.Message('control_change', channel=ch, control=0, value=t.bank)))
            ev.append((0, 1, mido.Message('program_change', channel=ch, program=t.program)))
            for num_, val in ((7, 100), (10, t.pan), (91, 0), (93, t.chorus), (11, 127)):
                ev.append((0, 2, mido.Message('control_change', channel=ch, control=num_, value=val)))
            jt, jv = t.human
            # acordes: las notas que empiezan juntas se tocan apenas escalonadas (de grave a agudo)
            offs = {}
            if t.roll:
                groups = {}
                for i, (b, d, p, v) in enumerate(t.notes):
                    groups.setdefault(round(b, 3), []).append((p, i))
                for g in groups.values():
                    if len(g) > 1:
                        for k, (p, i) in enumerate(sorted(g)):
                            offs[i] = (k * t.roll * (0.8 + 0.4 * self.rng.random())) / 1000.0 / self.spb
            for i, (b, d, p, v) in enumerate(t.notes):
                bs = self._swing(b) + offs.get(i, 0.0)
                if jt and b > 0:
                    bs += self.rng.gauss(0, jt / 1000.0) / self.spb
                bs = max(0.0, bs)
                vv = int(max(1, min(127, v + t.vel_add + (self.rng.randint(-jv, jv) if jv else 0))))
                dd = max(0.02, d * t.legato)
                s, e = int(round(bs * tpb)), int(round((bs + dd) * tpb))
                ev.append((s, 4, mido.Message('note_on', channel=ch, note=p, velocity=vv)))
                ev.append((max(e, s + 1), 3, mido.Message('note_off', channel=ch, note=p, velocity=0)))
                last = max(last, bs + dd)
            for b, n, v in t.ccs:
                ev.append((int(round(b * tpb)), 2, mido.Message('control_change', channel=ch, control=n, value=v)))
            for b, v in t.bends:
                ev.append((int(round(b * tpb)), 2, mido.Message('pitchwheel', channel=ch, pitch=v)))
            end = int(round(((self.end_beat or last) + tail / self.spb) * tpb))
            ev.append((end, 5, mido.Message('control_change', channel=ch, control=1, value=0)))
            ev.sort(key=lambda x: (x[0], x[1]))
            tr = mido.MidiTrack()
            now = 0
            for tick, _, msg in ev:
                tr.append(msg.copy(time=tick - now))
                now = tick
            mf.tracks.append(tr)
        mf.save(path)


# ----------------------------------------------------------------- patrones
def drums(song, tr, start, bars, pats, vel=1.0, steps=None, every=None):
    """pats: {nota: 'x...x...'} con 4 pasos por tiempo. X=fuerte x=normal o=suave g=fantasma."""
    st = steps or song.meter * 4
    V = {'X': 118, 'x': 96, 'o': 70, 'g': 42}
    for b in range(bars):
        for note, pat in pats.items():
            pat = pat.replace(' ', '').replace('|', '')
            n = len(pat)
            for i, ch in enumerate(pat):
                if ch in V:
                    beat = start + b * song.meter + i * song.meter / n
                    song.note(tr, beat, song.meter / n * .9, note, V[ch] * vel)
                    if note in (35, 36) and tr.endswith('kick'):
                        song.kicks.append(beat)


def fill(song, tr, beat, kind='toms', vel=1.0, length=1.0):
    """Redoble corto al final de una sección."""
    if kind == 'toms':
        seq = [50, 50, 48, 48, 47, 45, 43, 41]
    elif kind == 'snare':
        seq = [38] * 8
    else:
        seq = kind
    n = len(seq)
    for i, p in enumerate(seq):
        song.note(tr, beat + i * length / n, length / n, p, (70 + 45 * i / n) * vel)


def snare_roll(song, tr, beat, beats, note=38, start_div=2, end_div=8, v0=50, v1=118):
    """Redoble que se acelera (para subidas antes del coro)."""
    t = 0.0
    while t < beats - 1e-6:
        f = t / beats
        div = start_div * (end_div / start_div) ** f
        step = 1.0 / div
        song.note(tr, beat + t, step * .8, note, v0 + (v1 - v0) * f)
        t += step


def humanize_vel(base, i, accent_every=None, accent=10):
    return base + (accent if accent_every and i % accent_every == 0 else 0)


# ----------------------------------------------------------------- mezcla
def render_stem(song, names, wav, sf2=None):
    sf2 = sf2 or SF2
    with tempfile.TemporaryDirectory() as td:
        mid = os.path.join(td, 'x.mid')
        song.write_midi(mid, names)
        cmd = ['fluidsynth', '-ni', '-q', '-g', '0.5', '-r', str(SR), '-O', 'float', '-T', 'wav', '-F', wav,
               '-o', 'synth.reverb.active=0', '-o', 'synth.chorus.active=1',
               '-o', 'synth.chorus.depth=3.6', '-o', 'synth.chorus.level=0.55', '-o', 'synth.chorus.nr=4',
               '-o', 'synth.chorus.speed=0.36', '-o', 'synth.polyphony=1024', '-o', 'synth.midi-bank-select=gs',
               sf2, mid]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        sr, x = wavfile.read(wav)
    assert sr == SR
    x = x.astype(np.float32)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    return x


def sos_hp(f, order=2):
    return butter(order, f, 'highpass', fs=SR, output='sos')


def sos_lp(f, order=2):
    return butter(order, f, 'lowpass', fs=SR, output='sos')


def filt(x, sos):
    return sosfilt(sos, x, axis=0).astype(np.float32)


def shelf(x, f, gain_db, kind='high'):
    """Repisa simple: mezcla la señal con su parte alta (o baja) para subir o bajar."""
    g = 10 ** (gain_db / 20) - 1
    part = filt(x, sos_hp(f, 1) if kind == 'high' else sos_lp(f, 1))
    return (x + g * part).astype(np.float32)


def peak_eq(x, f, gain_db, q=1.0):
    from scipy.signal import iirpeak
    b, a = iirpeak(f, q, fs=SR)
    from scipy.signal import lfilter
    band = lfilter(b, a, x, axis=0)
    return (x + (10 ** (gain_db / 20) - 1) * band).astype(np.float32)


_meter = pyloudnorm.Meter(SR)


def lufs(x):
    try:
        v = _meter.integrated_loudness(x.astype(np.float64))
    except Exception:
        return -70.0
    return v if np.isfinite(v) else -70.0


def reverb_ir(seconds=2.4, predelay=0.02, seed=3, bright=1.0, width=1.0):
    """Respuesta al impulso sintética de sala: ruido con caída exponencial, más rápida en agudos."""
    rng = np.random.default_rng(seed)
    n = int(SR * seconds)
    t = np.arange(n) / SR
    chans = []
    for c in range(2):
        noise = rng.standard_normal(n)
        lo = filt(noise[:, None], sos_lp(600, 2))[:, 0]
        hi = filt(noise[:, None], sos_hp(4000, 2))[:, 0]
        mid = noise - lo - hi
        rt = seconds / 1.2
        env = lambda k: np.exp(-6.9 * t / (rt * k))
        y = lo * env(1.15) + mid * env(1.0) + hi * env(0.55) * bright
        # primeras reflexiones
        for d, a in ((0.007, .5), (0.013, .35), (0.021, .3), (0.029, .22), (0.037, .18)):
            k = int(SR * (d + c * 0.0017))
            if k < n:
                y[k] += a * (1 if (k + c) % 2 else -1) * 8
        fade = np.clip(t / 0.005, 0, 1)
        y *= fade
        chans.append(y)
    L, R = chans
    M, S = (L + R) / 2, (L - R) / 2 * width
    ir = np.stack([M + S, M - S], 1)
    pd = np.zeros((int(SR * predelay), 2))
    ir = np.concatenate([pd, ir])
    ir /= np.sqrt((ir ** 2).sum() / 2)
    return ir.astype(np.float32)


def convolve(x, ir):
    out = np.stack([fftconvolve(x[:, c], ir[:, c]) for c in range(2)], 1)
    return out[:len(x)].astype(np.float32)


def duck_env(n, hits_s, depth_db=-8, attack=0.004, hold=0.02, release=0.18):
    env = np.ones(n, np.float32)
    g = 10 ** (depth_db / 20)
    L = int(SR * (attack + hold + release * 4))
    tt = np.arange(L) / SR
    shape = np.where(tt < attack, 1 - (1 - g) * tt / attack,
                     np.where(tt < attack + hold, g, 1 - (1 - g) * np.exp(-(tt - attack - hold) / release)))
    for h in hits_s:
        s = int(h * SR)
        if s >= n:
            continue
        e = min(n, s + L)
        env[s:e] = np.minimum(env[s:e], shape[:e - s])
    return env


def compress(x, thr_db=-18, ratio=2.0, attack=0.02, release=0.25, knee=6, makeup=0.0):
    """Compresor de bus (detección RMS, rodilla suave)."""
    mono = np.sqrt(np.mean(x.astype(np.float64) ** 2, axis=1) + 1e-12)
    win = int(SR * 0.01)
    k = np.ones(win) / win
    rms = np.sqrt(np.convolve(mono ** 2, k, mode='same') + 1e-12)
    lvl = 20 * np.log10(rms + 1e-9)
    over = lvl - thr_db
    gr = np.where(over <= -knee / 2, 0, np.where(over >= knee / 2, over * (1 - 1 / ratio), (over + knee / 2) ** 2 / (2 * knee) * (1 - 1 / ratio)))
    # suavizado con ataque y liberación
    a_a, a_r = math.exp(-1 / (SR * attack)), math.exp(-1 / (SR * release))
    from scipy.signal import lfilter
    # aproximación: filtrar con el más lento y combinar con el pico de ataque
    sm_r = lfilter([1 - a_r], [1, -a_r], gr)
    sm_a = lfilter([1 - a_a], [1, -a_a], gr)
    sm = np.maximum(sm_r, sm_a)
    gain = 10 ** ((-sm + makeup) / 20)
    return (x * gain[:, None]).astype(np.float32)


def limiter(x, ceiling_db=-1.0, lookahead=0.005, release=0.08):
    c = 10 ** (ceiling_db / 20)
    over = resample_poly(x, 4, 1, axis=0)
    n = len(x)
    pk = np.abs(over[:n * 4]).max(axis=1)
    pk = np.pad(pk, (0, max(0, n * 4 - len(pk)))).reshape(n, 4).max(axis=1)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    la = max(1, int(SR * lookahead))
    from scipy.ndimage import minimum_filter1d
    need = minimum_filter1d(need, size=2 * la + 1)
    need = np.concatenate([need[la:], np.ones(la)])
    # liberación por bloques: mínimo móvil + suavizado exponencial (aprox. de la liberación)
    from scipy.signal import lfilter
    a = math.exp(-1 / (SR * release))
    sm = lfilter([1 - a], [1, -a], need)
    g = np.minimum(need, sm)
    return (x * g[:, None]).astype(np.float32)


def crackle(n, seed=5, density=6.0, level=0.012):
    """Polvo de vinilo + siseo de cinta para el lo-fi."""
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2), np.float32)
    k = rng.poisson(density * n / SR)
    pos = rng.integers(0, n - 200, k)
    for p in pos:
        amp = level * (0.3 + rng.random() * 1.7)
        L = rng.integers(20, 120)
        click = amp * np.exp(-np.arange(L) / (L / 4)) * rng.choice([-1, 1])
        out[p:p + L, rng.integers(0, 2)] += click
        out[p:p + L, :] += click[:, None] * .3
    hiss = rng.standard_normal((n, 2)).astype(np.float32) * level * .18
    hiss = filt(hiss, sos_hp(3000, 1))
    return filt(out, sos_lp(9000, 1)) + hiss


def riser(seconds, level=0.1, seed=9, f0=300, f1=9000):
    """Barrido de ruido que sube (antes de un coro o una caída)."""
    n = int(SR * seconds)
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal((n, 2)).astype(np.float32)
    out = np.zeros_like(noise)
    blocks = 64
    for i in range(blocks):
        a, b = i * n // blocks, (i + 1) * n // blocks
        f = f0 * (f1 / f0) ** (i / blocks)
        lo, hi = max(40, f * .6), min(SR / 2 - 100, f * 1.6)
        sos = butter(2, [lo, hi], 'bandpass', fs=SR, output='sos')
        seg = sosfilt(sos, noise[max(0, a - 2000):b], axis=0)[-(b - a):]
        out[a:b] = seg
    env = (np.linspace(0, 1, n) ** 2)[:, None]
    out = out * env
    out /= np.abs(out).max() + 1e-9
    return (out * level).astype(np.float32)


def impact(level=0.3, seed=4):
    """Golpe grave para las caídas (sub + ruido)."""
    n = int(SR * 2.5)
    t = np.arange(n) / SR
    f = 55 * np.exp(-t * 1.5) + 35
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t * 1.6)
    rng = np.random.default_rng(seed)
    nz = filt(rng.standard_normal((n, 1)).astype(np.float32), sos_lp(2500, 2))[:, 0] * np.exp(-t * 6) * .4
    y = (sub + nz)[:, None] * np.ones((1, 2))
    return (y / np.abs(y).max() * level).astype(np.float32)


def produce(song, out_wav, workdir, sf2=None, verbose=True):
    """Renderiza cada pista, mezcla y masteriza. Regresa metadatos."""
    os.makedirs(workdir, exist_ok=True)
    stems = {}
    groups = song.mix.get('_groups') or {n: [n] for n in song.tracks}
    for gname, names in groups.items():
        names = [n for n in names if song.tracks[n].notes]
        if not names:
            continue
        p = os.path.join(workdir, f'{song.id}_{gname}.wav')
        stems[gname] = render_stem(song, names, p, sf2)
    n = max(len(x) for x in stems.values())
    # recorta la cola al final real + 4 s
    end_s = song.sec(song.end_beat) + song.master.get('tail', 4.0) if song.end_beat else n / SR
    n = min(n, int(end_s * SR))
    buses = {}
    dry = np.zeros((n, 2), np.float32)
    report = []
    for g, x in stems.items():
        x = x[:n] if len(x) >= n else np.pad(x, ((0, n - len(x)), (0, 0)))
        cfg = dict(song.mix.get(g, {}))
        if cfg.get('hp'):
            x = filt(x, sos_hp(cfg['hp'], 2))
        if cfg.get('lp'):
            x = filt(x, sos_lp(cfg['lp'], 2))
        for f, gd, q in cfg.get('peq', []):
            x = peak_eq(x, f, gd, q)
        if cfg.get('air'):
            x = shelf(x, 6000, cfg['air'], 'high')
        if cfg.get('warm'):
            x = shelf(x, 250, cfg['warm'], 'low')
        if cfg.get('sat'):
            x = (np.tanh(x / (np.abs(x).max() + 1e-9) * cfg['sat']) * (np.abs(x).max() + 1e-9)).astype(np.float32)
        if cfg.get('comp'):
            x = compress(x, *cfg['comp'])
        if cfg.get('width') is not None:
            M, S = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2 * cfg['width']
            x = np.stack([M + S, M - S], 1).astype(np.float32)
        L = lufs(x)
        target = cfg.get('lufs', -24)
        gain = 10 ** ((target - L) / 20) if L > -69 else 0
        x = x * gain
        if cfg.get('duck'):
            env = duck_env(n, [song.sec(b) for b in song.kicks], *cfg['duck'])
            x = x * env[:, None]
        dry += x
        for bus, amt in cfg.get('sends', {}).items():
            buses.setdefault(bus, np.zeros((n, 2), np.float32))
            buses[bus] += x * (10 ** (amt / 20))
        report.append(f'{g}: {L:.1f} → {target} LUFS')
    for bus, x in buses.items():
        spec = dict(song.master.get('reverbs', {}).get(bus, {'seconds': 2.4}))
        hp = spec.pop('hp', 180)
        ir = reverb_ir(**spec)
        wet = convolve(filt(x, sos_hp(hp, 2)), ir)
        dry += wet
    mixv = dry
    for extra in song.master.get('extras', []):
        kind = extra[0]
        if kind == 'audio':
            _, at_s, data = extra
            s = int(at_s * SR)
            e = min(n, s + len(data))
            if s < n:
                mixv[s:e] += data[:e - s]
    mc = song.master
    if mc.get('lofi'):
        mixv = filt(mixv, sos_lp(mc['lofi'], 2))
        mixv = np.tanh(mixv * 1.6) / 1.6
        mixv += crackle(n, density=mc.get('crackle', 5.0), level=0.02)
    mixv = filt(mixv, sos_hp(28, 2))
    if mc.get('tone'):
        mixv, cur, corr = tone_match(mixv, mc['tone'], max_db=mc.get('tone_max', 6.0))
        report.append('tono ' + ' '.join(f'{c:+.0f}' for c in corr))
    mixv = compress(mixv, *mc.get('glue', (-16, 1.8, 0.03, 0.3, 6)))
    # sonoridad final: -14 LUFS y picos reales a -1 dB
    target = mc.get('lufs', -14.0)
    for _ in range(3):
        L = lufs(mixv)
        mixv = mixv * 10 ** ((target - L) / 20)
        mixv = limiter(mixv, -1.2)
    L = lufs(mixv)
    # fundido final corto para que no haya clic
    fo = int(SR * 0.05)
    mixv[-fo:] *= np.linspace(1, 0, fo)[:, None]
    wavfile.write(out_wav, SR, mixv.astype(np.float32))
    if verbose:
        print('  ' + ' · '.join(report))
        print(f'  final {L:.1f} LUFS · pico {20 * np.log10(np.abs(mixv).max() + 1e-9):.1f} dBFS · {len(mixv) / SR:.1f} s')
    return {'duration': round(len(mixv) / SR, 2), 'lufs': round(L, 1)}


TONE = {
    # energía por octava relativa a 1 kHz (31 Hz … 16 kHz)
    'balada': [-20, -6, -2, 0, 0, 0, -3, -7, -13, -25],
    'pop': [-9, 2, 2, 0, -1, 0, -2, -4, -8, -17],
    'edm': [-3, 5, 3, 0, -2, 0, -2, -3, -6, -14],
    'lofi': [-14, -2, 0, 1, 1, 0, -4, -9, -18, -34],
    'acustica': [-16, -3, 0, 0, 0, 0, -2, -5, -10, -20],
    'orquesta': [-14, -2, 0, 0, 0, 0, -3, -6, -12, -23],
}
BANDS = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def band_levels(x):
    mono = x.mean(axis=1)
    n = 1 << 15
    w = np.hanning(n)
    acc = np.zeros(n // 2 + 1)
    for i in range(0, max(1, len(mono) - n), n // 2):
        seg = mono[i:i + n]
        if len(seg) < n:
            break
        acc += np.abs(np.fft.rfft(seg * w)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    lv = []
    for c in BANDS:
        m = (f >= c / 1.414) & (f < c * 1.414)
        lv.append(10 * np.log10(acc[m].sum() + 1e-12))
    return np.array(lv) - lv[5]


def tone_match(x, curve, max_db=6.0, amount=0.8):
    """Ecualizador de mastering: acerca el balance tonal a la curva del género (fase lineal)."""
    from scipy.signal import firwin2
    tgt = np.array(TONE[curve] if isinstance(curve, str) else curve, float)
    cur = band_levels(x)
    corr = np.clip((tgt - cur) * amount, -max_db, max_db)
    corr[0] = min(corr[0], 3)  # no inflar el subgrave
    freqs = np.concatenate([[0], BANDS, [SR / 2]])
    gains_db = np.concatenate([[corr[0]], corr, [corr[-1]]])
    taps = 4097
    h = firwin2(taps, freqs / (SR / 2), 10 ** (gains_db / 20))
    y = np.stack([fftconvolve(x[:, c], h)[taps // 2: taps // 2 + len(x)] for c in range(2)], 1)
    return y.astype(np.float32), cur, corr


def check_melody(notes, chords, meter=4, strong=None, name='', all_notes=False):
    """Avisa si una nota en tiempo fuerte (o cualquiera, con all_notes) no pertenece al acorde (ni es 9a/6a)."""
    strong = strong or ([0, 2] if meter == 4 else [0])
    warn = []
    for b, d, p in notes:
        if p is None:
            continue
        pos = b % meter
        if not all_notes and not any(abs(pos - s) < 1e-6 for s in strong) and d < 1.5:
            continue
        ch = next((c for cb, cd, c in chords if cb <= b + 1e-6 < cb + cd), None)
        if ch is None:
            continue
        ok = set(ch.pcs) | {(ch.root + 2) % 12}
        if (ch.root + 9) % 12 not in ch.pcs and not ch.minor:
            ok |= {(ch.root + 9) % 12}
        if p % 12 not in ok:
            warn.append(f'{name} compás {int(b // meter) + 1} tiempo {pos + 1:g}: {p} sobre {ch.sym}')
    return warn
