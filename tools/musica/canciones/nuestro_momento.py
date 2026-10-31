"""Nuestro momento — balada acústica de guitarra de nylon, piano y cuerdas (Sol mayor)."""
from lib import Song, prog, mel, check_melody
from arr import at
from expr import (track, perform, phrase_rit, pedal, piano_melody, legato, strings, gliss, dyn, mix_orchestra, bass_of)

SF2 = 'musescore'
META = dict(id='nuestro-momento', name='Nuestro momento', mood='Balada acústica',
            desc='Guitarra de nylon, piano y cuerdas, cálida y sencilla. Para sesiones, aniversarios y fotosecuencias.',
            tags=['boda', 'acustica', 'aniversario', 'romantica', 'fotosecuencia'])

INTRO = 'Cmaj7 | G/B | Am7 | Dsus4:2 D:2'
VERSE = 'G | D/F# | Em7 | Cmaj7 | G/B | Am7 | Cmaj7:2 D:2 | G'
CHORUS = 'C | D | Bm7 | Em7 | Am7 | D/F# | G/B:2 C:2 | Dsus4:2 D:2'
BRIDGE = 'Em | C | G | D'
OUTRO = 'Cmaj7 | G/B | Am7:2 Dsus4:2 | G'

M_VERSE = ('B4:1 D5:1 G5:1.5 F#5:.5 | F#5:2 D5:1 A4:1 | G4:1 B4:1 E5:1.5 D5:.5 | E5:3 r:1 | '
           'D5:1 G5:1 B5:1.5 A5:.5 | C6:2 A5:1 E5:1 | G5:1.5 E5:.5 F#5:2 | G5:3 r:1')
M_CHORUS = ('E5:.5 G5:.5 C6:2 B5:1 | A5:1.5 F#5:.5 D5:2 | D5:.5 F#5:.5 B5:2 A5:1 | G5:1.5 F#5:.5 E5:2 | '
            'E5:.5 A5:.5 C6:2 B5:1 | A5:1.5 F#5:.5 D5:2 | D5:1 G5:1 E5:2 | G5:2 F#5:2')
M_BRIDGE = 'B4:1 E5:1 G5:2 | G5:1.5 E5:.5 C5:2 | D5:1 G5:1 B5:2 | A5:4'
M_OUTRO = 'E5:2 G5:2 | D5:2 B4:2 | C5:2 A4:2 | G4:4'


def fingerpick(s, tr, chords, vel=54, pattern=(0, 3, 1, 3, 2, 3, 1, 3)):
    """Guitarra de nylon con los dedos: bajo con el pulgar y tres cuerdas arriba (como se toca de verdad)."""
    for i, (b, d, c) in enumerate(chords):
        bn = bass_of(c, 40, 52)
        up = c.voicing(55, 71, 3)
        strings_ = [bn] + up
        for k in range(int(round(d / .5))):
            idx = pattern[k % len(pattern)]
            if k == 4 and i % 2:   # variación: el pulgar toca la quinta en el tiempo 3
                p = c.near((c.root + 7) % 12, bn + 3)
            else:
                p = strings_[idx]
            s.note(tr, b + k * .5, 1.6 if idx else d - k * .5, p, vel + (6 if k == 0 else 0) - (2 if k % 2 else 0))


