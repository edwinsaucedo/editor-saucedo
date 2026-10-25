"""Café de la tarde — lo-fi tranquilo con piano eléctrico (Si bemol, 80 BPM, con swing)."""
from lib import Song, prog, mel, check_melody
from arr import at, pad, roots, melody, drums, chord_at

META = dict(id='cafe-de-la-tarde', name='Café de la tarde', mood='Tranquila', desc='Lo-fi relajado, como de cafetería.',
            tags=['vlog', 'polaroid', 'nostalgia', 'minimal', 'fondo'])

A = 'Cm9 | F13 | Bbmaj9 | Gm9 | Cm9 | F13 | Bbmaj9 | Gm9'
B = 'Ebmaj7 | Dm7 | Cm7 | F7sus4:2 F7:2 | Ebmaj7 | Dm7 | Cm7 | F13'
M_A = ('r:1 G5:.5 Bb5:.5 D6:1 C6:1 | A5:2 r:1 Eb5:1 | D5:1.5 F5:.5 A5:2 | Bb5:3 r:1 | '
       'r:.5 Eb5:.5 G5:.5 Bb5:.5 C6:1 Bb5:1 | A5:1.5 G5:.5 F5:2 | D5:1 C5:1 D5:2 | r:4')
M_B = 'G5:1.5 F5:.5 D5:2 | F5:1 A5:1 C6:2 | Bb5:1.5 G5:.5 Eb5:2 | F5:2 A5:2 | G5:1 Bb5:1 D6:2 | C6:1.5 A5:.5 F5:2 | Eb5:1 G5:1 Bb5:1 G5:1 | A5:4'

BEAT = {36: 'X.....x...X.....', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.'}
BEAT2 = {36: 'X.....x...X...x.', 38: '....X.......X...', 42: 'x.xox.x.x.xox.x.', 37: '..............g.'}


def build():
    s = Song(META['id'], bpm=80, meter=4, seed=51, swing=0.6, swing_unit=0.25)
    s.track('rhodes', program=4, pan=56, human=(12, 6), chorus=50, vel_add=8)
    s.track('bajo', program=32, pan=64, human=(8, 5), vel_add=6)
    s.track('kick', drum=True, program=8, human=(4, 4))
    s.track('bateria', drum=True, program=8, human=(8, 8))
    s.track('vibra', program=11, pan=74, human=(10, 6), vel_add=6)
    s.track('guitarra', program=26, pan=34, human=(10, 6))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)

    def keys(c, vel=64, late=0.04):
        prev = None
        for i, (b, d, cc) in enumerate(c):
            v = cc.voicing(55, 76, 5 if len(cc.pcs) >= 5 else 4, prev)
            prev = v
            # acorde en el 1 y anticipación suave en el "y" del 4 (si el compás es completo)
            for k, p in enumerate(v):
                s.note('rhodes', b + late + k * 0.012, d * 0.62 if d >= 4 else d - 0.05, p, vel - k)
            if d >= 4:
                for k, p in enumerate(v[1:]):
                    s.note('rhodes', b + 2.5 + late + k * 0.01, 1.3, p, vel - 16)

    def bass(c, vel=74):
        for b, d, cc in c:
            r = cc.near(cc.bass, 33)
            if r > 45:
                r -= 12
            s.note('bajo', b, 1.4, r, vel)
            if d >= 4:
                s.note('bajo', b + 1.75, 0.5, r + 7, vel - 14)
                s.note('bajo', b + 2.5, 1.0, r + 12, vel - 8)
                nxt = chord_at(c, b + d) if b + d < c[-1][0] + c[-1][1] else cc
                tgt = nxt.near(nxt.bass, 33)
                s.note('bajo', b + 3.5, 0.45, tgt + (1 if tgt < r else -1), vel - 18)

    b = s.section('intro', 4)
    keys(ch(A, b)[:4], vel=58)

    b = s.section('ritmo', 8)
    c = ch(A, b)
    keys(c); bass(c)
    drums(s, 'kick', b, 8, {36: BEAT[36]}, .9); drums(s, 'bateria', b, 8, {38: BEAT[38], 42: BEAT[42]}, .75)

    b = s.section('melodia', 8)
    s.meta['hot'] = b
    c = ch(A, b)
    keys(c); bass(c)
    drums(s, 'kick', b, 8, {36: BEAT2[36]}, .9); drums(s, 'bateria', b, 8, {38: BEAT2[38], 42: BEAT2[42], 37: BEAT2[37]}, .75)
    m = mel(M_A); melody(s, 'vibra', m, b, vel=72); warns += check_melody(m, prog(A), name='A')

    b = s.section('puente', 8)
    c = ch(B, b)
    keys(c, vel=66); bass(c)
    drums(s, 'kick', b, 8, {36: BEAT[36]}, .9); drums(s, 'bateria', b, 8, {38: BEAT[38], 42: BEAT2[42]}, .75)
    mb = mel(M_B); melody(s, 'guitarra', mb, b, vel=70); warns += check_melody(mb, prog(B), name='B')

    b = s.section('melodia2', 8)
    c = ch(A, b)
    keys(c); bass(c)
    drums(s, 'kick', b, 8, {36: BEAT2[36]}, .9); drums(s, 'bateria', b, 8, {38: BEAT2[38], 42: BEAT2[42], 37: BEAT2[37]}, .75)
    melody(s, 'vibra', m, b, vel=72); melody(s, 'guitarra', m, b, vel=50, transpose=-12)

    b = s.section('puente2', 8)
    c = ch(B, b)
    keys(c, vel=66); bass(c)
    drums(s, 'kick', b, 8, {36: BEAT[36]}, .9); drums(s, 'bateria', b, 8, {38: BEAT[38], 42: BEAT2[42]}, .75)
    melody(s, 'vibra', mb, b, vel=70)

    b = s.section('final', 4)
    c = ch('Cm9 | F13 | Bbmaj9 | Bbmaj9', b)
    keys(c[:3], vel=58)
    v = c[3][2].voicing(55, 76, 5)
    for k, p in enumerate(v):
        s.note('rhodes', b + 12 + k * 0.05, 3.8, p, 60)
    s.note('bajo', b + 12, 3.8, 'Bb1', 64)
    melody(s, 'vibra', mel('r:4 | r:4 | D5:1.5 F5:.5 A5:2 | D6:4'), b, vel=64)
    s.end_beat = b + 16

    s.mix = {
        'rhodes': dict(lufs=-21, hp=90, sends={'sala': -12}, warm=1.5),
        'bajo': dict(lufs=-22, hp=35, comp=(-20, 3, 0.01, 0.15, 6)),
        'kick': dict(lufs=-22, hp=35, lp=7000),
        'bateria': dict(lufs=-24, hp=150, lp=8000, sends={'sala': -14}),
        'vibra': dict(lufs=-23, hp=250, sends={'sala': -9}),
        'guitarra': dict(lufs=-24, hp=150, sends={'sala': -10}),
    }
    s.master = dict(tone='lofi', lofi=7500, crackle=7.0, reverbs={'sala': dict(seconds=1.6, predelay=0.015, bright=0.7)}, tail=4.0,
                    glue=(-16, 2.0, 0.03, 0.3, 6))
    return s, warns
