"""Vals de la luna — vals lento de piano y cuerdas (Fa mayor, sube a Sol en el final)."""
from lib import Song, prog, mel, check_melody
from arr import at, tr_chords
from expr import (track, perform, phrase_rit, pedal, piano_waltz, piano_melody, legato, strings, harp, gliss,
                  roll, dyn, mix_orchestra)

SF2 = 'musescore'
META = dict(id='vals-de-la-luna', name='Vals de la luna', mood='Vals lento',
            desc='Piano y cuerdas, tierno y elegante. Para el vals de XV y el primer baile.',
            tags=['vals', 'xv', 'boda', 'elegante', 'romantica'])

INTRO = 'F | Bbmaj7 | Gm7 | C7'
A = 'F | F/A | Bb | C7 | Dm | Bbmaj7 | Gm7 | C7 | F | F7/A | Bb | Bbm6 | F/C | D7 | Gm7:2 C7:1 | F'
B = 'Dm | Dm/C | Bbmaj7 | A7 | Gm | C7 | Fmaj7 | F7 | Bb | C | Am7 | Dm | Gm7 | Bb/C | C7 | C7'
PUENTE = 'Bbmaj7 | C | Am7 | Dm | Ebmaj7 | Cm7 | Am7 | D7'
CODA = 'G | Em7 | Cmaj7 | D7sus4:2 D7:1 | G | C/G | G | G'

M_INTRO = 'A5:2 C6:1 | D6:3 | Bb5:2 A5:1 | G5:3'
M_A = ('C5:2 F5:1 | A5:3 | G5:2 F5:1 | E5:3 | F5:2 A5:1 | D6:2 C6:1 | Bb5:2 A5:1 | G5:3 | '
       'C5:2 F5:1 | A5:2 C6:1 | D6:3 | Db6:2 Bb5:1 | A5:2 F5:1 | F#5:2 A5:1 | G5:2 E5:1 | F5:3')
M_B = ('A5:2 D6:1 | A5:2 F5:1 | D6:2 C6:1 | C#6:3 | D6:2 Bb5:1 | C6:2 Bb5:1 | A5:3 | C6:2 A5:1 | '
       'Bb5:1 D6:1 F6:1 | E6:3 | E6:2 C6:1 | D6:2 A5:1 | Bb5:2 G5:1 | F5:1 G5:1 A5:1 | Bb5:3 | G5:2 E5:1')
M_PUENTE = 'D6:2 C6:1 | E6:2 C6:1 | C6:2 E6:1 | D6:2 A5:1 | G5:2 Bb5:1 | Eb6:2 C6:1 | C6:2 A5:1 | F#5:2 A5:1'
M_CODA = 'D6:3 | B5:3 | E6:2 D6:1 | C6:2 A5:1 | B5:3 | C6:3 | B5:3 | r:3'


