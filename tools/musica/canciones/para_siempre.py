"""Para siempre — balada romántica de piano y cuerdas (Mi bemol, sube a Fa en el último coro)."""
from lib import Song, prog, mel, check_melody, riser
from arr import at, tr_chords, arp, pad, roots, melody, counter, pedal, roll, swell

META = dict(id='para-siempre', name='Para siempre', mood='Romántica', desc='Piano y cuerdas, tierna y elegante.',
            tags=['boda', 'xv', 'save the date', 'agradecimiento', 'resumen'])

INTRO = 'Eb | Bb/D | Cm | Ab:2 Bbsus4:1 Bb:1'
VERSE = 'Eb | Bb/D | Cm | Gm/Bb | Ab | Eb/G | Fm7 | Bbsus4 Bb'
PRE = 'Ab | Bb | Gm | Cm | Ab | Bb | Eb/G | Ab Bb'
CHORUS = 'Eb | Bb/D | Cm | Ab | Eb/G | Ab | Fm7 | Bbsus4 Bb7'
BRIDGE = 'Cm | Ab | Fm7 | C7sus4 C7'
OUTRO = 'F | C/E | Dm | Bb:2 Csus4:1 C:1 | F | F'

M_VERSE = ('Bb4:.5 Eb5:.5 G5:2 F5:.5 Eb5:.5 | F5:1.5 D5:.5 Bb4:2 | C5:.5 Eb5:.5 G5:1.5 Ab5:.5 G5:1 | G5:1 F5:.5 D5:.5 Bb4:2 | '
           'C5:.5 Eb5:.5 Ab5:2 G5:.5 F5:.5 | G5:1.5 F5:.5 Eb5:2 | Ab5:1 G5:.5 F5:.5 Eb5:1 C5:1 | Eb5:2 D5:2')
M_PRE = ('r:1 C5:.5 Eb5:.5 Ab5:1 G5:1 | F5:2 D5:1 Bb4:1 | r:1 Bb4:.5 D5:.5 G5:1 F5:1 | Eb5:3 r:1 | '
         'r:1 C5:.5 Eb5:.5 Ab5:1 Bb5:1 | C6:1 Bb5:1 F5:2 | G5:1 Bb5:1 Eb6:2 | C6:2 D6:2')
M_CHORUS = ('G5:.5 Bb5:.5 Eb6:2 D6:.5 Bb5:.5 | D6:1.5 C6:.5 Bb5:2 | C6:.5 Bb5:.5 G5:1.5 Ab5:.5 Bb5:1 | C6:1 Bb5:.5 Ab5:.5 Ab5:2 | '
            'G5:.5 Bb5:.5 Eb6:1.5 F6:.5 G6:1 | Eb6:1 C6:1 Ab5:2 | Ab5:.5 C6:.5 Eb6:1.5 C6:.5 Ab5:1 | Bb5:2 Ab5:1 F5:1')
M_BRIDGE = 'Eb6:2 D6:1 C6:1 | C6:3 Bb5:1 | Ab5:2 G5:1 F5:1 | F5:2 E5:2'
M_END = 'A5:.5 C6:.5 F6:3 | E6:1.5 D6:.5 C6:2 | D6:.5 C6:.5 A5:3 | Bb5:2 G5:1 E5:1 | F5:4 | r:4'


