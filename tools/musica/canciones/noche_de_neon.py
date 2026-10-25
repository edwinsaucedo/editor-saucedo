"""Noche de neón — electrónica bailable (Fa menor, 124 BPM)."""
from lib import Song, prog, mel, check_melody, riser, impact
from arr import at, pad, roots, melody, comp, arp, drums, snare_roll

META = dict(id='noche-de-neon', name='Noche de neón', mood='Electrónica', desc='Para bailar: bajos, sintetizadores y caídas fuertes.',
            tags=['xv', 'reel', 'fiesta', 'neón', 'promo'])

LOOP = 'Fm | Db | Ab | Eb | Fm | Db | Ab | Eb'
M_DROP = ('F5:.75 Ab5:.75 C6:.5 Ab5:.75 G5:.75 F5:.5 | F5:.75 Ab5:.75 Db6:.5 Db6:.75 C6:.75 Ab5:.5 | '
          'Eb5:.75 Ab5:.75 C6:.5 C6:.75 Bb5:.75 Ab5:.5 | G5:.75 Bb5:.75 Eb6:.5 Eb6:.75 Bb5:.75 G5:.5 | '
          'F5:.75 Ab5:.75 C6:.5 Ab5:.75 G5:.75 F5:.5 | F5:.75 Ab5:.75 Db6:.5 Db6:.75 C6:.75 Ab5:.5 | '
          'Eb5:.75 Ab5:.75 C6:.5 C6:.75 Bb5:.75 Ab5:.5 | G5:.75 Bb5:.75 Eb6:.5 F6:1 Eb6:1')
M_BREAK = 'C6:3 Ab5:1 | Ab5:2 F5:2 | Eb6:3 C6:1 | Bb5:4 | C6:3 Ab5:1 | Db6:2 C6:2 | C6:2 Eb6:2 | G5:4'

DROP = {39: '....X.......X...', 42: '..x...x...x...x.', 46: '..o...o...o...o.', 70: 'xoxoxoxoxoxoxoxo'}
OFF = [(.5, .4, 0), (1.5, .4, 0), (2.5, .4, 0), (3.5, .4, 0)]
BASS = [(.5, .42, 0), (1, .2, 12), (1.5, .42, 0), (2.5, .42, 0), (3, .2, 12), (3.5, .42, 0)]


