"""Vals de las rosas — vals de salón para orquesta de cuerdas, arpa y flauta (Sol mayor, trío en Do)."""
from lib import Song, prog, mel, check_melody
from arr import at, tr_chords
from expr import (track, perform, phrase_rit, legato, strings, pizz, harp, gliss, roll, dyn, mix_orchestra, bass_of)

SF2 = 'musescore'
META = dict(id='vals-de-las-rosas', name='Vals de las rosas', mood='Vals de salón',
            desc='Cuerdas, arpa y flauta en un vals clásico y luminoso. Para la entrada y el vals.',
            tags=['vals', 'xv', 'boda', 'elegante', 'entrada'])

INTRO = 'G | C | D7 | D7 | G | Em | A7 | D7'
A = 'G | G | D7 | D7 | D7 | D7 | G | G | G | G7 | C | Cm | G/D | D7 | G | G'
B = 'Em | Em | B7 | B7 | Em | Am | D7 | G | C | C#dim7 | G/D | E7 | Am | D7 | G | D7'
TRIO = 'C | C | G7 | G7 | G7 | G7 | C | C | C | C7 | F | Fm | C/G | G7 | C | D7'
CODA = 'G | C | G/D | D7 | G | G | G | G'

M_INTRO = 'B5:3 | C6:2 E6:1 | D6:2 C6:1 | A5:3 | B5:2 D6:1 | G5:3 | C#6:2 E6:1 | F#5:2 A5:1'
M_A = ('D5:1 G5:1 B5:1 | D6:3 | C6:2 A5:1 | F#5:3 | A5:1 C6:1 D6:1 | C6:2 A5:1 | B5:2 G5:1 | D5:3 | '
       'D5:1 G5:1 B5:1 | D6:2 B5:1 | E6:2 C6:1 | Eb6:2 C6:1 | B5:2 G5:1 | A5:2 F#5:1 | G5:3 | r:3')
M_B = ('B5:2 G5:1 | E6:3 | D#6:2 B5:1 | A5:3 | G5:2 B5:1 | C6:2 A5:1 | F#5:1 A5:1 C6:1 | B5:3 | '
       'E6:2 C6:1 | E6:2 C#6:1 | D6:2 B5:1 | G#5:2 B5:1 | C6:2 A5:1 | F#5:2 A5:1 | G5:3 | A5:1 F#5:1 D5:1')
M_TRIO = ('G5:1 C6:1 E6:1 | G6:3 | F6:2 D6:1 | B5:3 | D6:1 F6:1 G6:1 | F6:2 D6:1 | E6:2 C6:1 | G5:3 | '
          'G5:1 C6:1 E6:1 | G6:2 E6:1 | A6:2 F6:1 | Ab6:2 F6:1 | E6:2 C6:1 | D6:2 B5:1 | C6:3 | A5:1 F#5:1 D5:1')
M_CODA = 'B5:3 | C6:2 E6:1 | D6:2 B5:1 | A5:2 F#5:1 | G5:3 | D5:1 G5:1 B5:1 | G6:3 | r:3'


