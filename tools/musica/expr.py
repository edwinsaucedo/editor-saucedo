"""Interpretación expresiva y arreglos de orquesta para baladas y valses.

Lo que hace que una canción hecha con MIDI no suene "robot":
- dinámica por frase (crece hacia el centro de la frase y se relaja al final), acentos según el compás
  y melodías que cantan más fuerte en las notas altas y largas;
- rubato: la frase se detiene un poco al final (ritardando) y el vals adelanta apenas el segundo tiempo;
- pedal de piano "sincopado" (se levanta justo en el cambio de acorde y se vuelve a pisar después);
- acordes de piano y arpa escalonados unos milisegundos, cuerdas que entran suave y crecen en cada acorde;
- cuerdas por secciones reales (violines I y II, violas, chelos y contrabajos) con sus propios planos.
Los instrumentos son del banco MuseScore General (MIT; piano "Splendid Grand" de dominio público y
cuerdas de VSCO 2 Community Edition, CC0).
"""
import math

from lib import Chord, pitch  # noqa: F401

# Banco MuseScore General: (programa, banco)
INS = {
    'piano': (0, 0), 'piano_suave': (0, 8), 'celesta': (8, 0), 'glock': (9, 0), 'campanas': (14, 0),
    'guitarra': (24, 0), 'arpa': (46, 0), 'timbal': (47, 0),
    'violin': (40, 0), 'violin_lento': (40, 8), 'viola': (41, 0), 'chelo': (42, 0),
    'vln1': (49, 20), 'vln2': (49, 25), 'vla': (49, 30), 'vc': (49, 40), 'cb': (49, 50),
    'vln1_pizz': (45, 20), 'vln2_pizz': (45, 25), 'vla_pizz': (45, 30), 'vc_pizz': (45, 40), 'cb_pizz': (45, 50),
    'cuerdas': (49, 0), 'flauta': (73, 0), 'oboe': (68, 0), 'clarinete': (71, 0), 'cornos': (60, 0),
    'coro': (52, 0), 'voces': (53, 0), 'colchon': (89, 0),
}
# Plano de la orquesta (paneo MIDI 0-127): violines I a la izquierda … chelos y contrabajos a la derecha.
PAN = {'vln1': 30, 'vln2': 46, 'vla': 76, 'vc': 92, 'cb': 100, 'arpa': 40, 'flauta': 58, 'oboe': 70, 'clarinete': 54,
       'cornos': 74, 'timbal': 66, 'piano': 62, 'piano_suave': 62, 'chelo': 82, 'violin': 44, 'violin_lento': 44,
       'guitarra': 52, 'celesta': 36, 'glock': 36, 'coro': 64, 'voces': 64}


def track(s, name, ins=None, **kw):
    prog, bank = INS[ins or name]
    kw.setdefault('pan', PAN.get(ins or name, 64))
    t = s.track(name, program=prog, bank=bank, **kw)
    t.ins = ins or name
    return t


# ----------------------------------------------------------------- interpretación
def perform(s, phrase_bars=4, lead=(), sustained=(), viennese=(), arc=7.0, seed_jit=2.5):
    """Da forma a la dinámica de todas las pistas (velocidades) y agrega crescendos por acorde a las cuerdas."""
    m = s.meter
    for name, t in s.tracks.items():
        if t.drum or not t.notes:
            continue
        ps = [p for _, _, p, _ in t.notes]
        mean_p = sum(ps) / len(ps)
        out = []
        for b, d, p, v in t.notes:
            bar, pos = divmod(b, m)
            k = ((bar % phrase_bars) + pos / m) / phrase_bars
            dv = math.sin(math.pi * k) * arc - arc * .35
            if abs(pos) < 1e-6:
                dv += 5
            elif abs(pos - round(pos)) < 1e-6:
                dv += (-4 if m == 3 else (2 if abs(pos - 2) < 1e-6 else -2))
            else:
                dv -= 5
            if name in lead:
                dv += max(-6, min(7, (p - mean_p) * .45)) + (4 if d >= 1.5 else 0)
            dv += s.rng.gauss(0, seed_jit)
            nb = b
            if name in viennese and m == 3 and abs(pos - 1) < 1e-6:
                nb = b - 0.012 / s.spb   # el "dos" del vals vienés llega un poquito antes
            out.append((nb, d, p, int(max(8, min(124, v + dv)))))
        t.notes = out
    for name in sustained:
        swells(s, name)


