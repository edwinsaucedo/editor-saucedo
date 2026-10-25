"""Impacto — trap moderno, oscuro y con fuerza (Do menor, 140 BPM a medio tiempo)."""
from lib import Song, prog, mel, check_melody, riser, impact
from arr import at, pad, melody, drums, trap_hats, chord_at
import random

META = dict(id='impacto', name='Impacto', mood='Trap', desc='Graves fuertes y hi-hats rápidos, para videos con fuerza.',
            tags=['impacto', 'reel', 'glitch', 'xv', 'antes y después'])

LOOP = 'Cm | Ab | Fm | G | Cm | Ab | Fm | G'
M_BELL = ('G5:.5 Eb5:.5 C5:.5 Eb5:.5 G5:.5 Ab5:.5 G5:1 | Ab5:.5 F5:.5 C5:.5 F5:.5 Ab5:1 G5:1 | '
          'F5:.5 C5:.5 Ab4:.5 C5:.5 F5:.5 G5:.5 Ab5:1 | G5:.5 D5:.5 B4:.5 D5:.5 G5:2 | '
          'G5:.5 Eb5:.5 C5:.5 Eb5:.5 G5:.5 Ab5:.5 G5:1 | Ab5:.5 F5:.5 C5:.5 F5:.5 Ab5:1 C6:1 | '
          'C6:.5 Ab5:.5 F5:.5 Ab5:.5 C6:.5 Ab5:.5 F5:1 | G5:.5 D5:.5 B4:.5 D5:.5 G5:1 B5:1')
KICK = 'X......x..X.....'
KICK2 = 'X......x..X...x.'


def eight08(s, c, pattern, vel=100):
    """Bajo 808: cada golpe del bombo toca la nota del acorde y suena hasta el siguiente."""
    steps = [i for i, x in enumerate(pattern) if x in 'Xx']
    for b, d, cc in c:
        root = cc.near(cc.root, 24)
        hits = [b + i * .25 for i in steps if i * .25 < d]
        for k, h in enumerate(hits):
            nxt = hits[k + 1] if k + 1 < len(hits) else b + d
            s.note('808', h, nxt - h - .02, root + (12 if k == 2 and pattern is KICK2 else 0), vel)


def build():
    s = Song(META['id'], bpm=140, meter=4, seed=121)
    s.track('kick', drum=True, program=25, human=(0, 0))
    s.track('bateria', drum=True, program=25, human=(1, 4))
    s.track('808', program=80, bank=8, pan=64, human=(0, 0))
    s.track('campana', program=10, pan=64, human=(0, 3), vel_add=8)
    s.track('pad', program=91, pan=64, human=(0, 0), chorus=60)
    s.track('pluck', program=98, bank=1, pan=80, human=(0, 3))
    s.track('cuerdas', program=44, pan=46, human=(0, 0))
    warns = []
    ch = lambda b: at(prog(LOOP), b)
    bell = mel(M_BELL)
    warns += check_melody(bell, prog(LOOP), name='campana')
    rng = random.Random(5)

    b = s.section('intro', 4)
    c = ch(b)[:4]
    melody(s, 'campana', [n for n in bell if n[0] < 16], b, vel=70)
    pad(s, 'pad', c, vel=64)

    def drop(name, extra=False):
        b = s.section(name, 16)
        for half in (0, 32):
            c = ch(b + half)
            drums(s, 'kick', b + half, 8, {36: KICK2 if extra else KICK})
            drums(s, 'bateria', b + half, 8, {39: '........X.......', 38: '........x.......', 46: '..............o.' if extra else ''})
            trap_hats(s, 'bateria', b + half, 8, rng=rng)
            eight08(s, c, KICK2 if extra else KICK, vel=104)
            melody(s, 'campana', bell, b + half, vel=82)
            pad(s, 'pad', c, vel=52)
            if extra:
                pad(s, 'cuerdas', c, low=55, high=72, n=3, vel=54)
                melody(s, 'pluck', [(x, d, p) for x, d, p in bell if d >= 1], b + half, vel=74, transpose=12)
        s.note('bateria', b, 3, 49, 110)
        return b

    s.meta['hot'] = drop('caida')
    b = s.section('pausa', 8)
    c = ch(b)
    pad(s, 'pad', c, vel=66)
    eight08(s, c, 'X...............', vel=80)
    trap_hats(s, 'bateria', b, 8, rng=rng, rolls=False, vel=.7)
    melody(s, 'pluck', [(x, d, p) for x, d, p in bell if d >= 1], b, vel=70, transpose=12)
    drums(s, 'bateria', b + 28, 1, {39: 'x.x.xxxxxxxxxxxx'}, .9)
    drop('caida2', extra=True)
    b = s.section('final', 4)
    c = ch(b)[:4]
    melody(s, 'campana', [n for n in bell if n[0] < 16], b, vel=66)
    pad(s, 'pad', c, vel=56)
    s.ramp('pad', b, 16, 11, 120, 20)
    s.note('808', b, 4, 'C1', 96); s.note('kick', b, 1, 36, 120)
    s.end_beat = b + 16

    s.mix = {
        'kick': dict(lufs=-20, hp=30, peq=[(60, 2, 1.0)]),
        'bateria': dict(lufs=-22, hp=200, sends={'sala': -16}, air=2),
        '808': dict(lufs=-19, hp=25, sat=2.2, duck=(-4, 0.002, 0.01, 0.06)),
        'campana': dict(lufs=-21, hp=300, sends={'sala': -8}),
        'pad': dict(lufs=-26, hp=200, sends={'sala': -8}),
        'pluck': dict(lufs=-25, hp=300, sends={'sala': -8}),
        'cuerdas': dict(lufs=-27, hp=200, sends={'sala': -8}),
    }
    marks = dict((n, b) for b, n in s.marks)
    s.master = dict(tone='edm', reverbs={'sala': dict(seconds=2.2, predelay=0.02, bright=0.9)}, tail=3.0, glue=(-13, 2.2, 0.01, 0.15, 6),
                    extras=[('audio', s.sec(marks['caida']) - 2.5, riser(2.5, 0.07)), ('audio', s.sec(marks['caida']), impact(0.32)),
                            ('audio', s.sec(marks['caida2']) - 2.5, riser(2.5, 0.07)), ('audio', s.sec(marks['caida2']), impact(0.34))])
    return s, warns
