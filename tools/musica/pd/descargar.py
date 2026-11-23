"""Descarga de Wikimedia Commons las grabaciones de elegidas.json y las pasa a MP3 de buena calidad (out/audio/<id>.mp3).

Antes de descargar vuelve a revisar en Commons que la licencia siga siendo de dominio público o CC0.
Guarda out/creditos.json con compositor/intérprete, licencia y página de cada una.
"""
import json, os, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
# Wikimedia pide un User-Agent con una dirección de contacto (si no, responde 429).
UA = {'User-Agent': 'EditorSaucedo/0.8 (https://github.com/edwinsaucedo/editor-saucedo; musica de dominio publico) Python-urllib/3'}
LIBRES = re.compile(r'public domain|^pd\b|pd-|cc0|cc-zero', re.I)


def licencia(titulo):
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'imageinfo', 'titles': titulo, 'iiprop': 'extmetadata', 'format': 'json', 'formatversion': '2'})
    with urllib.request.urlopen(urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + q, headers=UA), timeout=60) as r:
        pg = json.load(r)['query']['pages'][0]
    em = (pg.get('imageinfo') or [{}])[0].get('extmetadata') or {}
    return re.sub(r'<[^>]+>', '', (em.get('LicenseShortName') or {}).get('value', ''))


def main():
    elegidas = json.load(open(os.path.join(HERE, 'elegidas.json'), encoding='utf8'))
    os.makedirs(os.path.join(OUT, 'audio'), exist_ok=True)
    creditos = []
    for e in elegidas:
        dest = os.path.join(OUT, 'audio', e['id'] + '.mp3')
        lic = licencia(e['archivo'])
        if not LIBRES.search(lic):
            print('NO ES LIBRE, se salta:', e['archivo'], lic, file=sys.stderr); continue
        if not os.path.exists(dest):
            src = os.path.join('/tmp', 'orig_' + e['id'])
            ok = False
            for k in range(7):
                try:
                    with urllib.request.urlopen(urllib.request.Request(e['url'], headers=UA), timeout=300) as r, open(src, 'wb') as f:
                        while True:
                            b = r.read(1 << 20)
                            if not b: break
                            f.write(b)
                    ok = True; break
                except urllib.error.HTTPError as ex:
                    wait = int(ex.headers.get('Retry-After') or 0) or 20 * 2 ** k
                    print('reintento', k, e['id'], ex.code, 'espera', wait, file=sys.stderr); time.sleep(min(wait, 300))
                except Exception as ex:
                    print('reintento', k, e['id'], ex, file=sys.stderr); time.sleep(20 * (k + 1))
            if not ok:
                print('NO SE PUDO DESCARGAR', e['id'], file=sys.stderr); continue
            r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '0', dest])
            os.remove(src)
            if r.returncode != 0:
                print('no se pudo convertir', e['id'], file=sys.stderr); continue
        creditos.append(dict(e, licencia_revisada=lic))
        print('ok', e['id'], lic, file=sys.stderr)
        time.sleep(15)
    json.dump(creditos, open(os.path.join(OUT, 'creditos.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