def swells(s, tr, depth=18, rise=0.32):
    """Cada acorde largo de las cuerdas entra un poco suave y crece (volumen del canal, CC7)."""
    t = s.tracks[tr]
    starts = sorted({round(b, 3) for b, d, p, v in t.notes if d >= 1.4})
    for i, b in enumerate(starts):
        d = max(dd for bb, dd, p, v in t.notes if round(bb, 3) == b)
        nxt = starts[i + 1] if i + 1 < len(starts) else b + d
        span = min(d, nxt - b)
        s.cc(tr, b, 7, 100 - depth)
        s.ramp(tr, b, span * rise, 7, 100 - depth, 100, steps=10)
        s.ramp(tr, b + span * .7, span * .28, 7, 100, 100 - depth * .35, steps=6)


def phrase_rit(s, starts, bar_len=1, to=0.93):
    """Ritardando corto en el último compás de cada frase (lista de tiempos donde termina la frase)."""
    for e in starts:
        s.rit(e - bar_len * s.meter, bar_len * s.meter, to)


def pedal(s, tr, chords, catch=0.07, lift=0.03):
    """Pedal sincopado: se suelta justo antes del cambio de acorde y se pisa otra vez después del ataque."""
    for b, d, c in chords:
        s.cc(tr, b + catch, 64, 127)
        s.cc(tr, b + d - lift, 64, 0)


# ----------------------------------------------------------------- piano
def bass_of(c, low=33, high=45):
    p = c.near(c.bass, low)
    return p if p <= high else p - 12


def piano_ballad(s, tr, chords, vel=56, kind='arp', top=None, rng=None):
    """Mano izquierda en arpegio abierto (raíz, quinta, décima) y mano derecha con el acorde.
    kind: 'arp' (arpegio que sube y baja), 'block' (acorde en 1 y 3), 'flow' (corcheas continuas)."""
    rng = rng or s.rng
    prev = None
    for i, (b, d, c) in enumerate(chords):
        bn = bass_of(c)
        fifth = c.near((c.root + 7) % 12, bn + 5)
        tenth = c.near(c.pcs[1] if len(c.pcs) > 1 else c.root, bn + 12)
        lh = [bn, fifth, tenth]
        rh = c.voicing(60, 76, 3, prev, top=top)
        prev = rh
        steps = int(round(d / 0.5))
        if kind == 'block':
            s.note(tr, b, d * .95, bn, vel + 6)
            s.note(tr, b, d * .95, bn + 12, vel - 6)
            for k in range(0, int(round(d)), 2):
                for p in rh:
                    s.note(tr, b + k, 1.9, p, vel - 4 + (4 if k == 0 else 0))
            continue
        seq = lh + [rh[0], rh[1], rh[2], rh[1], lh[2]] if kind == 'flow' else lh + [rh[-1], lh[2], lh[1]]
        for k in range(steps):
            p = seq[k % len(seq)]
            v = vel + (6 if k == 0 else 0) - (3 if k % 2 else 0)
            s.note(tr, b + k * .5, 1.4 if k else d * .9, p, v)
        if kind == 'arp' and d >= 2:
            for p in rh[1:]:
                s.note(tr, b + 1, d - 1.1, p, vel - 10)