def build():
    s = Song(META['id'], bpm=76, meter=4, seed=81)
    track(s, 'guitarra', human=(8, 0), roll=14)
    track(s, 'piano', 'piano_suave', human=(6, 0), roll=10)
    track(s, 'melodia', 'piano_suave', human=(7, 0), pan=68)
    track(s, 'chelo', human=(6, 0))
    for sec in ('vln1', 'vln2', 'vla', 'vc', 'cb'):
        track(s, sec, human=(4, 0))
    track(s, 'arpa', human=(4, 0))
    warns = []
    ch = lambda txt, b: at(prog(txt), b)
    ends = []

    b = s.section('intro', 4)
    c = ch(INTRO, b); fingerpick(s, 'guitarra', c, vel=50)
    s.rit(b + 13, 3, 0.86)

    b = s.section('estrofa', 8)
    c = ch(VERSE, b); fingerpick(s, 'guitarra', c, vel=52)
    m = mel(M_VERSE); legato(s, 'chelo', m, b, vel=62, transpose=-12); warns += check_melody(m, prog(VERSE), 4, name='estrofa')
    ends += [b + 16, b + 32]

    b = s.section('coro', 8)
    c = ch(CHORUS, b); fingerpick(s, 'guitarra', c, vel=54)
    for bb, dd, cc in c:
        for p in cc.voicing(60, 74, 3):
            s.note('piano', bb, dd - .1, p, 40)
    pedal(s, 'piano', c)
    strings(s, c, vel=40, sections=('vln2', 'vla', 'cb'))
    m = mel(M_CHORUS); piano_melody(s, 'melodia', m, b, vel=64); warns += check_melody(m, prog(CHORUS), 4, name='coro')
    ends += [b + 16, b + 32]

    b = s.section('estrofa2', 8)
    c = ch(VERSE, b); fingerpick(s, 'guitarra', c, vel=52)
    strings(s, c, vel=34, sections=('vla', 'cb'))
    m = mel(M_VERSE); legato(s, 'vln1', m, b, vel=64); legato(s, 'chelo', m, b, vel=44, transpose=-12)
    ends += [b + 16, b + 32]

    b = s.section('coro2', 8)
    s.meta['hot'] = b
    c = ch(CHORUS, b); fingerpick(s, 'guitarra', c, vel=56)
    strings(s, c, vel=48, melody_on_v1=True)
    m = mel(M_CHORUS); legato(s, 'vln1', m, b, vel=74); piano_melody(s, 'melodia', m, b, vel=56)
    legato(s, 'chelo', m, b, vel=48, transpose=-12)
    gliss(s, 'arpa', c[0][2], b - 1, 1, vel=42)
    ends += [b + 16, b + 32]

    b = s.section('puente', 4)
    c = ch(BRIDGE, b); fingerpick(s, 'guitarra', c, vel=50, pattern=(0, 1, 2, 3, 2, 1, 2, 3))
    strings(s, c, vel=44)
    m = mel(M_BRIDGE); piano_melody(s, 'melodia', m, b, vel=60); warns += check_melody(m, prog(BRIDGE), 4, name='puente')
    s.rit(b + 13, 3, 0.88)

    b = s.section('coro3', 8)
    c = ch(CHORUS, b); fingerpick(s, 'guitarra', c, vel=58)
    strings(s, c, vel=54, melody_on_v1=True)
    m = mel(M_CHORUS); legato(s, 'vln1', m, b, vel=82); legato(s, 'chelo', m, b, vel=54, transpose=-12)
    piano_melody(s, 'melodia', m, b, vel=54, octave=True)
    ends += [b + 32]

    b = s.section('final', 4)
    c = ch(OUTRO, b); fingerpick(s, 'guitarra', c[:3], vel=48)
    strings(s, c, vel=40, sections=('vla', 'vc', 'cb'))
    m = mel(M_OUTRO); legato(s, 'chelo', m, b, vel=56); warns += check_melody(m, prog(OUTRO), 4, name='final')
    end = b + 12
    for k, p in enumerate(['G2', 'D3', 'G3', 'B3', 'D4', 'G4']):
        s.note('guitarra', end + k * .08, 6, p, 50 - k * 2)
    s.rit(b + 8, 6, 0.75, back=False)
    s.end_beat = b + 20

    phrase_rit(s, ends[1:-1], to=0.96)
    perform(s, phrase_bars=4, lead=('melodia', 'vln1', 'chelo'), sustained=('vln1', 'vln2', 'vla', 'vc', 'cb'))
    mix_orchestra(s, lead={'melodia': dict(lufs=-22, hp=120, sends={'sala': -11}, air=1.5)},
                  extra={'guitarra': dict(lufs=-20.5), 'piano': dict(lufs=-26)}, hall=2.4, tone='acustica')
    return s, warns
