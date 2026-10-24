"""Servidor de prueba: imita la parte nativa del programa para probar la interfaz en un navegador.
Uso: python3 tools/mock_server.py <carpeta-de-pruebas> <puerto>"""
import json, os, shutil, subprocess, sys, time, urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src')
TEST = os.path.abspath(sys.argv[1]); PORT = int(sys.argv[2])
DOCS = os.path.join(TEST, 'Documentos'); CACHE = os.path.join(TEST, 'cache', 'trabajos')
IMG = {'jpg','jpeg','png','webp','heic','heif'}; VID = {'mp4','mov','mts','m2ts','avi','mkv'}; AUD = {'mp3','m4a','wav','aac'}
PICKS = json.load(open(os.path.join(TEST, 'picks.json')))

def kind(p):
    e = p.rsplit('.', 1)[-1].lower()
    return 'image' if e in IMG else 'video' if e in VID else 'audio' if e in AUD else None

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=os.path.abspath(ROOT), **k)
    def log_message(self, *a): pass
    def send(self, code, body, ctype='application/json'):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); raw = self.rfile.read(n)
        cmd = urllib.parse.urlparse(self.path).path.strip('/').split('/')[-1]
        if cmd == 'write_file':
            p = urllib.parse.unquote(self.headers['x-path']); os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(raw); return self.send(200, b'null')
        a = json.loads(raw or b'{}')
        try:
            if cmd == 'read_file': return self.send(200, open(a['path'], 'rb').read(), 'application/octet-stream')
            r = None
            if cmd == 'app_paths': r = {'documents': DOCS, 'sep': '/', 'os': 'linux'}
            elif cmd == 'list_media':
                out = []
                for p in a['paths']:
                    files = [os.path.join(d, f) for d, _, fs in os.walk(p) for f in sorted(fs)] if os.path.isdir(p) else [p]
                    out += [{'path': f, 'name': os.path.basename(f), 'kind': kind(f)} for f in files if kind(f)]
                r = out
            elif cmd == 'run_tool':
                pr = subprocess.run([a['tool']] + a['args'], capture_output=True, text=True)
                r = {'code': pr.returncode, 'stdout': pr.stdout if a['tool'] == 'ffprobe' else '', 'stderr': '\n'.join(pr.stderr.strip().split('\n')[-40:])}
            elif cmd == 'cancel_job': r = False
            elif cmd == 'make_dir': os.makedirs(a['path'], exist_ok=True)
            elif cmd == 'path_exists': r = os.path.exists(a['path'])
            elif cmd == 'new_job_dir':
                d = os.path.join(CACHE, 't%d' % int(time.time() * 1000)); os.makedirs(d, exist_ok=True); r = d
            elif cmd == 'remove_job_dir': shutil.rmtree(a['path'], ignore_errors=True)
            elif cmd == 'pick_files': r = PICKS.get(a['kind'], [])
            elif cmd == 'pick_folder': r = None
            elif cmd == 'open_path': r = None
            else: return self.send(404, json.dumps('comando desconocido ' + cmd).encode())
            return self.send(200, json.dumps(r).encode())
        except Exception as e:
            return self.send(500, json.dumps(str(e)).encode())

ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