def piano_waltz(s, tr, chords, vel=54, variant=0):
    """Acompañamiento de vals en el piano: bajo (con octava) en el 1 y acorde en el 2 y 3, con variaciones."""
    prev = None
    for i, (b, d, c) in enumerate(chords):
        bn = bass_of(c, 33, 45)
        s.note(tr, b, d * .95, bn, vel + 6)
        s.note(tr, b, d * .95, bn + 12, vel - 4)
        v = c.voicing(55, 70, 3, prev)
        prev = v
        mode = (i + variant) % 4
        if mode == 3:   # compás que respira: arpegio suave hacia arriba
            for k, p in enumerate(v):
                s.note(tr, b + 1 + k * .5, d - 1.1 - k * .5, p, vel - 8)
        else:
            for k in range(1, int(round(d))):
                for p in v:
                    s.note(tr, b + k, .7 if k < d - 1 else .9, p, vel - 10 + (2 if k == 1 else 0))


def piano_melody(s, tr, notes, start, vel=66, octave=False, transpose=0):
    """Melodía del piano (mano derecha), un poco más fuerte que el acompañamiento y con octava opcional."""
    for b, d, p in notes:
        if p is None:
            continue
        q = p + transpose
        s.note(tr, start + b, d * 1.02, q, vel + (5 if d >= 1.5 else 0))
        if octave:
            s.note(tr, start + b, d, q - 12, vel - 14)


# ----------------------------------------------------------------- orquesta
def legato(s, tr, notes, start, vel=70, overlap=0.06, transpose=0, octave=None):
    """Melodía legato (cuerdas, maderas): cada nota se encima un poquito con la siguiente."""
    for b, d, p in notes:
        if p is None:
            continue
        s.note(tr, start + b, d + overlap, p + transpose, vel + (4 if d >= 1.5 else 0))
        if octave:
            s.note(tr, start + b, d + overlap, p + transpose + octave, vel - 12)


def strings(s, chords, vel=52, sections=('vln1', 'vln2', 'vla', 'vc', 'cb'), high=79, prev=None, melody_on_v1=False, gap=0.03):
    """Colchón de cuerdas repartido por secciones con buena conducción de voces.
    Contrabajos: raíz grave · chelos: raíz o quinta · violas, violines II y I: el acorde arriba."""
    for b, d, c in chords:
        up = c.voicing(55, high, 3, prev)
        prev = up
        bn = bass_of(c, 28, 40)
        for sec in sections:
            if sec == 'cb':
                s.note('cb', b, d - gap, bn, vel)
            elif sec == 'vc':
                p = bass_of(c, 40, 52) if c.bass != c.root else c.near(c.root, 40)
                s.note('vc', b, d - gap, p, vel + 2)
            elif sec == 'vla':
                s.note('vla', b, d - gap, up[0], vel - 2)
            elif sec == 'vln2':
                s.note('vln2', b, d - gap, up[1], vel - 2)
            elif sec == 'vln1' and not melody_on_v1:
                s.note('vln1', b, d - gap, up[2], vel)
    return prev


def pizz(s, chords, vel=60, pattern=(1, 2), sec_hi=('vln2_p', 'vla_p'), bass='vc_p'):
    """Vals en pizzicato: bajo en el 1 (chelos) y acorde en el 2 y 3 (violines II y violas)."""
    prev = None
    for b, d, c in chords:
        s.note(bass, b, .5, bass_of(c, 36, 48), vel + 4)
        v = c.voicing(55, 72, 2, prev)
        prev = v
        for k in pattern:
            if k < d:
                for sec, p in zip(sec_hi, v):
                    s.note(sec, b + k, .4, p, vel - 6)


def harp(s, tr, chords, vel=50, up=True, step=1 / 3, span=24):
    """Arpa: arpegios que suben (y bajan) en cada acorde."""
    for b, d, c in chords:
        bn = bass_of(c, 36, 48)
        tones = [bn] + c.stack(bn + 7, bn + span)
        n = int(round(d / step))
        seq = tones + tones[-2:0:-1] if not up else tones
        for k in range(n):
            p = seq[k % len(seq)]
            s.note(tr, b + k * step, 1.8, p, vel + (6 if k == 0 else 0) - k % 2 * 3)


