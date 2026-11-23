"""Busca en Wikimedia Commons grabaciones de valses y música para bodas que sean de dominio público o CC0.

Escribe out/lista.json con: archivo, url, licencia, intérprete, duración, tamaño. Solo deja las que se pueden
usar sin pedir permiso ni dar crédito (dominio público / CC0). Se corre en GitHub Actions (necesita internet).
"""
import json, os, re, sys, time, urllib.parse, urllib.request

API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'EditorSaucedo/0.8 (musica de dominio publico para un editor de video; github.com/edwinsaucedo)'}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')

BUSQUEDAS = [
    # Valses
    'Blue Danube', 'Donauwalzer', 'An der schönen blauen Donau', 'Kaiser-Walzer', 'Emperor Waltz', 'Wiener Blut',
    'Geschichten aus dem Wienerwald', 'Tales from the Vienna Woods', 'Rosen aus dem Süden', 'Frühlingsstimmen', 'Strauss waltz',
    'Waltz of the Flowers', 'Valse des fleurs', 'Sleeping Beauty waltz', 'Tchaikovsky waltz', 'Swan Lake waltz',
    'Skaters Waltz', 'Les Patineurs Waldteufel', 'Estudiantina Waldteufel', 'Sobre las olas', 'Over the Waves Rosas', 'Juventino Rosas',
    'Chopin waltz', 'Valse Chopin', 'Brahms waltz', 'Waltz Marine Band', 'valse', 'vals',
    # Bodas, baladas y piano
    'Canon in D', 'Pachelbel Canon', 'Air on the G String', 'Air BWV 1068', 'Jesu Joy of Man\'s Desiring', 'Ave Maria Schubert',
    'Ave Maria Gounod', 'Bridal Chorus', 'Lohengrin Treulich', 'Wedding March Mendelssohn', 'Hochzeitsmarsch', 'Clair de lune',
    'Rêverie Debussy', 'Arabesque Debussy', 'Gymnopédie', 'Liebestraum', 'Träumerei', 'Nocturne op 9 no 2', 'Méditation Thaïs',
    'Für Elise', 'Moonlight Sonata', 'Trumpet Voluntary', 'Arrival of the Queen of Sheba', 'Eine kleine Nachtmusik',
    'Spring Vivaldi', 'Musopen', 'Marine Band', 'Navy Band', 'Army Band', 'Air Force Band',
]
LIBRES = re.compile(r'public domain|^pd\b|pd-|cc0|cc-zero|no restrictions', re.I)


def api(params):
    params = dict(params, format='json', formatversion='2')
    url = API + '?' + urllib.parse.urlencode(params)
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('reintento', k, e, file=sys.stderr); time.sleep(3 * (k + 1))
    return {}


def texto(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html or '')).strip()


def main():
    titulos = set()
    for q in BUSQUEDAS:
        r = api({'action': 'query', 'list': 'search', 'srnamespace': 6, 'srlimit': 100, 'srsearch': f'{q} filetype:audio'})
        for x in (r.get('query') or {}).get('search', []):
            titulos.add(x['title'])
        time.sleep(.3)
    print(len(titulos), 'archivos de audio encontrados', file=sys.stderr)
    filas, todos = [], sorted(titulos)
    for i in range(0, len(todos), 40):
        r = api({'action': 'query', 'prop': 'imageinfo', 'titles': '|'.join(todos[i:i + 40]),
                 'iiprop': 'url|size|mime|extmetadata|metadata', 'iiextmetadatafilter': 'LicenseShortName|License|Artist|Credit|ImageDescription|UsageTerms|Copyrighted'})
        for pg in (r.get('query') or {}).get('pages', []):
            ii = (pg.get('imageinfo') or [{}])[0]
            em = ii.get('extmetadata') or {}
            g = lambda k: texto((em.get(k) or {}).get('value', ''))
            lic = g('LicenseShortName') or g('License') or g('UsageTerms')
            dur = 0
            for m in ii.get('metadata') or []:
                if m.get('name') in ('length', 'playtime_seconds', 'duration'):
                    try: dur = float(m.get('value')); break
                    except Exception: pass
            filas.append({'archivo': pg.get('title'), 'url': ii.get('url'), 'pagina': ii.get('descriptionurl'), 'mime': ii.get('mime'),
                          'bytes': ii.get('size'), 'segundos': round(dur, 1), 'licencia': lic, 'libre': bool(LIBRES.search(lic or '')),
                          'interprete': g('Artist')[:160], 'credito': g('Credit')[:200], 'descripcion': g('ImageDescription')[:300]})
        time.sleep(.3)
    os.makedirs(OUT, exist_ok=True)
    libres = [f for f in filas if f['libre'] and f['segundos'] >= 60]
    json.dump(sorted(libres, key=lambda f: f['archivo']), open(os.path.join(OUT, 'lista.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    json.dump(sorted({f['licencia'] for f in filas}), open(os.path.join(OUT, 'licencias.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(len(filas), 'revisados;', len(libres), 'libres de 1 minuto o más', file=sys.stderr)


if __name__ == '__main__':
    main()
