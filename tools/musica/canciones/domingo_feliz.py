"""Domingo feliz — acústica alegre con silbido y ukulele (Re mayor, 100 BPM)."""
from lib import Song, prog, mel, check_melody
from arr import at, roots, melody, strum, drums, comp, fill

META = dict(id='domingo-feliz', name='Domingo feliz', mood='Acústica', desc='Guitarra, ukulele y silbido; luminosa y familiar.',
            tags=['vlog', 'bautizo', 'infantil', 'familia', 'polaroid'])

VERSE = 'D | A | Bm | G | D | A | G | A'
CHORUS = 'G | D/F# | Em | A | G | D/F# | Em:2 A:2 | D'
BRIDGE = 'Bm | G | D | A | Bm | G | Em | A'
M_VERSE = ('F#5:.5 A5:.5 F#5:.5 E5:.5 D5:1 E5:1 | E5:1.5 C#5:.5 A4:2 | D5:.5 F#5:.5 B5:1.5 A5:.5 F#5:1 | G5:1.5 F#5:.5 D5:2 | '
           'F#5:.5 A5:.5 F#5:.5 E5:.5 D5:1 E5:1 | E5:1.5 F#5:.5 E5:1 C#5:1 | D5:1 B4:1 D5:1 G5:1 | E5:3 r:1')
M_CHORUS = ('B5:1 A5:.5 G5:.5 B5:1 D6:1 | A5:2 F#5:1 D5:1 | G5:1 F#5:.5 E5:.5 G5:1 B5:1 | A5:3 r:1 | '
            'B5:1 A5:.5 G5:.5 B5:1 D6:1 | D6:1.5 C#6:.5 A5:2 | G5:1 B5:1 A5:1 G5:1 | F#5:2 D5:2')
M_BRIDGE = 'D5:1 F#5:1 B5:2 | B5:1 A5:1 G5:2 | F#5:1 A5:1 D6:2 | C#6:2 A5:2 | D5:1 F#5:1 B5:2 | D6:1 B5:1 G5:2 | G5:1 B5:1 E6:2 | E6:2 C#6:2'

PERC = {70: 'x.o.x.o.x.o.x.o.', 39: '....x.......x...'}
PERC2 = {70: 'xoxoxoxoxoxoxoxo', 39: '....X.......X...', 54: '..x...x...x...x.'}
KICK = {36: 'x.......x.....o.'}


def build():
    s = Song(META['id'], bpm=100, meter=4, seed=61)
    s.track('guitarra', program=25, pan=40, human=(4, 6), vel_add=2)
    s.track('uke', program=24, bank=8, pan=86, human=(4, 6))
    s.track('glock', program=9, pan=70, human=(2, 4))
    s.track('silbido', program=78, bank=11, pan=60, human=(5, 4))
    s.track('bajo', program=32, pan=60, human=(5, 5), vel_add=8)
    s.track('kick', drum=True, program=8, human=(3, 4))
    s.track('perc', drum=True, program=8, human=(5, 8))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    mv, mc = mel(M_VERSE), mel(M_CHORUS)
    warns += check_melody(mv, prog(VERSE), name='estrofa') + check_melody(mc, prog(CHORUS), name='coro')

    b = s.section('intro', 4)
    c = ch('D | A | G | A', b)
    strum(s, 'guitarra', c, 'D.DU.UDU', vel=74)
    drums(s, 'perc', b, 4, {39: '....x.......x...'}, .7)

    def verse(name, whistle=False):
        b = s.section(name, 8)
        c = ch(VERSE, b)
        strum(s, 'guitarra', c, 'D.DU.UDU', vel=72)
        roots(s, 'bajo', c, low=38, high=50, vel=72, rhythm=[(0, 1.4, 0), (1.5, .45, 0), (2, 1.4, 7), (3.5, .45, 0)])
        drums(s, 'kick', b, 8, KICK, .8); drums(s, 'perc', b, 8, PERC, .8)
        melody(s, 'glock', mv, b, vel=78)
        if whistle:
            melody(s, 'silbido', mv, b, vel=56, transpose=-12)
        return b

    def chorus(name):
        b = s.section(name, 8)
        c = ch(CHORUS, b)
        strum(s, 'guitarra', c, 'D.DU.UDU', vel=80)
        comp(s, 'uke', c, [(.5, .3, 0), (1.5, .3, 0), (2.5, .3, 0), (3.5, .3, 0)], low=60, high=76, n=4, vel=74)
        roots(s, 'bajo', c, low=38, high=50, vel=78, rhythm=[(0, .9, 0), (1, .45, 0), (1.5, .45, 7), (2, .9, 0), (3, .45, 12), (3.5, .45, 7)])
        drums(s, 'kick', b, 8, {36: 'x.......x.x.....'}, .9); drums(s, 'perc', b, 8, PERC2, .85)
        melody(s, 'silbido', mc, b, vel=84)
        melody(s, 'glock', mc, b, vel=54, transpose=12)
        fill(s, 'perc', b + 31, [39, 39, 39, 39], .9)
        return b

    verse('estrofa')
    s.meta['hot'] = chorus('coro')
    verse('estrofa2', whistle=True)
    chorus('coro2')
    b = s.section('puente', 8)
    c = ch(BRIDGE, b)
    strum(s, 'guitarra', c, 'D...D.DU', vel=70)
    comp(s, 'uke', c, [(0, .9, 4), (1, .4, 0), (1.5, .4, 0), (2.5, .4, 0), (3, .9, 0)], low=60, high=76, n=4, vel=66)
    roots(s, 'bajo', c, low=38, high=50, vel=70)
    drums(s, 'perc', b, 8, {70: 'x.o.x.o.x.o.x.o.'}, .7)
    mb = mel(M_BRIDGE); melody(s, 'glock', mb, b, vel=74); warns += check_melody(mb, prog(BRIDGE), name='puente')
    chorus('coro3')
    b = s.section('final', 4)
    c = ch('G | A | D | D', b)
    strum(s, 'guitarra', c[:2], 'D.DU.UDU', vel=76)
    comp(s, 'uke', c[:2], [(.5, .3, 0), (1.5, .3, 0), (2.5, .3, 0), (3.5, .3, 0)], low=60, high=76, n=4, vel=70)
    melody(s, 'silbido', mel('B5:1 A5:.5 G5:.5 B5:1 D6:1 | C#6:1 E6:1 C#6:2 | D6:4 | r:4'), b, vel=84)
    strum(s, 'guitarra', [(b + 8, 4, prog('D')[0][2])], 'D.......', vel=88)
    s.note('perc', b + 8, 1, 39, 110); s.note('kick', b + 8, 1, 36, 100)
    s.note('bajo', b + 8, 4, 'D2', 80)
    s.end_beat = b + 16

    s.mix = {
        'guitarra': dict(lufs=-21.5, hp=110, sends={'cuarto': -13}, air=2),
        'uke': dict(lufs=-25, hp=250, sends={'cuarto': -12}),
        'glock': dict(lufs=-25, hp=500, sends={'cuarto': -10}),
        'silbido': dict(lufs=-22, hp=400, sends={'cuarto': -9}),
        'bajo': dict(lufs=-23, hp=40, comp=(-20, 3, 0.01, 0.15, 6)),
        'kick': dict(lufs=-25, hp=40),
        'perc': dict(lufs=-24, hp=200, sends={'cuarto': -14}),
    }
    s.master = dict(tone='acustica', reverbs={'cuarto': dict(seconds=1.3, predelay=0.01, bright=1.0)}, tail=3.0)
    return s, warns
