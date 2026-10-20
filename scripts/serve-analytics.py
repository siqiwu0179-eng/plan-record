"""Serve only the standalone dashboard on localhost; never expose repo/env files."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

DASHBOARD = Path(__file__).resolve().parent.parent / 'analytics.html'
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?', 1)[0] not in ('/', '/analytics.html'):
            self.send_error(404)
            return
        data = DASHBOARD.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

if __name__ == '__main__':
    print('Analytics: http://127.0.0.1:4318/analytics.html', flush=True)
    HTTPServer(('127.0.0.1', 4318), Handler).serve_forever()
