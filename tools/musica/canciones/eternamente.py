"""Eternamente — balada de cine: empieza con piano y crece hasta toda la orquesta (Do mayor, sube a Re)."""
from lib import Song, prog, mel, check_melody
from arr import at, tr_chords
from expr import (track, perform, phrase_rit, pedal, piano_ballad, piano_melody, legato, strings, harp, gliss,
                  roll, dyn, mix_orchestra)

SF2 = 'musescore'
META = dict(id='eternamente', name='Eternamente', mood='Épica suave',
            desc='Piano que crece hasta una orquesta completa. Para películas de boda, resumen y entradas.',
            tags=['boda', 'xv', 'resumen', 'cine', 'elegante'])

INTRO = 'C | G/B | Am7 | Fmaj7:2 Gsus4:2'
A = 'C | G/B | Am7 | Em/G | F | C/E | Dm7 | Gsus4:2 G:2'
B = 'Am | F | C | G/B | Am | F | Bb | A7sus4:2 A7:2'
PUENTE = 'Bm | G | Em7 | Asus4:2 A:2'
OUTRO = 'D | G/D | D | D'

M_A = ('E5:1 G5:1 C6:1.5 B5:.5 | B5:2 G5:1 D5:1 | C5:1 E5:1 A5:1.5 G5:.5 | G5:3 r:1 | '
       'A5:1 C6:1 F6:1.5 E6:.5 | E6:2 C6:1 G5:1 | F5:1 A5:1 D6:1.5 C6:.5 | C6:2 B5:2')
M_B = 'E6:2 C6:1 A5:1 | A5:2 C6:1 F6:1 | E6:2 G5:2 | D6:2 B5:2 | C6:1 E6:1 A6:2 | A6:1.5 G6:.5 F6:2 | F6:2 D6:2 | E6:2 C#6:2'
M_PUENTE = 'F#5:2 D5:2 | B4:2 D5:2 | E5:1 G5:1 B5:2 | A5:4'
M_OUTRO = 'F#6:2 E6:1 D6:1 | D6:2 B5:2 | A5:4 | r:4'


