"""Vals de quince — vals de orquesta para XV años (Re mayor, sube a Mi bemol)."""
from lib import Song, prog, mel, check_melody, riser
from arr import at, tr_chords, arp, pad, roots, melody, roll, swell

SF2 = 'musescore'   # banco MuseScore General: piano y cuerdas grabados
META = dict(id='vals-de-quince', name='Vals de quince', mood='Vals', desc='Vals de orquesta para la entrada y el baile.',
            tags=['xv', 'vals', 'boda', 'elegante'])

INTRO = 'D | G | Em7 | A7 | D | G | Em7:2 A7:1 | D'
A = 'D | A7/C# | Bm | F#m/A | G | D/F# | Em7 | A7 | D | A7/C# | Bm | D7/A | G | Gm6 | D/A:2 A7:1 | D'
B = 'G | G | D/F# | D | Em | A7 | D | D7 | G | Gm | D/F# | B7 | Em | A7 | D | A7'
MOD = 'Bb7 | Bb7'
CODA = 'Eb | Ab | Eb/Bb | Bb7 | Eb | Eb'

M_INTRO = 'F#5:3 | G5:2 B5:1 | G5:2 E5:1 | E5:2 C#5:1 | D5:3 | B5:2 G5:1 | G5:1 F#5:1 E5:1 | D5:3'
M_A = ('A4:1 D5:1 F#5:1 | A5:2 G5:1 | F#5:2 D5:1 | C#5:2 A4:1 | B4:1 D5:1 G5:1 | A5:2 F#5:1 | G5:1 F#5:1 E5:1 | E5:3 | '
       'A4:1 D5:1 F#5:1 | A5:2 G5:1 | F#5:1 B5:1 D6:1 | C6:2 A5:1 | B5:2 G5:1 | Bb5:2 E5:1 | A5:1 F#5:1 E5:1 | D5:3')
M_B = ('B5:1 A5:1 G5:1 | D5:2 B4:1 | A5:1 G5:1 F#5:1 | A4:3 | G5:1 F#5:1 E5:1 | E5:2 C#5:1 | D5:1 F#5:1 A5:1 | C6:3 | '
       'B5:1 D6:1 B5:1 | Bb5:2 G5:1 | A5:1 F#5:1 D5:1 | D#5:2 F#5:1 | E5:1 G5:1 B5:1 | A5:1 G5:1 E5:1 | F#5:2 E5:1 | E5:2 C#5:1')
M_CODA = 'G5:3 | Ab5:2 C6:1 | Bb5:2 G5:1 | F5:2 D5:1 | Eb5:3 | r:3'


def oompah(s, tr, chords, vel=70, prev=None):
    """Acompañamiento de vals: bajo en el 1, acorde en el 2 y el 3."""
    for b, d, c in chords:
        bn = c.near(c.bass, 38)
        if bn > 50:
            bn -= 12
        s.note(tr, b, 0.9, bn, vel + 6)
        v = c.voicing(54, 69, 3, prev)
        prev = v
        for k in range(1, int(round(d))):
            for p in v:
                s.note(tr, b + k, 0.45, p, vel - 8)
    return prev


def gliss(s, tr, c, beat, beats=1.0, low=55, high=91, vel=60):
    notes = c.stack(low, high)
    for i, p in enumerate(notes):
        s.note(tr, beat + beats * i / len(notes), 1.6, p, vel + 20 * i / len(notes))