def build():
    s = Song(META['id'], bpm=72, meter=4, seed=11)
    s.track('piano', program=0, pan=58, human=(7, 5), vel_add=16)
    s.track('melodia', program=0, pan=70, human=(9, 6), vel_add=12)
    s.track('cuerdas', program=49, pan=64, human=(0, 0), vel_add=14)
    s.track('chelo', program=42, pan=52, human=(0, 3), vel_add=10)
    s.track('contra', program=49, pan=84, human=(0, 0), vel_add=14)
    s.track('coro', program=52, pan=64, human=(0, 0))
    s.track('timbal', program=47, pan=64, human=(3, 4))
    warns = []

    def chords(txt, start, k=0):
        c = at(prog(txt), start)
        return tr_chords(c, k) if k else c

    # Introducción: piano solo
    b = s.section('intro', 4)
    c = chords(INTRO, b); arp(s, 'piano', c, vel=52); pedal(s, 'piano', c)

    # Estrofa 1
    b = s.section('estrofa', 8)
    c = chords(VERSE, b); arp(s, 'piano', c, vel=50); pedal(s, 'piano', c)
    m = mel(M_VERSE); melody(s, 'melodia', m, b, vel=72); warns += check_melody(m, prog(VERSE), 4, name='estrofa')

    # Pre-coro: entran cuerdas y chelo
    b = s.section('pre', 8)
    c = chords(PRE, b); arp(s, 'piano', c, vel=55); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=52); swell(s, 'cuerdas', b, 32, 55, 100)
    roots(s, 'chelo', c, low=36, high=50, vel=58)
    m = mel(M_PRE); melody(s, 'melodia', m, b, vel=76); warns += check_melody(m, prog(PRE), 4, name='pre')

    # Coro 1
    b = s.section('coro', 8)
    s.meta['hot'] = b
    c = chords(CHORUS, b); arp(s, 'piano', c, vel=62, accent=10); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=66); s.cc('cuerdas', b, 11, 110)
    roots(s, 'chelo', c, vel=66, octave=True)
    counter(s, 'contra', c, 'Bb5', low=67, high=82, vel=50)
    m = mel(M_CHORUS); melody(s, 'melodia', m, b, vel=86, octave_double=-12); warns += check_melody(m, prog(CHORUS), 4, name='coro')

    # Estrofa 2 (más suave, con línea de cuerdas)
    b = s.section('estrofa2', 8)
    c = chords(VERSE, b); arp(s, 'piano', c, vel=50); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=44); s.cc('cuerdas', b, 11, 80)
    roots(s, 'chelo', c, vel=50)
    m = mel(M_VERSE); melody(s, 'melodia', m, b, vel=74)

    # Pre-coro 2 con redoble de timbal
    b = s.section('pre2', 8)
    c = chords(PRE, b); arp(s, 'piano', c, vel=58); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=58); swell(s, 'cuerdas', b, 32, 70, 120)
    roots(s, 'chelo', c, vel=62)
    counter(s, 'contra', c, 'G5', low=65, high=80, vel=46, per_bar=1)
    m = mel(M_PRE); melody(s, 'melodia', m, b, vel=78)
    roll(s, 'timbal', b + 28, 4, 'Bb2', 30, 96)

    # Coro 2 con coro de voces
    b = s.section('coro2', 8)
    c = chords(CHORUS, b); arp(s, 'piano', c, vel=64, accent=10); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=70); s.cc('cuerdas', b, 11, 118)
    roots(s, 'chelo', c, vel=68, octave=True)
    pad(s, 'coro', c, low=55, high=72, n=3, vel=48)
    counter(s, 'contra', c, 'Bb5', low=67, high=82, vel=54)
    m = mel(M_CHORUS); melody(s, 'melodia', m, b, vel=88, octave_double=-12)
    s.note('timbal', b, 2, 'Eb2', 92)

    # Puente: prepara la subida a Fa
    b = s.section('puente', 4)
    c = chords(BRIDGE, b); arp(s, 'piano', c, vel=56); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=56); swell(s, 'cuerdas', b, 16, 70, 124)
    roots(s, 'chelo', c, vel=60)
    m = mel(M_BRIDGE); melody(s, 'melodia', m, b, vel=80); warns += check_melody(m, prog(BRIDGE), 4, name='puente')
    roll(s, 'timbal', b + 12, 4, 'C2', 34, 104)

    # Último coro en Fa
    b = s.section('coro3', 8)
    c = chords(CHORUS, b, 2); arp(s, 'piano', c, vel=68, accent=12); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=74); s.cc('cuerdas', b, 11, 124)
    roots(s, 'chelo', c, vel=72, octave=True)
    pad(s, 'coro', c, low=57, high=74, n=3, vel=56)
    counter(s, 'contra', c, 'C6', low=69, high=84, vel=58)
    m = mel(M_CHORUS); melody(s, 'melodia', m, b, vel=92, octave_double=-12, transpose=2)
    s.note('timbal', b, 2, 'F2', 100); s.note('timbal', b + 16, 2, 'F2', 84)

    # Final: el piano se queda solo y cierra en Fa
    b = s.section('final', 6)
    c = chords(OUTRO, b); arp(s, 'piano', c[:-2], vel=54); pedal(s, 'piano', c)
    pad(s, 'cuerdas', c, vel=50); s.ramp('cuerdas', b, 24, 11, 110, 40)
    roots(s, 'chelo', c[:-1], vel=50)
    m = mel(M_END); melody(s, 'melodia', m, b, vel=70)
    end = b + 16
    for k, p in enumerate(['F2', 'C3', 'F3', 'A3', 'C4', 'F4', 'A4']):
        s.note('piano', end + k * 0.09, 7.5 - k * 0.09, p, 58 - k * 2)
    s.cc('piano', end, 64, 127)
    s.end_beat = b + 24

    s.mix = {
        'piano': dict(lufs=-22, hp=60, sends={'sala': -11}, air=1.5),
        'melodia': dict(lufs=-19.5, hp=120, sends={'sala': -9}, air=2),
        'cuerdas': dict(lufs=-24.5, hp=140, sends={'sala': -6}),
        'chelo': dict(lufs=-27, hp=45, sends={'sala': -9}),
        'contra': dict(lufs=-27.5, hp=200, sends={'sala': -5}),
        'coro': dict(lufs=-29, hp=180, sends={'sala': -4}),
        'timbal': dict(lufs=-28, hp=40, sends={'sala': -7}),
    }
    s.master = dict(tone='balada', reverbs={'sala': dict(seconds=2.9, predelay=0.025, bright=0.8)}, tail=5.0,
                    extras=[('audio', s.sec(s.marks[[n for _, n in s.marks].index('coro3')][0]) - 3.0, riser(3.0, 0.05, f0=1500, f1=12000))])
    return s, warns
