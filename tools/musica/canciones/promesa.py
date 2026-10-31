"""Promesa — piano solo, íntimo y con rubato (La bemol mayor); al final lo acompañan las cuerdas."""
from lib import Song, prog, mel, check_melody
from arr import at
from expr import track, perform, pedal, piano_ballad, piano_melody, strings, dyn, mix_orchestra

SF2 = 'musescore'
META = dict(id='promesa', name='Promesa', mood='Piano',
            desc='Piano solo, íntimo y emotivo. Para votos, cartas, agradecimientos y recuerdos.',
            tags=['boda', 'piano', 'romantica', 'agradecimiento', 'recuerdos'])

INTRO = 'Ab | Db/Ab'
A = 'Ab | Eb/G | Fm7 | Db | Ab/C | Db | Bbm7 | Eb7sus4:2 Eb7:2'
B = 'Fm | Db | Ab/C | Eb | Fm | Bbm7 | Db | Eb7'
CODA = 'Ab | Db/Ab | Ab | Ab'

M_A = ('C5:1 Eb5:1 Ab5:1.5 G5:.5 | G5:2 Eb5:1 Bb4:1 | Ab4:1 C5:1 F5:1.5 Eb5:.5 | F5:3 r:1 | '
       'Eb5:1 Ab5:1 C6:1.5 Bb5:.5 | Ab5:2 F5:2 | F5:1 Db5:1 Bb4:1 C5:1 | Bb4:2 G4:2')
M_A2 = ('C5:1 Eb5:1 Ab5:1.5 G5:.5 | G5:2 Eb5:1 Bb4:1 | Ab4:1 C5:1 F5:1.5 Eb5:.5 | F5:3 r:1 | '
        'Eb5:1 Ab5:1 C6:1.5 Bb5:.5 | Ab5:2 F5:2 | Db5:1 F5:1 Ab5:1 G5:1 | Ab5:2 G5:1 Eb5:1')
M_B = ('C6:2 Ab5:1 F5:1 | F5:1.5 Eb5:.5 Db5:2 | Eb5:1 Ab5:1 C6:2 | Bb5:2 G5:2 | '
       'Ab5:1 C6:1 F6:2 | Db6:1.5 C6:.5 Bb5:2 | Ab5:1 F5:1 Db6:2 | G5:2 Bb5:1 Db6:1')
M_CODA = 'Eb5:2 C5:2 | Db5:2 F5:2 | C5:4 | r:4'


def build():
    s = Song(META['id'], bpm=68, meter=4, seed=51)
    track(s, 'piano', 'piano', human=(7, 0), roll=12)
    track(s, 'melodia', 'piano', human=(8, 0), pan=64)
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        track(s, sec, human=(4, 0))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)

    b = s.section('intro', 2)
    c = ch(INTRO, b); piano_ballad(s, 'piano', c, vel=40); pedal(s, 'piano', c)
    s.rit(b + 5, 3, 0.8)

    b = s.section('tema', 8)
    c = ch(A, b); piano_ballad(s, 'piano', c, vel=42); pedal(s, 'piano', c)
    m = mel(M_A); piano_melody(s, 'melodia', m, b, vel=58); warns += check_melody(m, prog(A), 4, name='A')
    s.rit(b + 13, 3, 0.9); s.rit(b + 29, 3, 0.86)

    b = s.section('tema2', 8)
    c = ch(A, b); piano_ballad(s, 'piano', c, vel=44, kind='flow'); pedal(s, 'piano', c)
    m = mel(M_A2); piano_melody(s, 'melodia', m, b, vel=60); warns += check_melody(m, prog(A), 4, name='A2')
    s.rit(b + 29, 3, 0.9)

    b = s.section('centro', 8)
    s.meta['hot'] = b
    c = ch(B, b); piano_ballad(s, 'piano', c, vel=50, kind='flow'); pedal(s, 'piano', c)
    m = mel(M_B); piano_melody(s, 'melodia', m, b, vel=68, octave=True); warns += check_melody(m, prog(B), 4, name='B')
    s.rit(b + 13, 3, 0.92); s.rit(b + 28, 4, 0.82)

    # El tema otra vez, ahora con cuerdas muy suaves
    b = s.section('tema3', 8)
    c = ch(A, b); piano_ballad(s, 'piano', c, vel=46); pedal(s, 'piano', c)
    strings(s, c, vel=34)
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        dyn(s, sec, b, 8, 40, 90)
    m = mel(M_A2); piano_melody(s, 'melodia', m, b, vel=64, octave=True)
    s.rit(b + 29, 3, 0.88)

    b = s.section('final', 4)
    c = ch(CODA, b); piano_ballad(s, 'piano', c[:2], vel=40); pedal(s, 'piano', c)
    strings(s, c[:3], vel=30)
    m = mel(M_CODA); piano_melody(s, 'melodia', m, b, vel=52); warns += check_melody(m, prog(CODA), 4, name='coda')
    end = b + 8
    for k, p in enumerate(['Ab1', 'Eb2', 'Ab2', 'C3', 'Eb3', 'Ab3', 'C4']):
        s.note('piano', end + k * .16, 7.5, p, 40 - k * 2)
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        dyn(s, sec, b, 10, 90, 40)
    s.rit(b + 4, 6, 0.7, back=False)
    s.end_beat = b + 16

    perform(s, phrase_bars=4, lead=('melodia',), sustained=('vln1', 'vln2', 'vla', 'vc', 'cb'), arc=9)
    mix_orchestra(s, lead={'melodia': dict(lufs=-20, hp=90, sends={'sala': -11}, air=1.2)},
                  extra={'piano': dict(lufs=-21.5)}, hall=2.6, tone='balada', lufs=-16)
    return s, warns