def build():
    s = Song(META['id'], bpm=138, meter=3, seed=15)
    s.track('piano', program=0, pan=52, human=(6, 5), vel_add=8)
    s.track('melodia', program=48, pan=70, human=(0, 3), vel_add=10)
    s.track('flauta', program=73, pan=84, human=(4, 4), vel_add=6)
    s.track('arpa', program=46, pan=36, human=(3, 4), vel_add=8)
    s.track('cuerdas', program=49, pan=60, human=(0, 0), vel_add=10)
    s.track('chelo', program=42, pan=44, human=(0, 3), vel_add=8)
    s.track('cornos', program=60, pan=58, human=(0, 3), vel_add=6)
    s.track('coro', program=52, pan=64, human=(0, 0))
    s.track('timbal', program=47, pan=64, human=(2, 4))
    s.track('platillos', drum=True, program=48, pan=64, human=(0, 3))
    warns = []
    ch = lambda txt, b, k=0: tr_chords(at(prog(txt, 3), b), k) if k else at(prog(txt, 3), b)

    b = s.section('intro', 8)
    c = ch(INTRO, b)
    arp(s, 'arpa', c, pattern=(0, 1, 2, 3, 4, 5), step=0.5, vel=58, bass=(38, 50), span=30, gate=2.5)
    pad(s, 'cuerdas', c, vel=48); swell(s, 'cuerdas', b, 24, 50, 95)
    m = mel(M_INTRO, 3); melody(s, 'flauta', m, b, vel=70); warns += check_melody(m, prog(INTRO, 3), 3, name='intro')

    b = s.section('vals', 16)
    c = ch(A, b)
    oompah(s, 'piano', c, vel=62)
    roots(s, 'chelo', c, low=38, high=50, vel=56)
    pad(s, 'cuerdas', c, low=57, high=72, n=3, vel=40); s.cc('cuerdas', b, 11, 85)
    m = mel(M_A, 3); melody(s, 'melodia', m, b, vel=78); warns += check_melody(m, prog(A, 3), 3, name='A')

    b = s.section('vals-b', 16)
    c = ch(B, b)
    oompah(s, 'piano', c, vel=64)
    roots(s, 'chelo', c, low=38, high=50, vel=58)
    pad(s, 'cuerdas', c, low=57, high=72, n=3, vel=44)
    m = mel(M_B, 3); melody(s, 'melodia', m, b, vel=80); melody(s, 'flauta', m, b, vel=56, transpose=12)
    warns += check_melody(m, prog(B, 3), 3, name='B')
    for k in (0, 24):
        gliss(s, 'arpa', c[k // 3][2], b + k, 1.5)

    b = s.section('vals-pleno', 16)
    s.meta['hot'] = b
    c = ch(A, b)
    oompah(s, 'piano', c, vel=70)
    roots(s, 'chelo', c, low=38, high=50, vel=66)
    pad(s, 'cuerdas', c, low=57, high=74, n=4, vel=56); s.cc('cuerdas', b, 11, 110)
    pad(s, 'cornos', c, low=53, high=67, n=3, vel=50)
    m = mel(M_A, 3); melody(s, 'melodia', m, b, vel=86, octave_double=-12)
    s.note('platillos', b, 3, 57, 84)
    for k in range(0, 48, 12):
        s.note('timbal', b + k, 1, c[k // 3][2].near(c[k // 3][2].bass, 38), 82)
    gliss(s, 'arpa', c[0][2], b - 1.5, 1.5)

    b = s.section('cambio', 2)
    c = ch(MOD, b)
    pad(s, 'cuerdas', c, low=58, high=75, n=4, vel=60); swell(s, 'cuerdas', b, 6, 70, 125)
    pad(s, 'cornos', c, low=53, high=67, n=3, vel=58)
    roots(s, 'chelo', c, low=34, high=46, vel=70)
    roll(s, 'timbal', b, 6, 'Bb1', 36, 104)
    gliss(s, 'arpa', c[0][2], b + 3, 3, vel=58)
    melody(s, 'melodia', mel('F5:1 Ab5:1 Bb5:1 | D6:2 Bb5:1', 3), b, vel=84)

    b = s.section('vals-mib', 16)
    c = ch(A, b, 1)
    oompah(s, 'piano', c, vel=72)
    roots(s, 'chelo', c, low=39, high=51, vel=68)
    pad(s, 'cuerdas', c, low=58, high=75, n=4, vel=60); s.cc('cuerdas', b, 11, 118)
    pad(s, 'cornos', c, low=53, high=68, n=3, vel=54)
    pad(s, 'coro', c, low=58, high=74, n=3, vel=46)
    m = mel(M_A, 3); melody(s, 'melodia', m, b, vel=90, octave_double=-12, transpose=1)
    s.note('platillos', b, 3, 49, 100)
    for k in range(0, 48, 12):
        s.note('timbal', b + k, 1, c[k // 3][2].near(c[k // 3][2].bass, 38), 86)

    b = s.section('vals-mib-b', 16)
    c = ch(B, b, 1)
    oompah(s, 'piano', c, vel=68)
    roots(s, 'chelo', c, low=39, high=51, vel=64)
    pad(s, 'cuerdas', c, low=58, high=74, n=3, vel=52)
    m = mel(M_B, 3); melody(s, 'melodia', m, b, vel=84, transpose=1); melody(s, 'flauta', m, b, vel=60, transpose=13)
    for k in (0, 24):
        gliss(s, 'arpa', c[k // 3][2], b + k, 1.5)

    b = s.section('vals-final', 16)
    c = ch(A, b, 1)
    oompah(s, 'piano', c, vel=74)
    roots(s, 'chelo', c, low=39, high=51, vel=70)
    pad(s, 'cuerdas', c, low=58, high=76, n=4, vel=64); s.cc('cuerdas', b, 11, 124)
    pad(s, 'cornos', c, low=53, high=68, n=3, vel=60)
    pad(s, 'coro', c, low=58, high=74, n=3, vel=54)
    m = mel(M_A, 3); melody(s, 'melodia', m, b, vel=94, octave_double=-12, transpose=1)
    s.note('platillos', b, 3, 57, 104)
    for k in range(0, 48, 6):
        s.note('timbal', b + k, 1, c[k // 3][2].near(c[k // 3][2].bass, 38), 80 + (8 if k % 12 == 0 else 0))

    b = s.section('final', 6)
    c = ch(CODA, b)
    oompah(s, 'piano', c[:4], vel=66)
    roots(s, 'chelo', c, low=39, high=51, vel=64)
    pad(s, 'cuerdas', c, low=58, high=76, n=4, vel=60)
    pad(s, 'cornos', c[:5], low=53, high=68, n=3, vel=54)
    m = mel(M_CODA, 3); melody(s, 'melodia', m, b, vel=86, octave_double=-12); warns += check_melody(m, prog(CODA, 3), 3, name='coda')
    end = b + 12
    gliss(s, 'arpa', c[4][2], end, 2, low=51, high=94, vel=62)
    for p in ('Eb2', 'Bb2', 'Eb3', 'G3', 'Bb3', 'Eb4'):
        s.note('piano', end, 5.5, p, 74)
    s.note('timbal', end, 2, 'Eb2', 96)
    s.note('platillos', end, 3, 49, 92)
    s.end_beat = b + 18

    s.mix = {
        'piano': dict(lufs=-24, hp=70, sends={'sala': -12}),
        'melodia': dict(lufs=-19.5, hp=150, sends={'sala': -8}, air=2),
        'flauta': dict(lufs=-25, hp=250, sends={'sala': -7}),
        'arpa': dict(lufs=-25, hp=90, sends={'sala': -6}),
        'cuerdas': dict(lufs=-25, hp=150, sends={'sala': -6}),
        'chelo': dict(lufs=-26, hp=40, sends={'sala': -9}),
        'cornos': dict(lufs=-27, hp=90, sends={'sala': -6}),
        'coro': dict(lufs=-29, hp=180, sends={'sala': -4}),
        'timbal': dict(lufs=-27, hp=35, sends={'sala': -7}),
        'platillos': dict(lufs=-30, hp=300, sends={'sala': -6}),
    }
    cambio = s.marks[[n for _, n in s.marks].index('cambio')][0]
    s.master = dict(tone='orquesta', reverbs={'sala': dict(seconds=3.0, predelay=0.03, bright=0.85)}, tail=5.0,
                    extras=[('audio', s.sec(cambio + 6) - 2.6, riser(2.6, 0.045, f0=1500, f1=12000))])
    # Interpretación: menos "robot" (dinámica por frase, acordes escalonados, cuerdas que respiran, final más lento)
    from expr import perform
    for t in s.tracks.values():
        t.human = (t.human[0], min(t.human[1], 2))
        if t.program in (0, 46):
            t.roll = 8
    last = max(b for t in s.tracks.values() for b, d, p, v in t.notes)
    s.rit(last - 2 * s.meter, 2 * s.meter, 0.84, back=False)
    perform(s, phrase_bars=4, lead=('melodia', 'flauta'), sustained=('cuerdas', 'cornos', 'coro'), viennese=('piano',))
    s.master['tone_max'] = 3.0
    return s, warns
