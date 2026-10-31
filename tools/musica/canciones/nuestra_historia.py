"""Nuestra historia — cinematográfica y emotiva (Re menor, termina en Re mayor)."""
from lib import Song, prog, mel, check_melody, riser, impact
from arr import at, arp, pad, roots, melody, roll, swell, drums, chord_at

SF2 = 'musescore'   # banco MuseScore General: piano y cuerdas grabados
META = dict(id='nuestra-historia', name='Nuestra historia', mood='De película', desc='Cuerdas, cornos y tambores que crecen, como tráiler de cine.',
            tags=['save the date', 'boda', 'cuenta regresiva', 'resumen', 'película'])

INTRO = 'Dm | Bb | F | C'
A = 'Dm | Bb | F | C | Dm | Bb | Gm | A'
CLIMAX = 'Bb | C | Am | Dm | Bb | C | Dsus4 | D'
FINAL = 'Bb | C | Dm | F | Bb | C | Dsus4 | D'

M_A = 'D4:1.5 E4:.5 F4:2 | D4:2 C4:1 Bb3:1 | A3:1.5 C4:.5 F4:2 | E4:3 r:1 | D4:1.5 E4:.5 F4:1 A4:1 | Bb4:2 A4:1 F4:1 | G4:1.5 F4:.5 D4:2 | E4:2 C#4:2'
M_C = 'D5:2 F5:1 E5:1 | E5:2 G5:2 | E5:1.5 D5:.5 C5:2 | D5:4 | D5:2 F5:1 Bb5:1 | A5:2 G5:2 | A5:4 | F#5:4'
M_PIANO = 'A5:.5 F5:.5 D5:.5 F5:.5 A5:.5 F5:.5 D5:.5 F5:.5 | Bb5:.5 F5:.5 D5:.5 F5:.5 Bb5:.5 F5:.5 D5:.5 F5:.5 | A5:.5 F5:.5 C5:.5 F5:.5 A5:.5 F5:.5 C5:.5 F5:.5 | G5:.5 E5:.5 C5:.5 E5:.5 G5:.5 E5:.5 C5:.5 E5:.5'

M_PIANO2 = 'A5:.5 F5:.5 D5:.5 F5:.5 A5:.5 F5:.5 D5:.5 F5:.5 | Bb5:.5 F5:.5 D5:.5 F5:.5 Bb5:.5 F5:.5 D5:.5 F5:.5 | Bb5:.5 G5:.5 D5:.5 G5:.5 Bb5:.5 G5:.5 D5:.5 G5:.5 | A5:.5 E5:.5 C#5:.5 E5:.5 A5:.5 E5:.5 C#5:.5 E5:.5'

EPIC = {36: 'X.....x.X.....x.', 41: '........x...x...', 45: '....x.......x.x.'}
EPIC_FULL = {36: 'X..x..x.X..x..x.', 41: 'x...x...x...x.x.', 45: '..x...x...x...xx', 38: '....X.......X...'}


