const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PET_DIR = path.resolve(__dirname, '..');
const LOG_DIR = path.join(PET_DIR, 'logs');
const INBOX = path.join(LOG_DIR, 'inbox.jsonl');
const PORT_FILE = path.join(LOG_DIR, 'port');
const STARTING = path.join(LOG_DIR, 'starting');

function readPort() {
  try {
    const port = Number(fs.readFileSync(PORT_FILE, 'utf8'));
    if (port > 0 && port < 65536) return port;
  } catch {
    // 还没写过端口就用默认值。
  }
  return 7341;
}

function post(payload) {
  const body = JSON.stringify({
    event: payload.event,
    ok: payload.ok !== false,
    interrupt: payload.interrupt === true,
  });
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: readPort(),
        path: '/event',
        method: 'POST',
        timeout: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end(body);
  });
}

function enqueue(payload) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(
    INBOX,
    `${JSON.stringify({
      event: payload.event,
      ok: payload.ok !== false,
      interrupt: payload.interrupt === true,
    })}\n`,
  );
}

function electronExe() {
  const electron = require(path.join(PET_DIR, 'node_modules', 'electron'));
  return typeof electron === 'string' ? electron : '';
}

function ensurePet() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  try {
    const age = Date.now() - fs.statSync(STARTING).mtimeMs;
    if (age >= 0 && age < 20000) return;
  } catch {
    // 没有启动标记，可以拉起。
  }
  let exe = '';
  try {
    exe = electronExe();
  } catch {
    return;
  }
  if (!exe || !fs.existsSync(exe)) return;
  fs.writeFileSync(STARTING, String(Date.now()));
  const child = spawn(exe, [PET_DIR], {
    cwd: PET_DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

async function notify(payload) {
  if (!payload || !payload.event) return;
  const delivered = await post(payload);
  if (delivered) return;
  try {
    enqueue(payload);
    ensurePet();
  } catch {
    // 通知失败也不能影响 Cursor。
  }
}

module.exports = { notify };
