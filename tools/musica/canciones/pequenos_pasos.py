"""Pequeños pasos — tierna, de caja de música y pizzicato (Fa mayor, 92 BPM)."""
from lib import Song, prog, mel, check_melody
from arr import at, pad, roots, melody, comp, drums, arp

META = dict(id='pequenos-pasos', name='Pequeños pasos', mood='Tierna', desc='Caja de música y pizzicato, para bebés y niños.',
            tags=['bautizo', 'bebé', 'infantil', 'revelación', 'familia'])

A = 'F | C/E | Dm | Bb | F | C | Bb:2 C:2 | F'
B = 'Bb | C | Am | Dm | Bb | C | Dm:2 C:2 | F'
M_A = 'C5:1 F5:1 A5:1.5 G5:.5 | G5:1 E5:1 C5:2 | D5:1 F5:1 A5:1.5 G5:.5 | F5:3 r:1 | C5:1 F5:1 A5:1 C6:1 | G5:1.5 A5:.5 G5:1 E5:1 | F5:1 D5:1 E5:1 G5:1 | F5:3 r:1'
M_B = 'D5:1 F5:1 Bb5:2 | C6:1 Bb5:1 G5:2 | A5:1 C6:1 E6:1.5 D6:.5 | D6:2 A5:2 | Bb5:1 A5:.5 G5:.5 F5:2 | E5:1 G5:1 C6:2 | D6:1 C6:.5 Bb5:.5 C6:1 G5:1 | A5:3 r:1'


def build():
    s = Song(META['id'], bpm=92, meter=4, seed=111)
    s.track('caja', program=10, pan=60, human=(4, 4), vel_add=10)
    s.track('glock', program=9, pan=78, human=(3, 4))
    s.track('pizz', program=45, pan=44, human=(4, 5), vel_add=10)
    s.track('arpa', program=46, pan=30, human=(3, 4), vel_add=6)
    s.track('cuerdas', program=49, pan=64, human=(0, 0), vel_add=6)
    s.track('xilo', program=13, pan=88, human=(3, 4))
    s.track('perc', drum=True, program=0, human=(4, 6))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    ma, mb = mel(M_A), mel(M_B)
    warns += check_melody(ma, prog(A), name='A') + check_melody(mb, prog(B), name='B')
    POM = [(0, .5, 4), (1, .4, -2), (2, .5, 2), (3, .4, -2)]

    b = s.section('intro', 4)
    melody(s, 'caja', ma[:12], b, vel=76)
    arp(s, 'arpa', ch('F | C/E | Dm | Bb', b), pattern=(0, 2, 3, 4, 3, 2, 1, 2), step=.5, vel=50, bass=(41, 53), span=24, gate=2)

    def part(name, txt, m, level):
        b = s.section(name, 8)
        c = ch(txt, b)
        melody(s, 'caja', m, b, vel=80)
        roots(s, 'pizz', c, low=41, high=53, vel=70, rhythm=[(0, .5, 0), (2, .5, 7)])
        comp(s, 'pizz', c, POM, low=57, high=70, n=3, vel=60)
        if level >= 2:
            melody(s, 'glock', m, b, vel=62, transpose=12)
            arp(s, 'arpa', c, pattern=(0, 2, 3, 4, 3, 2, 1, 2), step=.5, vel=50, bass=(41, 53), span=24, gate=2)
        if level >= 3:
            drums(s, 'perc', b, 8, {70: 'x.o.x.o.x.o.x.o.', 76: '....x.......x...'}, .7)
            melody(s, 'xilo', [(x, d, p) for x, d, p in m if d <= 1], b, vel=58)
        if level >= 2:
            pad(s, 'cuerdas', c, vel=40)
        return b

    part('A', A, ma, 1)
    s.meta['hot'] = part('B', B, mb, 2)
    part('A2', A, ma, 2)
    part('B2', B, mb, 3)
    part('A3', A, ma, 3)
    b = s.section('final', 4)
    c = ch('Bb | C | F | F', b)
    melody(s, 'caja', mel('D5:1 F5:1 Bb5:2 | C6:1 Bb5:1 G5:2 | A5:4 | F5:4'), b, vel=74)
    arp(s, 'arpa', c[:2], pattern=(0, 2, 3, 4, 3, 2, 1, 2), step=.5, vel=48, bass=(41, 53), span=24, gate=2)
    for k, p in enumerate(['F3', 'C4', 'F4', 'A4', 'C5', 'F5']):
        s.note('arpa', b + 8 + k * .12, 7, p, 60)
    pad(s, 'cuerdas', c, vel=40)
    s.end_beat = b + 16

    s.mix = {
        'caja': dict(lufs=-20.5, hp=300, sends={'sala': -8}),
        'glock': dict(lufs=-26, hp=600, sends={'sala': -8}),
        'pizz': dict(lufs=-23, hp=80, sends={'sala': -10}),
        'arpa': dict(lufs=-25, hp=90, sends={'sala': -7}),
        'cuerdas': dict(lufs=-28, hp=150, sends={'sala': -6}),
        'xilo': dict(lufs=-27, hp=400, sends={'sala': -9}),
        'perc': dict(lufs=-28, hp=300, sends={'sala': -10}),
    }
    s.master = dict(tone='acustica', reverbs={'sala': dict(seconds=2.2, predelay=0.02, bright=0.9)}, tail=4.0)
    return s, warns