def build():
    s = Song(META['id'], bpm=84, meter=3, seed=31)
    track(s, 'piano', 'piano_suave', human=(5, 0), roll=9)
    track(s, 'melodia', 'piano_suave', human=(6, 0), pan=66)
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        track(s, sec, human=(4, 0))
    track(s, 'chelo', human=(5, 0))
    track(s, 'flauta', human=(5, 0))
    track(s, 'arpa', human=(4, 0), roll=6)
    track(s, 'cornos', human=(4, 0))
    track(s, 'timbal', human=(3, 0))
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt, 3), b), k) if k else at(prog(txt, 3), b)
    ends = []

    # Introducción: piano solo, libre
    b = s.section('intro', 4)
    c = ch(INTRO, b); piano_waltz(s, 'piano', c, vel=46, variant=3); pedal(s, 'piano', c)
    m = mel(M_INTRO, 3); piano_melody(s, 'melodia', m, b, vel=56); warns += check_melody(m, prog(INTRO, 3), 3, name='intro')
    s.rit(b + 9, 3, 0.82); ends.append(b + 12)

    # A: el piano canta, las cuerdas entran muy suaves
    b = s.section('vals', 16)
    c = ch(A, b); piano_waltz(s, 'piano', c, vel=48); pedal(s, 'piano', c)
    strings(s, c, vel=36, sections=('vla', 'vc', 'cb')); dyn(s, 'vla', b, 6, 60, 85)
    m = mel(M_A, 3); piano_melody(s, 'melodia', m, b, vel=62); warns += check_melody(m, prog(A, 3), 3, name='A')
    ends += [b + 24, b + 48]

    # B: los violines toman la melodía, el chelo contesta
    b = s.section('vals-b', 16)
    c = ch(B, b); piano_waltz(s, 'piano', c, vel=46, variant=1); pedal(s, 'piano', c)
    strings(s, c, vel=42, melody_on_v1=True)
    m = mel(M_B, 3); legato(s, 'vln1', m, b, vel=66); warns += check_melody(m, prog(B, 3), 3, name='B')
    for k in (0, 24):
        gliss(s, 'arpa', c[k // 3][2], b + k, 1.5, vel=42)
    ends += [b + 24, b + 48]

    # A completa: violines con la melodía, chelo en contracanto, arpa
    b = s.section('vals-pleno', 16)
    s.meta['hot'] = b
    c = ch(A, b); piano_waltz(s, 'piano', c, vel=50, variant=2); pedal(s, 'piano', c)
    strings(s, c, vel=48, melody_on_v1=True)
    m = mel(M_A, 3); legato(s, 'vln1', m, b, vel=74)
    legato(s, 'chelo', mel(M_A, 3), b, vel=50, transpose=-12)
    harp(s, 'arpa', c[::2], vel=40)
    dyn(s, 'vln1', b, 24, 80, 110)
    ends += [b + 24, b + 48]

    # Puente: sube hacia Sol
    b = s.section('puente', 8)
    c = ch(PUENTE, b); piano_waltz(s, 'piano', c, vel=50, variant=3); pedal(s, 'piano', c)
    strings(s, c, vel=50, melody_on_v1=True)
    m = mel(M_PUENTE, 3); legato(s, 'vln1', m, b, vel=72); legato(s, 'flauta', m, b, vel=52, transpose=12)
    warns += check_melody(m, prog(PUENTE, 3), 3, name='puente')
    roll(s, 'timbal', b + 18, 6, 'D2', 26, 84)
    gliss(s, 'arpa', c[-1][2], b + 22, 2, vel=50)
    dyn(s, 'vln1', b, 24, 85, 120)
    s.rit(b + 21, 3, 0.9)

    # Final en Sol: toda la orquesta
    b = s.section('final', 16)
    c = ch(A, b, 2); piano_waltz(s, 'piano', c, vel=54); pedal(s, 'piano', c)
    strings(s, c, vel=56, melody_on_v1=True, high=81)
    m = mel(M_A, 3); legato(s, 'vln1', m, b, vel=82, transpose=2); legato(s, 'flauta', m, b, vel=48, transpose=2)
    legato(s, 'chelo', m, b, vel=56, transpose=-10)
    for bb, dd, cc in c[::4]:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, dd * 4 - .2, p, 46)
    harp(s, 'arpa', c[::2], vel=44)
    s.note('timbal', b, 2, 'G2', 70)
    ends += [b + 24]

    # Coda: se apaga con el piano
    b = s.section('coda', 8)
    c = ch(CODA, b); piano_waltz(s, 'piano', c[:5], vel=46, variant=3); pedal(s, 'piano', c)
    strings(s, c, vel=44, melody_on_v1=True)
    m = mel(M_CODA, 3); legato(s, 'vln1', m, b, vel=66, transpose=0); warns += check_melody(m, prog(CODA, 3), 3, name='coda')
    dyn(s, 'vln1', b + 12, 12, 100, 60); dyn(s, 'vla', b + 12, 12, 100, 60); dyn(s, 'vc', b + 12, 12, 100, 60)
    end = b + 18
    for k, p in enumerate(['G2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4', 'D5']):
        s.note('piano', end + k * .12, 6, p, 44 - k * 2)
    s.cc('piano', end, 64, 127)
    gliss(s, 'arpa', c[-1][2], end + 1, 2.5, low=55, high=91, vel=40)
    s.rit(b + 15, 9, 0.7, back=False)
    s.end_beat = b + 24

    phrase_rit(s, ends[1:-1], to=0.95)
    perform(s, phrase_bars=4, lead=('melodia', 'vln1', 'chelo', 'flauta'), sustained=('vln1', 'vln2', 'vla', 'vc', 'cb', 'cornos'),
            viennese=('piano',))
    mix_orchestra(s, lead={'melodia': dict(lufs=-21, hp=120, sends={'sala': -10}, air=1.5)}, hall=3.0)
    return s, warns
