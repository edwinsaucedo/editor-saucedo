"""Primer baile — balada romántica de piano y cuerdas (Re mayor, sube a Mi en el último coro)."""
from lib import Song, prog, mel, check_melody
from arr import at, tr_chords
from expr import (track, perform, phrase_rit, pedal, piano_ballad, piano_melody, legato, strings, harp, gliss,
                  roll, dyn, mix_orchestra)

SF2 = 'musescore'
META = dict(id='primer-baile', name='Primer baile', mood='Balada',
            desc='Piano, chelo y orquesta de cuerdas que crece. Para bodas y momentos emotivos.',
            tags=['boda', 'balada', 'romantica', 'xv', 'elegante'])

INTRO = 'D | A/C# | Bm7 | Gmaj7:2 Asus4:1 A:1'
VERSE = 'D | A/C# | Bm7 | F#m/A | G | D/F# | Em7 | Asus4:2 A:2'
CHORUS = 'G | A | F#m7 | Bm7 | Em7 | A/G | F#m7:2 B7:2 | Em7:2 A7:2'
BRIDGE = 'Bm | Gmaj7 | Em7 | F#7sus4:2 B7:2'
OUTRO = 'E | B/D# | C#m7 | Amaj7:2 Bsus4:1 B:1 | E | E'

M_VERSE = ('F#4:1 A4:1 D5:1.5 E5:.5 | E5:2 C#5:1 A4:1 | D5:1.5 C#5:.5 B4:2 | A4:3 r:1 | '
           'B4:1 D5:1 G5:1.5 F#5:.5 | F#5:2 E5:1 D5:1 | E5:1.5 D5:.5 B4:1 G4:1 | A4:3 r:1')
M_CHORUS = ('D5:.5 G5:.5 B5:2 A5:1 | C#6:1.5 B5:.5 A5:2 | A5:1 C#6:1 E6:1.5 D6:.5 | D6:2 B5:2 | '
            'B5:1 G5:1 E6:1.5 D6:.5 | C#6:2 A5:1 E5:1 | A5:1.5 C#6:.5 B5:1 A5:1 | G5:2 E5:1 C#5:1')
M_BRIDGE = 'F#5:1 B5:1 D6:2 | D6:1.5 B5:.5 F#5:2 | G5:1 B5:1 E6:2 | E6:2 D#6:2'
M_OUTRO = 'G#5:1 B5:1 E6:2 | D#6:2 B5:2 | C#6:1.5 B5:.5 G#5:2 | A5:2 B5:2 | G#5:4 | r:4'


