"""Cascabeles — arreglo navideño de "Jingle Bells" (melodía tradicional de dominio público, 1857). Sol mayor."""
from lib import Song, prog, mel, check_melody
from arr import at, pad, roots, melody, comp, drums, walk

META = dict(id='cascabeles', name='Cascabeles', mood='Navidad', desc='Navideña con cascabeles, celesta y metales.',
            tags=['navidad', 'temporada', 'familia', 'promo'])

VERSE = 'G | G | G | C | C | D | D7 | G | G | G | G | C | C | D | D7 | G:2 D7:2'
CHORUS = 'G | G | G | G | C | G | A7 | D7 | G | G | G | G | C | G | D7 | G'
M_VERSE = ('D4:1 B4:1 A4:1 G4:1 | D4:3 D4:.5 D4:.5 | D4:1 B4:1 A4:1 G4:1 | E4:4 | E4:1 C5:1 B4:1 A4:1 | F#4:4 | D5:1 D5:1 C5:1 A4:1 | B4:4 | '
           'D4:1 B4:1 A4:1 G4:1 | D4:4 | D4:1 B4:1 A4:1 G4:1 | E4:3 E4:1 | E4:1 C5:1 B4:1 A4:1 | D5:1 D5:1 D5:1 D5:1 | E5:1 D5:1 C5:1 A4:1 | G4:2 D5:2')
M_CHORUS = ('B4:1 B4:1 B4:2 | B4:1 B4:1 B4:2 | B4:1 D5:1 G4:1.5 A4:.5 | B4:4 | C5:1 C5:1 C5:1.5 C5:.5 | C5:1 B4:1 B4:1 B4:.5 B4:.5 | B4:1 A4:1 A4:1 B4:1 | A4:2 D5:2 | '
            'B4:1 B4:1 B4:2 | B4:1 B4:1 B4:2 | B4:1 D5:1 G4:1.5 A4:.5 | B4:4 | C5:1 C5:1 C5:1.5 C5:.5 | C5:1 B4:1 B4:1 B4:.5 B4:.5 | D5:1 D5:1 C5:1 A4:1 | G4:4')

BELLS = {83: 'x.o.x.o.x.o.x.o.'}
SWING = {38: '....x.......x...', 42: 'x.x.x.x.x.x.x.x.', 83: 'x.o.x.o.x.o.x.o.'}


