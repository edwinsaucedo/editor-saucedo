"""Brillar — inspiradora, de piano que late y cuerdas (Do mayor, sube a Re al final)."""
from lib import Song, prog, mel, check_melody, riser
from arr import at, tr_chords, pad, roots, melody, comp, drums, arp, snare_roll

META = dict(id='brillar', name='Brillar', mood='Inspiradora', desc='Piano, cuerdas y tambores que crecen; motivadora.',
            tags=['graduación', 'promo', 'resumen', 'save the date', 'aniversario'])

A = 'C | G/B | Am | F | C | G/B | Am | F'
B = 'F | G | Em | Am | F | G | Csus4 | C'
CH = 'C | G | Am | F | C | G | F:2 G:2 | C'
M_A = 'G4:1 C5:1 E5:2 | D5:1.5 B4:.5 G4:2 | A4:1 C5:1 E5:1.5 D5:.5 | C5:2 A4:2 | G4:1 C5:1 E5:1 G5:1 | D5:1.5 F5:.5 D5:1 B4:1 | C5:1 E5:1 A5:1.5 G5:.5 | F5:4'
M_B = 'A4:1 C5:1 F5:2 | G5:1.5 F5:.5 D5:2 | E5:1 G5:1 B5:2 | C6:2 A5:2 | A5:1 G5:1 F5:2 | D5:1 G5:1 B5:2 | C6:2 F5:2 | E5:4'
BRIDGE = 'Am | F | C | G | Am | F | Dm | G'
M_BRIDGE = 'E5:2 A5:2 | A5:1.5 G5:.5 F5:2 | E5:1 G5:1 C6:2 | B5:2 D6:2 | C6:2 A5:2 | A5:1.5 C6:.5 F5:2 | F5:1 E5:1 D5:2 | D5:2 G5:2'
M_CH = 'E5:1 G5:1 C6:1.5 B5:.5 | B5:1 A5:.5 G5:.5 D5:2 | C6:1 B5:.5 A5:.5 E5:2 | F5:1.5 A5:.5 C6:2 | E6:1.5 D6:.5 C6:1 G5:1 | B5:1.5 C6:.5 D6:2 | C6:1 A5:1 B5:1 D6:1 | C6:4'

PULSE = [(i * .5, .45, 6 if i % 2 == 0 else 0) for i in range(8)]
TOMS = {41: 'x.....x.x.......', 45: '....x.......x...', 43: '..........x...x.'}
FULL = {36: 'X.....x.X.....x.', 38: '....X.......X...', 39: '....x.......x...', 42: 'x.o.x.o.x.o.x.o.'}