def build():
    s = Song(META['id'], bpm=90, meter=4, seed=21)
    s.track('piano', program=0, pan=70, human=(5, 4), vel_add=10)
    s.track('ostinato', program=48, pan=56, human=(2, 5), vel_add=6, legato=0.55)
    s.track('cuerdas', program=49, pan=64, human=(0, 0), vel_add=12)
    s.track('graves', program=42, pan=48, human=(0, 3), vel_add=10)
    s.track('melodia', program=60, pan=64, human=(0, 3), vel_add=8)
    s.track('violines', program=49, pan=74, human=(0, 0), vel_add=12)
    s.track('coro', program=52, pan=64, human=(0, 0), vel_add=4)
    s.track('timbal', program=47, pan=60, human=(2, 4))
    s.track('perc', drum=True, program=48, pan=64, human=(3, 5))
    s.track('taiko', program=116, pan=64, human=(3, 5), vel_add=6)
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    piano_motif = mel(M_PIANO)
    piano_motif2 = mel(M_PIANO2)

    b = s.section('intro', 4)
    c = ch(INTRO, b)
    melody(s, 'piano', piano_motif, b, vel=58, accent_long=0)
    s.note('graves', b, 16, 'D2', 50); swell(s, 'graves', b, 16, 40, 100)
    pad(s, 'cuerdas', c, vel=36); swell(s, 'cuerdas', b, 16, 30, 80)

    b = s.section('historia', 8)
    c = ch(A, b)
    melody(s, 'piano', piano_motif, b, vel=52, accent_long=0); melody(s, 'piano', piano_motif2, b + 16, vel=52, accent_long=0)
    warns += check_melody(piano_motif + [(x + 16, d, p) for x, d, p in piano_motif2], prog(A), name='piano')
    pad(s, 'cuerdas', c, vel=46); s.cc('cuerdas', b, 11, 90)
    roots(s, 'graves', c, low=31, high=43, vel=56)
    m = mel(M_A); melody(s, 'violines', m, b, vel=68, transpose=12); warns += check_melody(m, prog(A), name='A')

    b = s.section('pulso', 8)
    c = ch(A, b)
    arp(s, 'ostinato', c, pattern=(0, 2, 3, 2, 1, 2, 3, 2), step=0.5, vel=70, bass=(50, 62), span=20, gate=1.0)
    pad(s, 'cuerdas', c, vel=54); swell(s, 'cuerdas', b, 32, 80, 115)
    roots(s, 'graves', c, low=31, high=43, vel=64, octave=True)
    melody(s, 'melodia', m, b, vel=76, transpose=12)
    drums(s, 'taiko', b, 8, {36: EPIC[36]}, vel=.85)
    drums(s, 'perc', b, 8, {41: EPIC[41], 45: EPIC[45]}, vel=.7)
    roll(s, 'timbal', b + 28, 4, 'A2', 30, 100)

    b = s.section('cumbre', 8)
    s.meta['hot'] = b
    c = ch(CLIMAX, b)
    arp(s, 'ostinato', c, pattern=(0, 2, 3, 2, 1, 2, 3, 2), step=0.5, vel=82, bass=(50, 62), span=20, gate=1.0)
    pad(s, 'cuerdas', c, low=57, high=79, vel=70); s.cc('cuerdas', b, 11, 124)
    roots(s, 'graves', c, low=31, high=43, vel=72, octave=True)
    m2 = mel(M_C); melody(s, 'melodia', m2, b, vel=92, octave_double=-12); melody(s, 'violines', m2, b, vel=78, transpose=12)
    warns += check_melody(m2, prog(CLIMAX), name='cumbre')
    pad(s, 'coro', c, low=57, high=74, n=3, vel=58)
    drums(s, 'taiko', b, 8, {36: EPIC_FULL[36]})
    drums(s, 'perc', b, 8, {41: EPIC_FULL[41], 45: EPIC_FULL[45], 38: EPIC_FULL[38]}, vel=.85)
    s.note('perc', b, 4, 49, 110); s.note('perc', b + 16, 4, 57, 96)
    for k in range(0, 32, 8):
        s.note('timbal', b + k, 2, chord_at(c, b + k).near(chord_at(c, b + k).bass, 38), 92)

    b = s.section('respiro', 8)
    c = ch(A, b)
    melody(s, 'piano', piano_motif, b, vel=56, accent_long=0); melody(s, 'piano', piano_motif2, b + 16, vel=56, accent_long=0)
    pad(s, 'coro', c, low=57, high=72, n=3, vel=52)
    pad(s, 'cuerdas', c, vel=44); s.cc('cuerdas', b, 11, 80)
    roots(s, 'graves', c, low=31, high=43, vel=52)
    melody(s, 'violines', m, b, vel=64, transpose=12)
    snare = b + 28
    roll(s, 'timbal', snare, 4, 'A2', 34, 108)

    b = s.section('final', 8)
    c = ch(FINAL, b)
    arp(s, 'ostinato', c, pattern=(0, 2, 3, 2, 1, 2, 3, 2), step=0.5, vel=88, bass=(50, 62), span=20, gate=1.0)
    pad(s, 'cuerdas', c, low=57, high=81, n=5, vel=76); s.cc('cuerdas', b, 11, 127)
    roots(s, 'graves', c, low=31, high=43, vel=78, octave=True)
    m3 = mel(M_C.replace('E5:1.5 D5:.5 C5:2 | D5:4', 'F5:1.5 E5:.5 D5:2 | A5:4')); melody(s, 'melodia', m3, b, vel=98, octave_double=-12)
    melody(s, 'violines', m3, b, vel=84, transpose=12)
    warns += check_melody(m3, prog(FINAL), name='final')
    pad(s, 'coro', c, low=57, high=76, n=4, vel=66)
    drums(s, 'taiko', b, 8, {36: EPIC_FULL[36]})
    drums(s, 'perc', b, 8, {41: EPIC_FULL[41], 45: EPIC_FULL[45], 38: EPIC_FULL[38]})
    s.note('perc', b, 4, 49, 118)
    for k in range(0, 32, 4):
        s.note('timbal', b + k, 1, chord_at(c, b + k).near(chord_at(c, b + k).bass, 38), 84 + (10 if k % 8 == 0 else 0))

    b = s.section('cierre', 3)
    for p in ('D2', 'A2', 'D3', 'F#3', 'A3', 'D4'):
        s.note('cuerdas', b, 9, p, 80)
    for p in ('D3', 'A3', 'D4', 'F#4'):
        s.note('melodia', b, 6, p, 90)
    for p in ('D4', 'F#4', 'A4'):
        s.note('coro', b, 8, p, 70)
    s.note('graves', b, 9, 'D2', 80)
    s.note('taiko', b, 2, 36, 120); s.note('perc', b, 4, 49, 120); s.note('perc', b, 4, 57, 110)
    s.note('timbal', b, 1, 'D2', 110)
    s.ramp('cuerdas', b + 2, 8, 11, 127, 20)
    s.end_beat = b + 12

    s.mix = {
        'piano': dict(lufs=-23, hp=200, sends={'sala': -9}, air=1.5),
        'ostinato': dict(lufs=-24, hp=150, sends={'sala': -9}),
        'cuerdas': dict(lufs=-24, hp=120, sends={'sala': -6}),
        'graves': dict(lufs=-25, hp=35, sends={'sala': -10}),
        'melodia': dict(lufs=-21, hp=110, sends={'sala': -6}),
        'violines': dict(lufs=-22.5, hp=250, sends={'sala': -5}, air=2),
        'coro': dict(lufs=-27, hp=180, sends={'sala': -4}),
        'timbal': dict(lufs=-26, hp=35, sends={'sala': -7}),
        'perc': dict(lufs=-25, hp=50, sends={'sala': -8}),
        'taiko': dict(lufs=-23, hp=35, sends={'sala': -9}),
    }
    cumbre = s.marks[3][0]
    final = s.marks[5][0]
    cierre = s.marks[6][0]
    s.master = dict(tone='orquesta', reverbs={'sala': dict(seconds=3.2, predelay=0.03, bright=0.8)}, tail=6.0, glue=(-15, 2.0, 0.03, 0.3, 6),
                    extras=[('audio', s.sec(cumbre) - 3, riser(3, 0.06)), ('audio', s.sec(final) - 3, riser(3, 0.07)),
                            ('audio', s.sec(cumbre), impact(0.22)), ('audio', s.sec(cierre), impact(0.3))])
    # Interpretación: menos "robot" (dinámica por frase, acordes escalonados, cuerdas que respiran, final más lento)
    from expr import perform
    for t in s.tracks.values():
        t.human = (t.human[0], min(t.human[1], 2))
        if t.program in (0, 46):
            t.roll = 8
    last = max(b for t in s.tracks.values() for b, d, p, v in t.notes)
    s.rit(last - 2 * s.meter, 2 * s.meter, 0.84, back=False)
    perform(s, phrase_bars=4, lead=('melodia', 'violines'), sustained=('cuerdas', 'violines', 'coro'))
    s.master['tone_max'] = 3.0
    return s, warns