def build():
    s = Song(META['id'], bpm=124, meter=4, seed=41)
    s.track('kick', drum=True, program=25, human=(0, 0))
    s.track('bateria', drum=True, program=25, human=(2, 5))
    s.track('bajo', program=38, pan=64, human=(0, 3), vel_add=4)
    s.track('stabs', program=81, bank=11, pan=64, human=(1, 3))
    s.track('pad', program=90, pan=64, human=(0, 0), chorus=60)
    s.track('arp', program=81, bank=1, pan=40, human=(0, 4))
    s.track('lead', program=81, bank=12, pan=64, human=(0, 2), chorus=40)
    s.track('pluck', program=98, bank=1, pan=86, human=(1, 4))
    warns = []
    ch = lambda b: at(prog(LOOP), b)
    drop = mel(M_DROP)
    warns += check_melody(drop, prog(LOOP), name='caída')

    b = s.section('intro', 8)
    c = ch(b)
    pad(s, 'pad', c, vel=70)
    arp(s, 'arp', c, pattern=(0, 1, 2, 3, 2, 1, 2, 3), step=0.25, vel=56, bass=(53, 65), span=19, gate=0.9, accent=6)
    drums(s, 'bateria', b + 16, 4, {42: '..x...x...x...x.'}, .7)

    b = s.section('sube', 8)
    c = ch(b)
    pad(s, 'pad', c, vel=74)
    arp(s, 'arp', c, pattern=(0, 1, 2, 3, 2, 1, 2, 3), step=0.25, vel=64, bass=(53, 65), span=19, gate=0.9)
    drums(s, 'kick', b, 6, {36: 'X...X...X...X...'})
    drums(s, 'bateria', b, 6, {42: '..x...x...x...x.', 39: '....x.......x...'}, .85)
    roots(s, 'bajo', c[:6], low=29, high=41, vel=70, rhythm=OFF)
    snare_roll(s, 'bateria', b + 16, 7, note=39, start_div=1, end_div=8, v0=50, v1=120)
    melody(s, 'pluck', mel(M_BREAK), b, vel=70)

    def caida(name, big=False):
        b = s.section(name, 16)
        for half in (0, 32):
            c = ch(b + half)
            drums(s, 'kick', b + half, 8, {36: 'X...X...X...X...'})
            drums(s, 'bateria', b + half, 8, DROP)
            roots(s, 'bajo', c, low=29, high=41, vel=92, rhythm=BASS)
            comp(s, 'stabs', c, OFF, low=60, high=77, n=4, vel=84)
            pad(s, 'pad', c, vel=60)
            melody(s, 'lead', drop, b + half, vel=100, octave_double=12 if (big or half) else None)
            if big:
                arp(s, 'arp', c, pattern=(0, 1, 2, 3), step=0.25, vel=60, bass=(65, 77), span=14, gate=0.8)
        s.note('bateria', b, 3, 49, 120)
        s.note('bateria', b + 32, 3, 49, 110)
        return b

    s.meta['hot'] = caida('caida')

    b = s.section('pausa', 8)
    c = ch(b)
    pad(s, 'pad', c, vel=78)
    arp(s, 'arp', c, pattern=(0, 1, 2, 3, 2, 1, 2, 3), step=0.25, vel=66, bass=(53, 65), span=19, gate=0.9)
    mb = mel(M_BREAK); melody(s, 'pluck', mb, b, vel=82); warns += check_melody(mb, prog(LOOP), name='pausa')
    roots(s, 'bajo', c, low=29, high=41, vel=60, rhythm=[(0, 3.8, 0)])

    b = s.section('sube2', 8)
    c = ch(b)
    pad(s, 'pad', c, vel=76)
    drums(s, 'kick', b, 6, {36: 'X...X...X...X...'})
    drums(s, 'bateria', b, 6, {42: '..x...x...x...x.', 39: '....x.......x...'}, .9)
    roots(s, 'bajo', c[:6], low=29, high=41, vel=74, rhythm=OFF)
    melody(s, 'lead', drop[:12], b + 16, vel=80)
    snare_roll(s, 'bateria', b + 16, 7, note=39, start_div=1, end_div=8, v0=55, v1=124)

    caida('caida2', big=True)

    b = s.section('final', 8)
    c = ch(b)
    drums(s, 'kick', b, 4, {36: 'X...X...X...X...'})
    drums(s, 'bateria', b, 4, {42: '..x...x...x...x.'}, .8)
    pad(s, 'pad', c, vel=66)
    arp(s, 'arp', c[:6], pattern=(0, 1, 2, 3, 2, 1, 2, 3), step=0.25, vel=58, bass=(53, 65), span=19, gate=0.9)
    roots(s, 'bajo', c[:4], low=29, high=41, vel=80, rhythm=OFF)
    s.ramp('pad', b + 16, 16, 11, 127, 10)
    end = b + 28
    for p in ('F2', 'C3', 'F3', 'Ab3', 'C4'):
        s.note('stabs', end, 4, p, 90)
    s.note('kick', end, 1, 36, 120); s.note('bateria', end, 4, 49, 110)
    s.end_beat = b + 32

    duck = (-9, 0.004, 0.03, 0.16)
    s.mix = {
        'kick': dict(lufs=-19, hp=28, peq=[(55, 3, 1.0)]),
        'bateria': dict(lufs=-22.5, hp=180, sends={'sala': -16}, air=2),
        'bajo': dict(lufs=-21, hp=30, duck=(-7, 0.003, 0.02, 0.12), sat=1.5),
        'stabs': dict(lufs=-24, hp=220, duck=duck, sends={'sala': -12}),
        'pad': dict(lufs=-25, hp=200, duck=duck, sends={'sala': -10}),
        'arp': dict(lufs=-27, hp=300, lp=6000, duck=duck, sends={'sala': -10}),
        'lead': dict(lufs=-21, hp=200, sends={'sala': -10}, duck=(-4, 0.004, 0.02, 0.12)),
        'pluck': dict(lufs=-24, hp=250, sends={'sala': -8}),
    }
    marks = dict((n, b) for b, n in s.marks)
    s.master = dict(tone='edm', reverbs={'sala': dict(seconds=2.0, predelay=0.02, bright=1.0)}, tail=3.0, glue=(-13, 2.5, 0.01, 0.15, 6),
                    extras=[('audio', s.sec(marks['caida']) - 4, riser(4, 0.08)), ('audio', s.sec(marks['caida2']) - 4, riser(4, 0.09)),
                            ('audio', s.sec(marks['caida']), impact(0.3)), ('audio', s.sec(marks['caida2']), impact(0.32))])
    return s, warns
