"""Día de fiesta — pop alegre con metales (Sol mayor)."""
from lib import Song, prog, mel, check_melody, riser
from arr import at, pad, roots, melody, comp, strum, drums, snare_roll, fill

META = dict(id='dia-de-fiesta', name='Día de fiesta', mood='Alegre', desc='Pop con metales y palmas, para celebrar.',
            tags=['cumpleaños', 'graduación', 'vlog', 'reel', 'fiesta'])

VERSE = 'G | D/F# | Em | C | G | D/F# | Em | C'
PRE = 'Am | C | D | Dsus4:2 D:2'
CHORUS = 'G | D | Em | C | G | D | C D | G'
BRIDGE = 'Em | C | G | D | Em | C | Am | D'

M_RIFF = ('D5:.5 B4:.5 G4:.5 B4:.5 D5:1 B4:1 | A4:.5 F#4:.5 D4:.5 F#4:.5 A4:1 F#4:1 | E5:.5 B4:.5 G4:.5 B4:.5 E5:1 B4:1 | '
          'E5:.5 C5:.5 G4:.5 C5:.5 E5:1 C5:1')
M_HOOK = ('r:.5 D5:.5 G5:.5 A5:.5 B5:1 A5:.5 G5:.5 | A5:1.5 F#5:.5 D5:1 r:1 | r:.5 E5:.5 G5:.5 A5:.5 B5:1 D6:.5 B5:.5 | G5:1.5 E5:.5 C5:2 | '
          'r:.5 D5:.5 G5:.5 A5:.5 B5:1 A5:.5 G5:.5 | A5:1.5 B5:.5 A5:1 F#5:1 | G5:1 E5:1 F#5:1 A5:1 | G5:3 r:1')
M_BRIDGE = 'B4:2 E5:1 G5:1 | G5:2 E5:2 | D5:2 G5:1 B5:1 | A5:4 | B5:2 G5:1 E5:1 | E5:2 G5:2 | A5:1.5 G5:.5 E5:2 | F#5:4'

GROOVE = {36: 'X.....x.X.......', 38: '....X.......X...', 42: 'x.o.x.o.x.o.x.o.'}
CHORUS_G = {36: 'X.....x.X.....x.', 38: '....X.......X...', 39: '....x.......x...', 42: 'xoxoxoxoxoxoxoxo', 54: '..x...x...x...x.'}
HALF = {36: 'X.......X.......', 38: '........X.......', 42: 'x.o.x.o.x.o.x.o.'}
PUSH = [(0, .9, 6), (1, .4, 0), (1.5, .9, 0), (2.5, .4, 0), (3, .9, 4), (3.5, .4, 0)]
CHOPS = [(.5, .35, 0), (1.5, .35, 0), (2.5, .35, 0), (3.5, .35, 0)]
POP_BASS = [(0, .45, 0), (.5, .45, 0), (1, .45, 0), (1.5, .45, 0), (2, .45, 0), (2.5, .45, 0), (3, .45, 12), (3.5, .45, 0)]
VERSE_BASS = [(0, 1.4, 0), (1.5, .45, 0), (2, .9, 0), (3, .45, 12), (3.5, .45, 7)]