def build():
    s = Song(META['id'], bpm=112, meter=3, seed=61)
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        track(s, sec, human=(4, 0))
    track(s, 'vln2_p', 'vln2_pizz', human=(4, 0))
    track(s, 'vla_p', 'vla_pizz', human=(4, 0))
    track(s, 'vc_p', 'vc_pizz', human=(4, 0))
    track(s, 'flauta', human=(5, 0))
    track(s, 'clarinete', human=(5, 0))
    track(s, 'arpa', human=(4, 0), roll=6)
    track(s, 'cornos', human=(4, 0))
    track(s, 'glock', human=(3, 0))
    track(s, 'timbal', human=(3, 0))
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt, 3), b), k) if k else at(prog(txt, 3), b)

    def oom(c, vel, strings_sus=False):
        """Vals de orquesta: contrabajos y chelos en el 1, violas y violines II en el 2 y 3."""
        if strings_sus:
            strings(s, c, vel=vel - 10, sections=('vla',), melody_on_v1=True)
        for b, d, cc in c:
            s.note('cb', b, .9, bass_of(cc, 28, 40), vel)
            s.note('vc', b, .9, bass_of(cc, 40, 52), vel + 2)
            v = cc.voicing(55, 71, 2)
            for k in (1, 2):
                s.note('vln2', b + k, .55, v[1], vel - 6)
                s.note('vla', b + k, .55, v[0], vel - 8)

    b = s.section('intro', 8)
    c = ch(INTRO, b)
    strings(s, c, vel=44, melody_on_v1=True)
    m = mel(M_INTRO, 3); legato(s, 'vln1', m, b, vel=64); legato(s, 'flauta', m, b, vel=50, transpose=12)
    warns += check_melody(m, prog(INTRO, 3), 3, name='intro')
    gliss(s, 'arpa', c[0][2], b, 2, vel=44)
    s.rit(b + 21, 3, 0.8)

    b = s.section('vals', 16)
    c = ch(A, b); oom(c, 56)
    m = mel(M_A, 3); legato(s, 'vln1', m, b, vel=70); warns += check_melody(m, prog(A, 3), 3, name='A')
    harp(s, 'arpa', c[::4], vel=38)

    b = s.section('vals-b', 16)
    c = ch(B, b); oom(c, 54)
    m = mel(M_B, 3); legato(s, 'vln1', m, b, vel=68); legato(s, 'clarinete', m, b, vel=46, transpose=-12)
    warns += check_melody(m, prog(B, 3), 3, name='B')

    b = s.section('vals-pleno', 16)
    s.meta['hot'] = b
    c = ch(A, b); oom(c, 62)
    m = mel(M_A, 3); legato(s, 'vln1', m, b, vel=80); legato(s, 'flauta', m, b, vel=54, transpose=12)
    for bb, dd, cc in c[::2]:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, 5.6, p, 42)
    harp(s, 'arpa', c, vel=40)
    s.note('timbal', b, 2, 'G2', 66)

    # Trío en Do: más ligero, en pizzicato, la flauta canta
    b = s.section('trio', 16)
    c = ch(TRIO, b)
    pizz(s, c, vel=56)
    s.note('cb', b, 47, 'C2', 30)
    m = mel(M_TRIO, 3); legato(s, 'flauta', m, b, vel=66, transpose=-12); legato(s, 'glock', m[::2], b, vel=40)
    warns += check_melody(m, prog(TRIO, 3), 3, name='trío')
    strings(s, c[::2], vel=32, sections=('vln1',))
    s.rit(b + 45, 3, 0.86)

    b = s.section('vals-final', 16)
    c = ch(A, b); oom(c, 66)
    m = mel(M_A, 3); legato(s, 'vln1', m, b, vel=86); legato(s, 'flauta', m, b, vel=56, transpose=12)
    legato(s, 'clarinete', m, b, vel=48, transpose=-12)
    for bb, dd, cc in c[::2]:
        for p in cc.voicing(53, 67, 3):
            s.note('cornos', bb, 5.6, p, 48)
    harp(s, 'arpa', c, vel=42)
    for k in range(0, 48, 12):
        s.note('timbal', b + k, 1, 'G2' if k % 24 == 0 else 'D2', 58)
    dyn(s, 'vln1', b + 36, 12, 100, 120)

    b = s.section('coda', 8)
    c = ch(CODA, b)
    strings(s, c, vel=58, melody_on_v1=True)
    m = mel(M_CODA, 3); legato(s, 'vln1', m, b, vel=80); legato(s, 'flauta', m, b, vel=56, transpose=12)
    warns += check_melody(m, prog(CODA, 3), 3, name='coda')
    gliss(s, 'arpa', c[5][2], b + 15, 3, low=55, high=93, vel=50)
    roll(s, 'timbal', b + 15, 6, 'G2', 30, 76)
    end = b + 18
    s.note('timbal', end, 2, 'G2', 84)
    for sec, p in (('cb', 'G1'), ('vc', 'G2'), ('vla', 'D4'), ('vln2', 'B4')):
        s.note(sec, end, 4.5, p, 70)
    s.rit(b + 12, 6, 0.75, back=False)
    s.end_beat = b + 24

    phrase_rit(s, [b0 for b0 in range(48 + 24, 48 * 6, 48)], to=0.96)
    perform(s, phrase_bars=4, lead=('vln1', 'flauta', 'clarinete'), sustained=('vla', 'cornos'), viennese=('vln2', 'vla', 'vln2_p', 'vla_p'))
    mix_orchestra(s, hall=3.1)
    return s, warns
