"""Cine mudo — ragtime original de piano viejo (Do mayor, 104 BPM)."""
from lib import Song, prog, mel, check_melody
from arr import at, tr_chords, melody

META = dict(id='cine-mudo', name='Cine mudo', mood='Antigua', desc='Piano de cantina estilo ragtime, como película antigua.',
            tags=['cine antiguo', 'blanco y negro', 'divertido'])

INTRO = 'G7 | G7 | Dm7:2 G7:2 | C'
A = 'C | C | G7 | G7 | C | C7 | F | F#dim7 | C/G | A7 | D7 | G7 | C | A7 | D7:2 G7:2 | C'
M_INTRO = 'G5:.25 F5:.25 D5:.25 B4:.25 G4:.5 B4:.5 D5:.5 F5:.5 G5:1 | B5:.25 A5:.25 G5:.25 F5:.25 D5:.5 F5:.5 G5:.5 B5:.5 D6:1 | F5:.5 A5:.5 C6:.5 A5:.5 B5:.5 D6:.5 F6:.5 D6:.5 | C6:1 G5:.5 E5:.5 C5:1 r:1'
M_A = ('E5:.25 G5:.5 C6:.25 E6:.5 C6:.5 G5:.5 E5:.5 G5:1 | E5:.25 G5:.5 C6:.25 E6:.5 D6:.5 C6:1 r:1 | '
       'D5:.25 F5:.5 B5:.25 D6:.5 B5:.5 G5:.5 F5:.5 G5:1 | D5:.25 F5:.5 B5:.25 D6:.5 C6:.5 B5:1 r:1 | '
       'E5:.25 G5:.5 C6:.25 E6:.5 C6:.5 G5:.5 E5:.5 G5:1 | E5:.25 G5:.5 Bb5:.25 E6:.5 D6:.5 C6:1 Bb5:1 | '
       'A5:.5 C6:.5 F5:.5 A5:.5 C6:1 A5:1 | A5:.5 C6:.5 Eb6:.5 C6:.5 A5:1 F#5:1 | '
       'G5:.25 C6:.5 E6:.25 G6:1 E6:.5 C6:.5 G5:1 | C#6:.5 E6:.5 A5:.5 C#6:.5 E6:1 C#6:1 | '
       'F#5:.25 A5:.5 C6:.25 D6:.5 C6:.5 A5:1 F#5:1 | G5:.25 B5:.5 D6:.25 F5:.5 G5:.5 B5:1 D6:1 | '
       'E6:.5 C6:.5 G5:.5 E5:.5 G5:1 C6:1 | C#6:.25 E6:.5 C#6:.25 A5:1 G5:1 E5:1 | F#5:.5 A5:.5 D6:.5 C6:.5 B5:.5 D6:.5 G5:.5 F5:.5 | C6:.5 G5:.25 E5:.25 C5:1 r:2')


def stride(s, chords, vel=70):
    """Mano izquierda de ragtime: bajo en 1 y 3 (raíz y quinta), acorde en 2 y 4."""
    prev = None
    for b, d, c in chords:
        r = c.near(c.bass, 36)
        if r > 47:
            r -= 12
        v = c.voicing(52, 65, 3, prev)
        prev = v
        for k in range(int(round(d))):
            if k % 2 == 0:
                p = r if k == 0 else (r + 7 if r + 7 <= 52 else r - 5)
                s.note('izq', b + k, .45, p, vel + 6)
                s.note('izq', b + k, .45, p - 12 if p - 12 >= 28 else p, vel - 4)
            else:
                for q in v:
                    s.note('izq', b + k, .35, q, vel - 8)


def build():
    s = Song(META['id'], bpm=104, meter=4, seed=131)
    s.track('der', program=3, pan=60, human=(5, 6), vel_add=6)
    s.track('izq', program=3, pan=52, human=(5, 5), vel_add=4)
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt), b), k) if k else at(prog(txt), b)
    ma = mel(M_A)
    warns += check_melody(ma, prog(A), name='A')

    b = s.section('intro', 4)
    stride(s, ch(INTRO, b), vel=66)
    mi = mel(M_INTRO); melody(s, 'der', mi, b, vel=80); warns += check_melody(mi, prog(INTRO), name='intro')

    b = s.section('rag', 16)
    s.meta['hot'] = b
    stride(s, ch(A, b))
    melody(s, 'der', ma, b, vel=82)

    b = s.section('trio', 16)
    stride(s, ch(A, b, 5), vel=66)
    melody(s, 'der', ma, b, vel=78, transpose=-7)

    b = s.section('rag2', 16)
    stride(s, ch(A, b), vel=74)
    melody(s, 'der', ma, b, vel=88, octave_double=-12)

    b = s.section('final', 4)
    c = ch('D7 | G7 | C:2 G7:2 | C', b)
    stride(s, c[:3], vel=72)
    melody(s, 'der', mel('F#5:.5 A5:.5 C6:.5 D6:.5 F#6:.5 D6:.5 C6:.5 A5:.5 | G5:.5 B5:.5 D6:.5 F6:.5 G6:1 F6:1 | E6:.5 C6:.5 G5:.5 E5:.5 F5:.5 D5:.5 B4:.5 G4:.5 | C5:1 r:3'), b, vel=84)
    end = b + 12
    for p in ('C2', 'C3', 'E4', 'G4', 'C5'):
        s.note('izq', end, 1, p, 96)
    s.end_beat = b + 16

    s.mix = {
        'der': dict(lufs=-18, hp=120, sends={'cuarto': -14}, peq=[(2500, 2, 1.0)]),
        'izq': dict(lufs=-20, hp=50, sends={'cuarto': -14}),
    }
    s.master = dict(tone='acustica', lofi=9000, crackle=4.0, reverbs={'cuarto': dict(seconds=1.0, predelay=0.008, bright=0.8)}, tail=2.5)
    return s, warns