def gliss(s, tr, c, beat, beats=1.0, low=55, high=91, vel=52, down=False):
    notes = c.stack(low, high)
    if down:
        notes = notes[::-1]
    for i, p in enumerate(notes):
        s.note(tr, beat + beats * i / len(notes), 2.0, p, vel + 18 * i / len(notes))


def roll(s, tr, beat, beats, p, v0=30, v1=90, rate=7):
    n = int(beats * rate)
    for i in range(n):
        s.note(tr, beat + i / rate, 1 / rate, p, v0 + (v1 - v0) * (i / max(1, n - 1)) ** 1.5)


def dyn(s, tr, beat, beats, a, b, cc=11, steps=24):
    """Crescendo o diminuendo de una sección (expresión, CC11)."""
    s.ramp(tr, beat, beats, cc, a, b, steps)


def mix_orchestra(s, lead=None, extra=None, lufs=-15.0, hall=3.0, tone='orquesta'):
    """Mezcla de orquesta: niveles por sección, sala de concierto y masterización suave (más dinámica)."""
    base = {
        'piano': dict(lufs=-22, hp=45, sends={'sala': -12}, air=1.0),
        'vln1': dict(lufs=-24, hp=180, sends={'sala': -5}, air=1.0), 'vln2': dict(lufs=-26, hp=160, sends={'sala': -5}),
        'vla': dict(lufs=-27, hp=120, sends={'sala': -5}), 'vc': dict(lufs=-26, hp=50, sends={'sala': -6}),
        'cb': dict(lufs=-28, hp=30, sends={'sala': -7}), 'arpa': dict(lufs=-27, hp=80, sends={'sala': -5}),
        'flauta': dict(lufs=-26, hp=250, sends={'sala': -5}), 'oboe': dict(lufs=-26, hp=200, sends={'sala': -5}),
        'clarinete': dict(lufs=-26, hp=150, sends={'sala': -5}), 'cornos': dict(lufs=-28, hp=70, sends={'sala': -4}),
        'timbal': dict(lufs=-29, hp=35, sends={'sala': -6}), 'platillo': dict(lufs=-32, hp=250, sends={'sala': -5}),
        'chelo': dict(lufs=-23, hp=55, sends={'sala': -8}), 'violin': dict(lufs=-22, hp=200, sends={'sala': -7}, air=1.0),
        'guitarra': dict(lufs=-22, hp=70, sends={'sala': -11}, air=1.5), 'celesta': dict(lufs=-30, hp=300, sends={'sala': -4}),
        'coro': dict(lufs=-30, hp=180, sends={'sala': -3}),
        'glock': dict(lufs=-33, hp=500, sends={'sala': -4}), 'voces': dict(lufs=-31, hp=180, sends={'sala': -3}),
        'vln2_p': dict(lufs=-28, hp=150, sends={'sala': -6}), 'vla_p': dict(lufs=-29, hp=120, sends={'sala': -6}),
        'vc_p': dict(lufs=-27, hp=50, sends={'sala': -7}),
    }
    if lead:
        for k, v in lead.items():
            base.setdefault(k, dict(hp=150, sends={'sala': -7}))
            base[k].update(v)
    if extra:
        for k, v in extra.items():
            base.setdefault(k, {}).update(v)
    s.mix = {k: v for k, v in base.items() if k in s.tracks}
    s.master = dict(tone=tone, tone_max=3.0, lufs=lufs, glue=(-18, 1.5, 0.04, 0.4, 8),
                    reverbs={'sala': dict(seconds=hall, predelay=0.03, bright=0.72, width=1.15)}, tail=6.0)
