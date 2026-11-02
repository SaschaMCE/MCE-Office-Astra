const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../app/web/browser');
const testing = process.argv.includes('--test');
const port = Number(process.env.MCE_PORT || (testing ? 4174 : 4173));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const name = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
    let body = fs.readFileSync(file);
    if (testing && file.endsWith('main-T4VOFCRR.js')) {
      if (process.env.MCE_TEST_BUNDLE) body = fs.readFileSync(process.env.MCE_TEST_BUNDLE);
      const hook = 'let r = this.arriveAt();';
      if (!body.includes(hook)) throw new Error('Test hook no longer matches the office initialization');
      body = body.toString().replace(hook, 'window.__mceView = this; window.__mcePlaces = pn; let r = this.arriveAt();');
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  } catch {res.writeHead(400);res.end('Invalid request');}
});
server.listen(port, '127.0.0.1', () => {console.log(`Office server listening on port ${port}`);process.send?.('ready');});