def build():
    s = Song(META['id'], bpm=118, meter=4, seed=31)
    s.track('kick', drum=True, program=0, human=(2, 4))
    s.track('bateria', drum=True, program=0, human=(4, 6))
    s.track('bajo', program=33, pan=64, human=(3, 5), vel_add=6)
    s.track('piano', program=1, pan=48, human=(4, 5), vel_add=6)
    s.track('guitarra', program=25, pan=82, human=(3, 6), vel_add=4)
    s.track('riff', program=27, pan=36, human=(3, 5), vel_add=6)
    s.track('metales', program=61, pan=60, human=(3, 4), vel_add=8)
    s.track('glock', program=9, pan=72, human=(2, 4))
    s.track('pad', program=89, pan=64, human=(0, 0))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    riff = mel(M_RIFF)
    hook = mel(M_HOOK)
    warns += check_melody(riff, prog(VERSE), name='riff', all_notes=True)
    warns += check_melody(hook, prog(CHORUS), name='coro')

    def kick_and_kit(b, bars, pats, vel=1.0):
        drums(s, 'kick', b, bars, {36: pats[36]}, vel)
        drums(s, 'bateria', b, bars, {k: v for k, v in pats.items() if k != 36}, vel)

    b = s.section('intro', 4)
    c = ch('G | D/F# | Em | C', b)
    strum(s, 'guitarra', c, 'D.DU.UDU', vel=70)
    drums(s, 'bateria', b, 4, {39: '....x.......x...'}, .8)
    drums(s, 'kick', b + 8, 2, {36: 'X...X...X...X...'}, .7)

    def verse(name, bars_vel=1.0):
        b = s.section(name, 8)
        c = ch(VERSE, b)
        kick_and_kit(b, 8, GROOVE, .9)
        roots(s, 'bajo', c, low=31, high=43, vel=78, rhythm=VERSE_BASS)
        comp(s, 'piano', c, CHOPS, low=55, high=72, n=3, vel=66)
        melody(s, 'riff', riff, b, vel=72); melody(s, 'riff', riff, b + 16, vel=72)
        fill(s, 'bateria', b + 31, 'snare', .8)
        return b

    def pre(name):
        b = s.section(name, 4)
        c = ch(PRE, b)
        drums(s, 'kick', b, 4, {36: 'X...X...X...X...'}, .9)
        snare_roll(s, 'bateria', b + 8, 8, note=38, start_div=1, end_div=4, v0=50, v1=112)
        roots(s, 'bajo', c, low=31, high=43, vel=80, rhythm=POP_BASS)
        comp(s, 'piano', c, [(0, .9, 6), (1, .9, 0), (2, .9, 4), (3, .9, 0)], low=55, high=74, n=4, vel=70)
        strum(s, 'guitarra', c, 'D.D.D.DU', vel=72)
        pad(s, 'pad', c, vel=50)
        return b

    def chorus(name, glock=False, vel=1.0):
        b = s.section(name, 8)
        c = ch(CHORUS, b)
        kick_and_kit(b, 8, CHORUS_G, vel)
        s.note('bateria', b, 2, 49, 110)
        roots(s, 'bajo', c, low=31, high=43, vel=84, rhythm=POP_BASS)
        comp(s, 'piano', c, PUSH, low=55, high=74, n=4, vel=72)
        strum(s, 'guitarra', c, 'D.DU.UDU', vel=80)
        pad(s, 'pad', c, vel=56)
        melody(s, 'metales', hook, b, vel=96, octave_double=-12)
        if glock:
            melody(s, 'glock', hook, b, vel=80, transpose=12)
        fill(s, 'bateria', b + 31, 'toms', .9)
        return b

    verse('estrofa')
    pre('sube')
    s.meta['hot'] = chorus('coro')
    verse('estrofa2')
    pre('sube2')
    chorus('coro2', glock=True)
    b = s.section('puente', 8)
    c = ch(BRIDGE, b)
    kick_and_kit(b, 8, HALF, .85)
    roots(s, 'bajo', c, low=31, high=43, vel=74, rhythm=[(0, 1.9, 0), (2, 1.9, 0)])
    comp(s, 'piano', c, [(0, 1.9, 4), (2, 1.9, 0)], low=55, high=74, n=4, vel=66)
    pad(s, 'pad', c, vel=60)
    mb = mel(M_BRIDGE); melody(s, 'glock', mb, b, vel=76, transpose=12); melody(s, 'riff', mb, b, vel=70)
    warns += check_melody(mb, prog(BRIDGE), name='puente')
    snare_roll(s, 'bateria', b + 28, 4, note=38, start_div=2, end_div=8, v0=60, v1=118)
    chorus('coro3', glock=True, vel=1.05)
    b = s.section('final', 4)
    c = ch('G | D | C D | G', b)
    kick_and_kit(b, 3, CHORUS_G)
    roots(s, 'bajo', c[:-1], low=31, high=43, vel=84, rhythm=POP_BASS)
    comp(s, 'piano', c[:-1], PUSH, low=55, high=74, n=4, vel=72)
    strum(s, 'guitarra', c[:-1], 'D.DU.UDU', vel=80)
    melody(s, 'metales', mel('r:.5 D5:.5 G5:.5 A5:.5 B5:1 A5:.5 G5:.5 | A5:1.5 F#5:.5 D5:2 | G5:1 E5:1 F#5:1 A5:1 | G5:4'), b, vel=98, octave_double=-12)
    end = b + 12
    for p in ('G2', 'D3', 'G3', 'B3', 'D4', 'G4'):
        s.note('piano', end, 3, p, 96)
    s.note('bajo', end, 3, 'G1', 96); s.note('kick', end, 1, 36, 120); s.note('bateria', end, 3, 49, 118); s.note('bateria', end, 3, 57, 110)
    strum(s, 'guitarra', [(end, 4, prog('G')[0][2])], 'D.......', vel=90)
    s.end_beat = b + 16

    s.mix = {
        'kick': dict(lufs=-21, hp=30, peq=[(60, 3, 1.2)]),
        'bateria': dict(lufs=-22, hp=120, sends={'cuarto': -14}, air=2),
        'bajo': dict(lufs=-21, hp=35, comp=(-20, 3, 0.01, 0.15, 6)),
        'piano': dict(lufs=-24, hp=150, sends={'cuarto': -14}),
        'guitarra': dict(lufs=-24, hp=180, sends={'cuarto': -14}, air=2),
        'riff': dict(lufs=-24, hp=200, sends={'cuarto': -12}),
        'metales': dict(lufs=-21, hp=150, sends={'cuarto': -11}),
        'glock': dict(lufs=-27, hp=500, sends={'cuarto': -9}),
        'pad': dict(lufs=-28, hp=200, sends={'cuarto': -10}),
    }
    marks = dict((n, b) for b, n in s.marks)
    s.master = dict(tone='pop', reverbs={'cuarto': dict(seconds=1.4, predelay=0.012, bright=1.0)}, tail=3.0, glue=(-14, 2.2, 0.02, 0.2, 6),
                    extras=[('audio', s.sec(marks['coro']) - 2, riser(2, 0.05)), ('audio', s.sec(marks['coro2']) - 2, riser(2, 0.05)),
                            ('audio', s.sec(marks['coro3']) - 2, riser(2, 0.06))])
    return s, warns
