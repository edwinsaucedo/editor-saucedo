"""Rebobinar — synthwave ochentero (La menor, 108 BPM)."""
from lib import Song, prog, mel, check_melody, riser
from arr import at, pad, roots, melody, arp, drums, fill

META = dict(id='rebobinar', name='Rebobinar', mood='Retro 80s', desc='Sintetizadores de los ochenta, ideal para VHS.',
            tags=['vhs', 'retro', 'vlog', 'glitch'])

A = 'Am | F | C | G | Am | F | C | G'
B = 'F | G | Am | Am | F | G | C | E'
M_B = 'A5:1.5 G5:.5 F5:1 C5:1 | B4:1.5 D5:.5 G5:2 | A5:2 E5:1 C5:1 | E5:3 r:1 | A5:1.5 C6:.5 A5:1 F5:1 | G5:1.5 B5:.5 D6:2 | E6:2 D6:1 C6:1 | B5:2 G#5:2'
M_A = 'E5:2 C5:1 A4:1 | A4:2 C5:2 | G4:2 C5:1 E5:1 | D5:4 | E5:2 C5:1 A4:1 | F5:2 C5:1 A4:1 | E5:1 G5:1 C6:1 G5:1 | D5:2 B4:2'

BEAT = {36: 'X.......X.......', 40: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.'}
BEAT2 = {36: 'X.....x.X.......', 40: '....X.......X...', 42: 'xoxoxoxoxoxoxoxo'}
PULSE = [(i * .5, .42, 0) for i in range(8)]


def build():
    s = Song(META['id'], bpm=108, meter=4, seed=71)
    s.track('kick', drum=True, program=24, human=(0, 2))
    s.track('bateria', drum=True, program=24, human=(2, 4))
    s.track('bajo', program=38, pan=64, human=(0, 3), vel_add=6)
    s.track('arp', program=81, bank=1, pan=44, human=(0, 3))
    s.track('pad', program=89, pan=64, human=(0, 0), chorus=70)
    s.track('lead', program=80, bank=12, pan=64, human=(2, 3), chorus=50)
    s.track('toms', program=118, bank=8, pan=70, human=(2, 3))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    ma, mb = mel(M_A), mel(M_B)
    warns += check_melody(ma, prog(A), name='A') + check_melody(mb, prog(B), name='B')

    b = s.section('intro', 8)
    c = ch(A, b)
    pad(s, 'pad', c, vel=70)
    arp(s, 'arp', c, pattern=(0, 1, 2, 3), step=0.25, vel=58, bass=(57, 69), span=14, gate=0.8)

    def verse(name, lead=False):
        b = s.section(name, 8)
        c = ch(A, b)
        drums(s, 'kick', b, 8, {36: BEAT[36]}); drums(s, 'bateria', b, 8, {40: BEAT[40], 42: BEAT[42]}, .9)
        roots(s, 'bajo', c, low=33, high=45, vel=82, rhythm=PULSE)
        pad(s, 'pad', c, vel=62)
        arp(s, 'arp', c, pattern=(0, 1, 2, 3), step=0.25, vel=56, bass=(57, 69), span=14, gate=0.8)
        if lead:
            melody(s, 'lead', ma, b, vel=84)
        fill(s, 'toms', b + 30, [57, 55, 52, 50, 48, 45, 43, 40], 0.9, 2)
        return b

    def chorus(name, octave=False):
        b = s.section(name, 8)
        c = ch(B, b)
        drums(s, 'kick', b, 8, {36: BEAT2[36]}); drums(s, 'bateria', b, 8, {40: BEAT2[40], 42: BEAT2[42]})
        s.note('bateria', b, 2, 49, 112)
        roots(s, 'bajo', c, low=33, high=45, vel=88, rhythm=PULSE)
        pad(s, 'pad', c, vel=70)
        arp(s, 'arp', c, pattern=(0, 1, 2, 3, 2, 1, 2, 3), step=0.25, vel=60, bass=(57, 69), span=14, gate=0.8)
        melody(s, 'lead', mb, b, vel=94, octave_double=12 if octave else -12)
        return b

    verse('estrofa')
    s.meta['hot'] = chorus('coro')
    verse('estrofa2', lead=True)
    chorus('coro2')
    b = s.section('pausa', 4)
    c = ch('F | G | Am | E', b)
    pad(s, 'pad', c, vel=74)
    arp(s, 'arp', c, pattern=(0, 1, 2, 3), step=0.25, vel=64, bass=(57, 69), span=14, gate=0.8)
    fill(s, 'toms', b + 14, [57, 55, 52, 50, 48, 45, 43, 40], 1.0, 2)
    chorus('coro3', octave=True)
    b = s.section('final', 4)
    c = ch('Am | F | G | Am', b)
    pad(s, 'pad', c, vel=66)
    arp(s, 'arp', c[:3], pattern=(0, 1, 2, 3), step=0.25, vel=56, bass=(57, 69), span=14, gate=0.8)
    drums(s, 'kick', b, 2, {36: BEAT[36]}); drums(s, 'bateria', b, 2, {40: BEAT[40], 42: BEAT[42]}, .8)
    roots(s, 'bajo', c[:3], low=33, high=45, vel=76, rhythm=PULSE)
    melody(s, 'lead', mel('E5:2 C5:1 A4:1 | A4:2 C5:2 | B4:2 D5:2 | A4:4'), b, vel=80)
    s.note('kick', b + 12, 1, 36, 110); s.note('bateria', b + 12, 3, 49, 100)
    s.end_beat = b + 16

    s.mix = {
        'kick': dict(lufs=-20, hp=30),
        'bateria': dict(lufs=-21.5, hp=150, sends={'gran': -6}),
        'bajo': dict(lufs=-21, hp=35, comp=(-20, 3, 0.01, 0.15, 6)),
        'arp': dict(lufs=-26, hp=300, lp=7000, sends={'eco': -8}),
        'pad': dict(lufs=-25, hp=180, sends={'gran': -8}),
        'lead': dict(lufs=-21, hp=200, sends={'gran': -9, 'eco': -10}),
        'toms': dict(lufs=-25, hp=60, sends={'gran': -6}),
    }
    marks = dict((n, b) for b, n in s.marks)
    s.master = dict(tone='pop', reverbs={'gran': dict(seconds=2.6, predelay=0.02, bright=1.0), 'eco': dict(seconds=1.2, predelay=0.18, bright=0.6)},
                    tail=3.5, glue=(-14, 2.2, 0.02, 0.2, 6),
                    extras=[('audio', s.sec(marks['coro3']) - 2, riser(2, 0.05))])
    return s, warns
