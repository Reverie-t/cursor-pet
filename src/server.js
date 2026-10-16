const http = require('http');
const fs = require('fs');
const path = require('path');
const { KNOWN, reduce, view } = require('./state');

const MAX_BODY = 1024;

function sanitize(input) {
  if (!input || typeof input !== 'object') return null;
  const event = typeof input.event === 'string' ? input.event : '';
  if (!KNOWN.has(event)) return null;
  return {
    event,
    ok: input.ok !== false,
    interrupt: input.interrupt === true,
  };
}

function createPetServer(options = {}) {
  let state = null;
  const logFile = options.logFile || null;

  function accept(incoming, now = Date.now()) {
    const clean = sanitize(incoming);
    if (!clean) return null;
    state = reduce(state, clean, now);
    if (logFile) appendLog(logFile, { ts: now, ...clean, phase: state.phase });
    return view(state, now);
  }

  function current(now = Date.now()) {
    return view(state, now);
  }

  function takeInbox(file) {
    if (!file || !fs.existsSync(file)) return 0;
    const taken = `${file}.${process.pid}.take`;
    try {
      fs.renameSync(file, taken);
    } catch {
      return 0;
    }
    const text = fs.readFileSync(taken, 'utf8');
    fs.unlinkSync(taken);
    let count = 0;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        if (accept(JSON.parse(line))) count += 1;
      } catch {
        // 坏行丢掉，不让一条记录卡住后面的。
      }
    }
    return count;
  }

  const server = http.createServer((req, res) => {
    const remote = req.socket.remoteAddress;
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      res.writeHead(403);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/state') {
      sendJson(res, 200, current());
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'POST' || req.url !== '/event') {
      sendJson(res, 404, { ok: false });
      return;
    }

    const length = Number(req.headers['content-length'] || 0);
    if (length > MAX_BODY) {
      res.writeHead(413);
      res.end();
      return;
    }

    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        res.writeHead(413);
        res.end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        sendJson(res, 400, { ok: false });
        return;
      }
      const next = accept(body);
      if (!next) {
        sendJson(res, 400, { ok: false });
        return;
      }
      sendJson(res, 200, next);
    });
  });

  return {
    server,
    accept,
    current,
    takeInbox,
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          const address = server.address();
          resolve(address.port);
        });
      });
    },
  };
}

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

function appendLog(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
  const size = fs.statSync(file).size;
  if (size <= 2 * 1024 * 1024) return;
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  fs.writeFileSync(file, `${lines.slice(-8000).join('\n')}\n`);
}

module.exports = { createPetServer, sanitize };