def build():
    s = Song(META['id'], bpm=74, meter=4, seed=71)
    track(s, 'piano', 'piano', human=(6, 0), roll=10)
    track(s, 'melodia', 'piano', human=(7, 0), pan=64)
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        track(s, sec, human=(4, 0))
    track(s, 'chelo', human=(5, 0))
    track(s, 'cornos', human=(4, 0))
    track(s, 'arpa', human=(4, 0), roll=6)
    track(s, 'timbal', human=(3, 0))
    track(s, 'coro', human=(3, 0))
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt), b), k) if k else at(prog(txt), b)
    ends = []

    b = s.section('intro', 4)
    c = ch(INTRO, b); piano_ballad(s, 'piano', c, vel=44); pedal(s, 'piano', c)
    s.rit(b + 12, 4, 0.85)

    b = s.section('tema', 8)
    c = ch(A, b); piano_ballad(s, 'piano', c, vel=44); pedal(s, 'piano', c)
    strings(s, c, vel=30, sections=('vla', 'vc', 'cb'))
    m = mel(M_A); piano_melody(s, 'melodia', m, b, vel=60); warns += check_melody(m, prog(A), 4, name='A')
    ends += [b + 16, b + 32]

    b = s.section('tema2', 8)
    c = ch(A, b); piano_ballad(s, 'piano', c, vel=48, kind='flow'); pedal(s, 'piano', c)
    strings(s, c, vel=42, melody_on_v1=True)
    m = mel(M_A); legato(s, 'vln1', m, b, vel=68); legato(s, 'chelo', m, b, vel=44, transpose=-12)
    dyn(s, 'vln1', b, 32, 70, 100)
    ends += [b + 16, b + 32]

    b = s.section('crece', 8)
    c = ch(B, b); piano_ballad(s, 'piano', c, vel=54, kind='flow'); pedal(s, 'piano', c)
    strings(s, c, vel=52, melody_on_v1=True)
    m = mel(M_B); legato(s, 'vln1', m, b, vel=76); warns += check_melody(m, prog(B), 4, name='B')
    for bb, dd, cc in c:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, dd - .1, p, 40)
    dyn(s, 'cornos', b, 32, 50, 110); dyn(s, 'vln1', b, 32, 85, 124)
    roll(s, 'timbal', b + 28, 4, 'A1', 26, 92)
    gliss(s, 'arpa', c[-1][2], b + 30, 2, vel=50)
    s.rit(b + 28, 4, 0.9)

    b = s.section('climax', 8)
    s.meta['hot'] = b
    c = ch(A, b, 2); piano_ballad(s, 'piano', c, vel=60, kind='block'); pedal(s, 'piano', c)
    strings(s, c, vel=60, melody_on_v1=True, high=81)
    m = mel(M_A); legato(s, 'vln1', m, b, vel=88, transpose=2); legato(s, 'chelo', m, b, vel=62, transpose=-10)
    for bb, dd, cc in c:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, dd - .1, p, 50)
        for p in cc.voicing(57, 72, 3):
            s.note('coro', bb, dd - .1, p, 34)
    harp(s, 'arpa', c, vel=42, step=.5)
    s.note('timbal', b, 3, 'D2', 84); s.note('timbal', b + 16, 2, 'D2', 66)
    ends += [b + 16]

    b = s.section('respiro', 4)
    c = ch(PUENTE, b); piano_ballad(s, 'piano', c, vel=42); pedal(s, 'piano', c)
    strings(s, c, vel=36, sections=('vla', 'vc', 'cb'))
    m = mel(M_PUENTE); piano_melody(s, 'melodia', m, b, vel=56); warns += check_melody(m, prog(PUENTE), 4, name='puente')
    s.rit(b + 12, 4, 0.82)

    b = s.section('final', 8)
    c = ch(A, b, 2); piano_ballad(s, 'piano', c, vel=62, kind='block'); pedal(s, 'piano', c)
    strings(s, c, vel=62, melody_on_v1=True, high=81)
    m = mel(M_A); legato(s, 'vln1', m, b, vel=92, transpose=2); legato(s, 'chelo', m, b, vel=64, transpose=-10)
    for bb, dd, cc in c:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, dd - .1, p, 54)
        for p in cc.voicing(57, 72, 3):
            s.note('coro', bb, dd - .1, p, 38)
    harp(s, 'arpa', c, vel=44, step=.5)
    gliss(s, 'arpa', c[0][2], b - 1, 1, vel=50)
    s.note('timbal', b, 3, 'D2', 90)

    b = s.section('cierre', 4)
    c = ch(OUTRO, b); piano_ballad(s, 'piano', c[:2], vel=48); pedal(s, 'piano', c)
    strings(s, c, vel=50, melody_on_v1=True)
    m = mel(M_OUTRO); legato(s, 'vln1', m, b, vel=70); warns += check_melody(m, prog(OUTRO), 4, name='cierre')
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        dyn(s, sec, b + 4, 12, 100, 50)
    end = b + 8
    for k, p in enumerate(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4']):
        s.note('piano', end + k * .14, 7.5, p, 46 - k * 2)
    s.rit(b + 4, 8, 0.72, back=False)
    s.end_beat = b + 16

    phrase_rit(s, ends[1:-1], to=0.96)
    perform(s, phrase_bars=4, lead=('melodia', 'vln1', 'chelo'), sustained=('vln1', 'vln2', 'vla', 'vc', 'cb', 'cornos', 'coro'), arc=8)
    mix_orchestra(s, lead={'melodia': dict(lufs=-21, hp=110, sends={'sala': -10}, air=1.2)}, extra={'coro': dict(lufs=-31)}, hall=3.2)
    return s, warns