def build():
    s = Song(META['id'], bpm=100, meter=4, seed=91)
    s.track('piano', program=0, pan=56, human=(3, 4), vel_add=8)
    s.track('melodia', program=0, pan=70, human=(6, 5), vel_add=12)
    s.track('cuerdas', program=49, pan=64, human=(0, 0), vel_add=10)
    s.track('ostinato', program=48, pan=40, human=(2, 4), legato=0.5)
    s.track('violines', program=49, pan=78, human=(0, 0), vel_add=10)
    s.track('campanas', program=9, pan=80, human=(2, 3))
    s.track('bajo', program=33, pan=64, human=(3, 4), vel_add=4)
    s.track('kick', drum=True, program=16, human=(2, 3))
    s.track('bateria', drum=True, program=16, human=(3, 5))
    s.track('coro', program=53, pan=64, human=(0, 0), vel_add=6)
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt), b), k) if k else at(prog(txt), b)
    ma, mb, mc = mel(M_A), mel(M_B), mel(M_CH)
    warns += check_melody(ma, prog(A), name='A') + check_melody(mb, prog(B), name='B') + check_melody(mc, prog(CH), name='coro')

    b = s.section('intro', 4)
    c = ch('C | G/B | Am | F', b)
    comp(s, 'piano', c, PULSE, low=60, high=76, n=3, vel=60)
    roots(s, 'piano', c, low=36, high=48, vel=64)

    b = s.section('inicio', 8)
    c = ch(A, b)
    comp(s, 'piano', c, PULSE, low=55, high=72, n=3, vel=58)
    roots(s, 'piano', c, low=36, high=48, vel=62, octave=True)
    melody(s, 'melodia', ma, b, vel=74, transpose=12)
    pad(s, 'cuerdas', c, vel=42); s.cc('cuerdas', b, 11, 80)

    b = s.section('sube', 8)
    c = ch(B, b)
    comp(s, 'piano', c, PULSE, low=55, high=72, n=3, vel=64)
    roots(s, 'piano', c, low=36, high=48, vel=66, octave=True)
    arp(s, 'ostinato', c, pattern=(0, 2, 1, 2), step=0.5, vel=66, bass=(55, 67), span=17, gate=1.0)
    pad(s, 'cuerdas', c, vel=54); s.ramp('cuerdas', b, 32, 11, 80, 120)
    melody(s, 'violines', mb, b, vel=72, transpose=12)
    drums(s, 'bateria', b + 16, 4, TOMS, .8)
    snare_roll(s, 'bateria', b + 28, 4, note=38, start_div=2, end_div=8, v0=40, v1=110)

    def chorus(name, k=0, big=False):
        b = s.section(name, 8)
        c = ch(CH, b, k)
        comp(s, 'piano', c, PULSE, low=55, high=74, n=4, vel=72)
        roots(s, 'bajo', c, low=36, high=48, vel=82, rhythm=[(0, .9, 0), (1, .45, 0), (1.5, .9, 0), (2.5, .45, 0), (3, .9, 0)])
        arp(s, 'ostinato', c, pattern=(0, 2, 1, 2), step=0.5, vel=74, bass=(55, 67), span=17, gate=1.0)
        pad(s, 'cuerdas', c, low=57, high=79, vel=66); s.cc('cuerdas', b, 11, 122)
        melody(s, 'violines', mc, b, vel=86, transpose=k)
        melody(s, 'melodia', mc, b, vel=84, transpose=k - 12)
        melody(s, 'campanas', mc, b, vel=66, transpose=k + 12)
        drums(s, 'kick', b, 8, {36: FULL[36]}); drums(s, 'bateria', b, 8, {x: FULL[x] for x in (38, 39, 42)}, .95)
        s.note('bateria', b, 3, 49, 112)
        if big:
            pad(s, 'coro', c, low=57, high=74, n=3, vel=60)
        return b

    s.meta['hot'] = chorus('coro')
    b = s.section('calma', 8)
    c = ch(A, b)
    comp(s, 'piano', c, PULSE, low=55, high=72, n=3, vel=58)
    roots(s, 'bajo', c, low=36, high=48, vel=66)
    melody(s, 'melodia', ma, b, vel=76, transpose=12)
    pad(s, 'cuerdas', c, vel=48)
    drums(s, 'bateria', b, 8, {42: 'x.o.x.o.x.o.x.o.', 37: '....x.......x...'}, .7)
    drums(s, 'kick', b, 8, {36: 'x.......x.......'}, .8)
    b = s.section('sube2', 8)
    c = ch(B, b)
    comp(s, 'piano', c, PULSE, low=55, high=72, n=3, vel=66)
    roots(s, 'bajo', c, low=36, high=48, vel=74, rhythm=[(i * .5, .45, 0) for i in range(8)])
    arp(s, 'ostinato', c, pattern=(0, 2, 1, 2), step=0.5, vel=70, bass=(55, 67), span=17, gate=1.0)
    pad(s, 'cuerdas', c, vel=58); s.ramp('cuerdas', b, 32, 11, 90, 127)
    melody(s, 'violines', mb, b, vel=76, transpose=12)
    drums(s, 'bateria', b, 8, TOMS, .9)
    snare_roll(s, 'bateria', b + 26, 6, note=38, start_div=2, end_div=8, v0=40, v1=118)
    chorus('coro2', big=True)
    # Puente nuevo y otra subida: la canción dura más de 3 minutos (sirve para el resumen de la película)
    b = s.section('puente', 8)
    c = ch(BRIDGE, b)
    comp(s, 'piano', c, PULSE, low=55, high=72, n=3, vel=60)
    roots(s, 'bajo', c, low=36, high=48, vel=70)
    pad(s, 'cuerdas', c, vel=56); s.cc('cuerdas', b, 11, 100)
    pad(s, 'coro', c, low=57, high=72, n=3, vel=48)
    mp = mel(M_BRIDGE); melody(s, 'violines', mp, b, vel=78, transpose=12); warns += check_melody(mp, prog(BRIDGE), name='puente')
    drums(s, 'kick', b, 8, {36: 'x.......x.......'}, .8); drums(s, 'bateria', b, 8, {42: 'x.o.x.o.x.o.x.o.'}, .6)
    b = s.section('sube3', 8)
    c = ch(B, b)
    comp(s, 'piano', c, PULSE, low=55, high=72, n=3, vel=68)
    roots(s, 'bajo', c, low=36, high=48, vel=76, rhythm=[(i * .5, .45, 0) for i in range(8)])
    arp(s, 'ostinato', c, pattern=(0, 2, 1, 2), step=0.5, vel=74, bass=(55, 67), span=17, gate=1.0)
    pad(s, 'cuerdas', c, vel=60); s.ramp('cuerdas', b, 32, 11, 95, 127)
    melody(s, 'violines', mb, b, vel=80, transpose=12); melody(s, 'campanas', mb, b, vel=58, transpose=24)
    drums(s, 'bateria', b, 8, TOMS, .95)
    snare_roll(s, 'bateria', b + 26, 6, note=38, start_div=2, end_div=8, v0=40, v1=120)
    chorus('coro3', big=True)
    chorus('coro4', k=2, big=True)
    b = s.section('final', 4)
    c = ch('D | A/C# | Bm | G', b)
    comp(s, 'piano', c, PULSE, low=57, high=74, n=3, vel=60)
    pad(s, 'cuerdas', c, vel=56); s.ramp('cuerdas', b, 16, 11, 120, 50)
    melody(s, 'melodia', mel('F#5:1 A5:1 D6:2 | E6:1.5 C#6:.5 A5:2 | B5:1 D6:1 F#6:2 | G6:4'), b, vel=74)
    end = b + 16
    for p in ('D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4'):
        s.note('piano', end, 5, p, 76)
    for p in ('D4', 'F#4', 'A4', 'D5'):
        s.note('cuerdas', end, 6, p, 70)
    s.note('bateria', end, 3, 49, 90)
    s.end_beat = end + 6

    s.mix = {
        'piano': dict(lufs=-22, hp=60, sends={'sala': -12}, air=1.5),
        'melodia': dict(lufs=-22, hp=150, sends={'sala': -9}),
        'cuerdas': dict(lufs=-24.5, hp=140, sends={'sala': -7}),
        'ostinato': dict(lufs=-26, hp=180, sends={'sala': -9}),
        'violines': dict(lufs=-22.5, hp=220, sends={'sala': -6}, air=2),
        'campanas': dict(lufs=-28, hp=600, sends={'sala': -7}),
        'bajo': dict(lufs=-23, hp=35),
        'kick': dict(lufs=-22, hp=35),
        'bateria': dict(lufs=-23, hp=80, sends={'sala': -12}),
        'coro': dict(lufs=-28, hp=200, sends={'sala': -5}),
    }
    marks = dict((n, b) for b, n in s.marks)
    s.master = dict(tone='pop', reverbs={'sala': dict(seconds=2.4, predelay=0.02, bright=0.9)}, tail=4.0,
                    extras=[('audio', s.sec(marks['coro']) - 2.5, riser(2.5, 0.05)), ('audio', s.sec(marks['coro3']) - 2.5, riser(2.5, 0.06)), ('audio', s.sec(marks['coro4']) - 2.5, riser(2.5, 0.06))])
    return s, warns