def build():
    s = Song(META['id'], bpm=66, meter=4, seed=41)
    track(s, 'piano', 'piano_suave', human=(6, 0), roll=10)
    track(s, 'melodia', 'piano_suave', human=(7, 0), pan=66)
    track(s, 'chelo', human=(6, 0))
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        track(s, sec, human=(4, 0))
    track(s, 'arpa', human=(4, 0), roll=6)
    track(s, 'cornos', human=(4, 0))
    track(s, 'timbal', human=(3, 0))
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt), b), k) if k else at(prog(txt), b)
    ends = []

    b = s.section('intro', 4)
    c = ch(INTRO, b); piano_ballad(s, 'piano', c, vel=46); pedal(s, 'piano', c)
    s.rit(b + 13, 3, 0.85); ends.append(b + 16)

    # Estrofa: piano y voz del piano, el chelo apenas
    b = s.section('estrofa', 8)
    c = ch(VERSE, b); piano_ballad(s, 'piano', c, vel=46); pedal(s, 'piano', c)
    m = mel(M_VERSE); piano_melody(s, 'melodia', m, b, vel=62); warns += check_melody(m, prog(VERSE), 4, name='estrofa')
    strings(s, c[4:], vel=34, sections=('vc', 'cb'))
    ends += [b + 16, b + 32]

    # Coro: entran las cuerdas, el chelo canta debajo
    b = s.section('coro', 8)
    c = ch(CHORUS, b); piano_ballad(s, 'piano', c, vel=52, kind='flow'); pedal(s, 'piano', c)
    strings(s, c, vel=44)
    m = mel(M_CHORUS); piano_melody(s, 'melodia', m, b, vel=68); legato(s, 'chelo', m, b, vel=46, transpose=-12)
    warns += check_melody(m, prog(CHORUS), 4, name='coro')
    dyn(s, 'vln1', b, 16, 70, 100); dyn(s, 'vln2', b, 16, 70, 100)
    ends += [b + 16, b + 32]

    # Estrofa 2: el chelo toma la melodía
    b = s.section('estrofa2', 8)
    c = ch(VERSE, b); piano_ballad(s, 'piano', c, vel=46); pedal(s, 'piano', c)
    strings(s, c, vel=38, sections=('vln2', 'vla', 'cb'))
    m = mel(M_VERSE); legato(s, 'chelo', m, b, vel=64)
    ends += [b + 16, b + 32]

    # Coro 2: los violines cantan, arpa
    b = s.section('coro2', 8)
    s.meta['hot'] = b
    c = ch(CHORUS, b); piano_ballad(s, 'piano', c, vel=54, kind='flow'); pedal(s, 'piano', c)
    strings(s, c, vel=48, melody_on_v1=True)
    m = mel(M_CHORUS); legato(s, 'vln1', m, b, vel=74); piano_melody(s, 'melodia', m, b, vel=56)
    harp(s, 'arpa', c[::2], vel=38, step=.5)
    gliss(s, 'arpa', c[0][2], b - 1, 1, vel=44)
    ends += [b + 16, b + 32]

    # Puente: prepara la subida
    b = s.section('puente', 4)
    c = ch(BRIDGE, b); piano_ballad(s, 'piano', c, vel=50); pedal(s, 'piano', c)
    strings(s, c, vel=50, melody_on_v1=True)
    m = mel(M_BRIDGE); legato(s, 'vln1', m, b, vel=72); warns += check_melody(m, prog(BRIDGE), 4, name='puente')
    dyn(s, 'vln1', b, 16, 85, 122); dyn(s, 'vla', b, 16, 85, 120)
    roll(s, 'timbal', b + 12, 4, 'B1', 24, 80)
    gliss(s, 'arpa', c[-1][2], b + 14, 2, vel=48)
    s.rit(b + 12, 4, 0.88)

    # Último coro en Mi: toda la orquesta
    b = s.section('coro3', 8)
    c = ch(CHORUS, b, 2); piano_ballad(s, 'piano', c, vel=58, kind='block'); pedal(s, 'piano', c)
    strings(s, c, vel=56, melody_on_v1=True, high=81)
    m = mel(M_CHORUS); legato(s, 'vln1', m, b, vel=84, transpose=2); legato(s, 'chelo', m, b, vel=58, transpose=-10)
    for bb, dd, cc in c:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, dd - .1, p, 44)
    harp(s, 'arpa', c, vel=40, step=.5)
    s.note('timbal', b, 2, 'E2', 64)
    ends += [b + 16]

    # Final: el piano cierra
    b = s.section('final', 6)
    c = ch(OUTRO, b); piano_ballad(s, 'piano', c[:4], vel=46); pedal(s, 'piano', c)
    strings(s, c, vel=44, melody_on_v1=True)
    m = mel(M_OUTRO); legato(s, 'vln1', m, b, vel=64); piano_melody(s, 'melodia', m, b, vel=54)
    warns += check_melody(m, prog(OUTRO), 4, name='final')
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        dyn(s, sec, b + 12, 12, 100, 55)
    end = b + 16
    for k, p in enumerate(['E2', 'B2', 'E3', 'G#3', 'B3', 'E4', 'G#4']):
        s.note('piano', end + k * .14, 7, p, 44 - k * 2)
    s.cc('piano', end, 64, 127)
    s.rit(b + 12, 6, 0.72, back=False)
    s.end_beat = b + 24

    phrase_rit(s, ends[1:-1], to=0.96)
    perform(s, phrase_bars=4, lead=('melodia', 'vln1', 'chelo'), sustained=('vln1', 'vln2', 'vla', 'vc', 'cb', 'cornos'))
    mix_orchestra(s, lead={'melodia': dict(lufs=-21, hp=120, sends={'sala': -10}, air=1.5)}, hall=2.9, tone='balada')
    return s, warns
