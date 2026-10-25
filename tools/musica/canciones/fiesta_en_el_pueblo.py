"""Fiesta en el pueblo — cumbia con acordeón (Mi menor, 96 BPM)."""
from lib import Song, prog, mel, check_melody
from arr import at, roots, melody, comp, drums, harmonize, fill

META = dict(id='fiesta-en-el-pueblo', name='Fiesta en el pueblo', mood='Cumbia', desc='Cumbia con acordeón y güiro para la fiesta mexicana.',
            tags=['fiesta mexicana', 'cumpleaños', 'baile', 'promo'])

A = 'Em | Am | D | G | C | Am | B7 | Em'
B = 'C | D | Bm | Em | C | D | B7 | B7'
INTRO = 'C | Am | B7 | Em'
M_A = ('B4:.5 E5:.5 G5:.5 E5:.5 B5:1 A5:.5 G5:.5 | A5:.5 G5:.5 F#5:.5 G5:.5 A5:1 E5:1 | F#5:.5 A5:.5 D6:.5 C6:.5 A5:1 F#5:1 | G5:1.5 B5:.5 G5:1 D5:1 | '
       'E5:.5 G5:.5 C6:.5 B5:.5 C6:1 G5:1 | A5:.5 C6:.5 E6:.5 D6:.5 C6:1 A5:1 | F#5:.5 A5:.5 B5:.5 A5:.5 F#5:1 D#5:1 | E5:1.5 B4:.5 E5:1 r:1')
M_B = ('G5:1 E5:.5 G5:.5 C6:1 B5:1 | A5:1.5 F#5:.5 D5:2 | F#5:.5 B5:.5 D6:.5 B5:.5 F#5:1 D5:1 | G5:1.5 F#5:.5 E5:2 | '
       'E5:.5 G5:.5 C6:.5 G5:.5 E6:1 C6:1 | D6:1 C6:.5 A5:.5 F#5:1 A5:1 | B5:1 A5:.5 F#5:.5 D#5:1 F#5:1 | A5:2 B5:2')
M_INTRO = 'E5:.5 G5:.5 C6:.5 B5:.5 C6:1 G5:1 | A5:.5 C6:.5 E6:.5 D6:.5 C6:1 A5:1 | F#5:.5 A5:.5 B5:.5 A5:.5 F#5:1 D#5:1 | E5:1.5 B4:.5 E5:1 r:1'

GUIRO = {74: 'x...x...x...x...', 73: '..oo..oo..oo..oo'}
CONGAS = {62: 'o.o...o.o.o...o.', 63: '......x.......x.', 64: '..............xx'}
KICK = {36: 'x.......x.......'}
OFFBEAT = [(.5, .3, 0), (1.5, .3, 0), (2.5, .3, 0), (3.5, .3, 0)]
BASS = [(0, .9, 0), (2, .9, 7), (3.5, .4, 12)]


def alt(c):
    return 'harm' if c.root == 11 else 'minor'


def build():
    s = Song(META['id'], bpm=96, meter=4, seed=81)
    s.track('acordeon', program=21, bank=8, pan=58, human=(4, 5), vel_add=6)
    s.track('acordeon2', program=21, bank=8, pan=72, human=(4, 5))
    s.track('bajo', program=33, pan=64, human=(3, 5), vel_add=8)
    s.track('guitarra', program=27, pan=36, human=(3, 5))
    s.track('piano', program=0, pan=84, human=(4, 5))
    s.track('kick', drum=True, program=0, human=(2, 3))
    s.track('perc', drum=True, program=0, human=(4, 7))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    ma, mb = mel(M_A), mel(M_B)
    warns += check_melody(ma, prog(A), name='A') + check_melody(mb, prog(B), name='B')

    def groove(b, bars, v=1.0):
        drums(s, 'kick', b, bars, KICK, .8 * v)
        drums(s, 'perc', b, bars, {**GUIRO, **CONGAS}, v)

    b = s.section('intro', 4)
    c = ch(INTRO, b)
    mi = mel(M_INTRO)
    melody(s, 'acordeon', mi, b, vel=86)
    harmonize(s, 'acordeon2', mi, b, 4, c, -2, vel=62, alt=alt)
    drums(s, 'perc', b, 4, GUIRO, .9)
    comp(s, 'guitarra', c, OFFBEAT, low=55, high=67, n=3, vel=74)

    def part(name, txt, m, solo=False):
        b = s.section(name, 8)
        c = ch(txt, b)
        groove(b, 8)
        roots(s, 'bajo', c, low=36, high=48, vel=84, rhythm=BASS)
        comp(s, 'guitarra', c, OFFBEAT, low=55, high=67, n=3, vel=76)
        if solo:
            comp(s, 'piano', c, [(0, .4, 4), (.75, .25, 0), (1.5, .4, 0), (2.25, .25, 0), (3, .4, 2), (3.5, .4, 0)], low=60, high=76, n=3, vel=70)
            melody(s, 'acordeon', m, b, vel=92)
            harmonize(s, 'acordeon2', m, b, 4, c, -5, vel=68, alt=alt)
        else:
            melody(s, 'acordeon', m, b, vel=88)
            harmonize(s, 'acordeon2', [(x, d, p) for x, d, p in m], b, 4, c, -2, vel=62, alt=alt)
        fill(s, 'perc', b + 31, [65, 65, 66, 66], .9)
        return b

    s.meta['hot'] = part('cumbia', A, ma)
    part('segunda', B, mb)
    part('cumbia2', A, ma)
    part('solo', A, ma, solo=True)
    part('segunda2', B, mb)
    part('cumbia3', A, ma)
    b = s.section('final', 4)
    c = ch(INTRO, b)
    groove(b, 3)
    roots(s, 'bajo', c[:3], low=36, high=48, vel=84, rhythm=BASS)
    comp(s, 'guitarra', c[:3], OFFBEAT, low=55, high=67, n=3, vel=76)
    melody(s, 'acordeon', mi, b, vel=90)
    harmonize(s, 'acordeon2', mi, b, 4, c, -2, vel=66, alt=alt)
    end = b + 12
    s.note('bajo', end, 1.5, 'E2', 96); s.note('kick', end, 1, 36, 110)
    for p in ('E4', 'G4', 'B4', 'E5'):
        s.note('acordeon', end + 1, 1.5, p, 96)
    s.note('perc', end + 1, 1, 65, 110); s.note('perc', end + 1, 1, 49, 100)
    s.end_beat = b + 16

    s.mix = {
        'acordeon': dict(lufs=-20.5, hp=180, sends={'cuarto': -12}),
        'acordeon2': dict(lufs=-25, hp=180, sends={'cuarto': -12}),
        'bajo': dict(lufs=-21, hp=35, comp=(-20, 3, 0.01, 0.15, 6)),
        'guitarra': dict(lufs=-25, hp=250, sends={'cuarto': -14}),
        'piano': dict(lufs=-26, hp=200, sends={'cuarto': -12}),
        'kick': dict(lufs=-25, hp=35),
        'perc': dict(lufs=-21.5, hp=200, sends={'cuarto': -14}, air=2),
    }
    s.master = dict(tone='pop', reverbs={'cuarto': dict(seconds=1.2, predelay=0.01, bright=1.0)}, tail=2.5)
    return s, warns