def build():
    s = Song(META['id'], bpm=116, meter=4, seed=101)
    s.track('celesta', program=8, pan=66, human=(3, 4), vel_add=10)
    s.track('glock', program=10, bank=12, pan=74, human=(2, 4), vel_add=6)
    s.track('pizz', program=45, pan=40, human=(3, 5), vel_add=8)
    s.track('piano', program=0, pan=52, human=(4, 5), vel_add=6)
    s.track('bajo', program=32, pan=60, human=(4, 5), vel_add=8)
    s.track('metales', program=61, pan=62, human=(3, 4), vel_add=6)
    s.track('cuerdas', program=49, pan=64, human=(0, 0), vel_add=8)
    s.track('perc', drum=True, program=40, human=(4, 6))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    mv, mc = mel(M_VERSE), mel(M_CHORUS)
    warns += check_melody(mv, prog(VERSE), name='estrofa') + check_melody(mc, prog(CHORUS), name='coro')

    b = s.section('intro', 4)
    c = ch('G | C | D7 | G', b)
    drums(s, 'perc', b, 4, BELLS, .9)
    comp(s, 'piano', c, [(0, .9, 4), (1, .4, 0), (2, .9, 2), (3, .4, 0)], low=55, high=72, n=3, vel=64)
    melody(s, 'celesta', mel('D5:1 B5:1 A5:1 G5:1 | E5:1 C6:1 B5:1 A5:1 | D6:1 C6:1 A5:1 F#5:1 | G5:4'), b, vel=78)

    b = s.section('estrofa', 16)
    c = ch(VERSE, b)
    drums(s, 'perc', b, 16, BELLS, .85)
    comp(s, 'pizz', c, [(0, .5, 4), (1, .4, -2), (2, .5, 2), (3, .4, -2)], low=55, high=69, n=3, vel=70)
    roots(s, 'pizz', c, low=40, high=52, vel=76, rhythm=[(0, .5, 0), (2, .5, 7)])
    melody(s, 'celesta', mv, b, vel=84, transpose=12)

    def chorus(name, big=False):
        b = s.section(name, 16)
        c = ch(CHORUS, b)
        drums(s, 'perc', b, 16, SWING, .95 if big else .85)
        comp(s, 'piano', c, [(0, .9, 6), (1, .45, 0), (1.5, .45, 0), (2, .9, 4), (3, .45, 0), (3.5, .45, 0)], low=55, high=72, n=4, vel=70)
        walk(s, 'bajo', c, low=40, vel=80)
        melody(s, 'glock', mc, b, vel=86, transpose=12)
        if big:
            melody(s, 'metales', mc, b, vel=96, octave_double=-12, transpose=12)
            pad(s, 'cuerdas', c, low=57, high=76, n=4, vel=58)
        else:
            melody(s, 'celesta', mc, b, vel=70, transpose=12)
        return b

    s.meta['hot'] = chorus('coro')
    b = s.section('puente', 4)
    c = ch('C | G | A7 | D7', b)
    drums(s, 'perc', b, 4, BELLS, .85)
    pad(s, 'cuerdas', c, vel=56)
    walk(s, 'bajo', c, low=40, vel=76)
    melody(s, 'celesta', mel('E5:1 G5:1 C6:2 | B5:1 G5:1 D5:2 | C#6:1 A5:1 E5:1 G5:1 | F#5:1 A5:1 C6:1 D6:1'), b, vel=80)
    chorus('coro2', big=True)
    b = s.section('final', 6)
    c = ch('D7 | G | D7 | G | C | G', b)
    drums(s, 'perc', b, 4, SWING, .9)
    comp(s, 'piano', c[:4], [(0, .9, 6), (2, .9, 4)], low=55, high=72, n=4, vel=70)
    roots(s, 'bajo', c[:4], low=40, high=52, vel=80, rhythm=[(0, .9, 0), (2, .9, 7)])
    tag = mel('D5:1 D5:1 C5:1 A4:1 | G4:4 | D5:1 D5:1 C5:1 A4:1 | G4:2 r:2 | E5:2 D5:2 | G5:4')
    melody(s, 'metales', tag, b, vel=96, transpose=12, octave_double=-12)
    melody(s, 'glock', tag, b, vel=80, transpose=12)
    end = b + 20
    for p in ('G2', 'D3', 'G3', 'B3', 'D4', 'G4'):
        s.note('piano', end, 4, p, 84)
    s.note('cuerdas', end, 4, 'G4', 70); s.note('cuerdas', end, 4, 'B4', 70); s.note('cuerdas', end, 4, 'D5', 70)
    s.note('bajo', end, 4, 'G2', 84)
    for k in range(8):
        s.note('perc', end + k * .25, .2, 83, 100 - k * 8)
    s.end_beat = b + 24

    s.mix = {
        'celesta': dict(lufs=-21, hp=300, sends={'sala': -8}),
        'glock': dict(lufs=-22, hp=500, sends={'sala': -8}),
        'pizz': dict(lufs=-24, hp=90, sends={'sala': -10}),
        'piano': dict(lufs=-24, hp=90, sends={'sala': -12}),
        'bajo': dict(lufs=-23, hp=40),
        'metales': dict(lufs=-21, hp=150, sends={'sala': -9}),
        'cuerdas': dict(lufs=-26, hp=150, sends={'sala': -6}),
        'perc': dict(lufs=-23, hp=200, sends={'sala': -12}, air=1.5),
    }
    s.master = dict(tone='acustica', reverbs={'sala': dict(seconds=2.0, predelay=0.015, bright=1.0)}, tail=3.5)
    return s, warns
