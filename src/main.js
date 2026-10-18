const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createPetServer } = require('./server');
const { WINDOW, clampWindow, limitsFor } = require('./desktop-bounds');
const { nextAlert } = require('./alert');
const { replyTo } = require('./talk');
const { formatToday, summarizeToday } = require('./today');

// Windows 上开着硬件加速时，透明窗口里的画面经常整块画不出来。
if (process.platform === 'win32') app.disableHardwareAcceleration();

const PET_DIR = path.join(__dirname, '..');
const LOG_DIR = path.join(PET_DIR, 'logs');
const PORT_FILE = path.join(LOG_DIR, 'port');
const INBOX = path.join(LOG_DIR, 'inbox.jsonl');
const WINDOW_FILE = path.join(LOG_DIR, 'window.json');
const ALERT_FILE = path.join(LOG_DIR, 'balance-alert.json');
const BALANCE_CACHE = path.join(LOG_DIR, 'balance-cache.json');
const SETTINGS_FILE = path.join(LOG_DIR, 'pet-settings.json');
const BALANCE_TTL = 30 * 60 * 1000;
const STARTING = path.join(LOG_DIR, 'starting');
const WIDTH = WINDOW.width;
const HEIGHT = WINDOW.height;
const THROW_SPEED = 700;

let win = null;
let tray = null;
let motion = null;
let grab = null;
let menuExtra = 0;
const dragSamples = [];
let petServer = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function bootLog(message) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'boot.log'), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // 日志写不了也不能挡住窗口。
  }
}

function loadPosition() {
  try {
    const saved = JSON.parse(fs.readFileSync(WINDOW_FILE, 'utf8'));
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch {
    // 没有存过位置就用右下角。
  }
  return null;
}

function defaultPosition() {
  const area = screen.getPrimaryDisplay().workArea;
  const limits = limitsFor(area);
  return {
    x: limits.maxX - 24,
    y: limits.maxY - 24,
  };
}

function savePosition(bounds) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(WINDOW_FILE, JSON.stringify({ x: bounds.x, y: bounds.y }));
  } catch (error) {
    bootLog(`save position failed: ${error.message}`);
  }
}

function workAreaFor(bounds) {
  return screen.getDisplayMatching(bounds).workArea;
}

function place(x, y) {
  const area = workAreaFor(win.getBounds());
  const shifted = clampWindow(x, y + menuExtra, area);
  const next = { x: shifted.x, y: shifted.y - menuExtra };
  // 尺寸必须用最初的宽高。用 getBounds() 读回来再写回去，Windows 缩放取整会让窗口越变越大。
  win.setBounds({ ...next, width: WIDTH, height: HEIGHT + menuExtra });
  return next;
}

function setMenuSpace(extra) {
  const next = Math.max(0, Math.round(Number(extra) || 0));
  if (!win || next === menuExtra) return;
  const bounds = win.getBounds();
  const delta = next - menuExtra;
  menuExtra = next;
  win.setBounds({
    x: bounds.x,
    y: bounds.y - delta,
    width: WIDTH,
    height: HEIGHT + menuExtra,
  });
}

function sendOverride(value) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('override', value);
}

function stopMotion(save) {
  motion = null;
  grab = null;
  dragSamples.length = 0;
  sendOverride(null);
  if (save && win && !win.isDestroyed()) savePosition(win.getBounds());
}

function noteCursor() {
  const cursor = screen.getCursorScreenPoint();
  dragSamples.push({ x: cursor.x, y: cursor.y, t: Date.now() });
  while (dragSamples.length > 6) dragSamples.shift();
  return cursor;
}

function dragVelocity() {
  if (dragSamples.length < 2) return { vx: 0, vy: 0 };
  const start = dragSamples[0];
  const end = dragSamples[dragSamples.length - 1];
  const dt = (end.t - start.t) / 1000;
  if (dt <= 0.016) return { vx: 0, vy: 0 };
  return { vx: (end.x - start.x) / dt, vy: (end.y - start.y) / dt };
}

function followCursor() {
  if (!win || !grab) return;
  const cursor = noteCursor();
  const desiredX = cursor.x + grab.x;
  const desiredY = cursor.y + grab.y;
  const next = place(desiredX, desiredY);
  const clamped = next.x !== Math.round(desiredX) || next.y !== Math.round(desiredY);
  if (clamped) grab = { x: next.x - cursor.x, y: next.y - cursor.y };
}

function stepMotion() {
  if (!motion || !win || win.isDestroyed()) return;
  const dt = 0.016;
  motion.vy += 2400 * dt;
  motion.x += motion.vx * dt;
  motion.y += motion.vy * dt;

  const limits = limitsFor(workAreaFor(win.getBounds()));
  const maxX = limits.maxX;
  const minY = limits.minY - menuExtra;
  const maxY = limits.maxY - menuExtra;

  if (motion.x < limits.minX) {
    motion.x = limits.minX;
    motion.vx = Math.abs(motion.vx) * 0.55;
  } else if (motion.x > maxX) {
    motion.x = maxX;
    motion.vx = -Math.abs(motion.vx) * 0.55;
  }

  if (motion.y < minY) {
    motion.y = minY;
    motion.vy = Math.abs(motion.vy) * 0.4;
  } else if (motion.y > maxY) {
    motion.y = maxY;
    motion.vy = -Math.abs(motion.vy) * 0.32;
    motion.vx *= 0.78;
    if (Math.abs(motion.vy) < 120) motion.vy = 0;
  }

  win.setBounds({
    x: Math.round(motion.x),
    y: Math.round(motion.y),
    width: WIDTH,
    height: HEIGHT + menuExtra,
  });

  const resting = motion.vy === 0 && Math.abs(motion.vx) < 30 && motion.y >= maxY - 1;
  if (resting) stopMotion(true);
}

function createWindow(port) {
  const saved = loadPosition() || defaultPosition();
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: saved.x,
    y: saved.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    show: false,
    title: '桌宠',
    icon: path.join(PET_DIR, 'assets', 'webm', 'grok-idle.png'),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      // 关键帧在上一级目录。关掉网页安全限制，页面才能读到这些本地 PNG。
      webSecurity: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenuBarVisibility(false);
  win.webContents.on('console-message', (event) => {
    if (event.message) bootLog(`console ${event.message}`);
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.once('ready-to-show', () => {
    place(win.getBounds().x, win.getBounds().y);
    win.setIgnoreMouseEvents(true, { forward: true });
    win.showInactive();
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: { port: String(port) },
  });
}

async function listen(port) {
  try {
    return await petServer.listen(port);
  } catch (error) {
    if (error.code === 'EADDRINUSE' && port < 7346) return listen(port + 1);
    throw error;
  }
}

function showPet() {
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) win.showInactive();
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function hidePet() {
  if (!win || win.isDestroyed()) return;
  stopMotion(true);
  win.hide();
  if (tray) return;
  const image = nativeImage
    .createFromPath(path.join(PET_DIR, 'assets', 'webm', 'grok-idle.png'))
    .resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('桌宠藏起来了，单击把它叫出来');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示', click: showPet },
    { label: '退出', click: () => app.quit() },
  ]));
  tray.on('click', showPet);
}

app.on('second-instance', () => {
  showPet();
});

app.on('before-quit', () => {
  if (tray) tray.destroy();
});

app.whenReady().then(async () => {
  if (!gotLock) return;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  petServer = createPetServer({ logFile: path.join(LOG_DIR, 'events.jsonl') });
  let port = 7341;
  try {
    port = await listen(7341);
    fs.writeFileSync(PORT_FILE, String(port));
    fs.rmSync(STARTING, { force: true });
    petServer.takeInbox(INBOX);
    setInterval(() => petServer.takeInbox(INBOX), 400);
    setInterval(stepMotion, 16);
    bootLog(`listening ${port}`);
    setTimeout(() => checkBalanceAlert(), 8000);
    setInterval(() => checkBalanceAlert(), BALANCE_TTL);
  } catch (error) {
    bootLog(`listen failed: ${error.message}`);
  }
  createWindow(port);
});

app.on('window-all-closed', () => {
  app.quit();
});

const releasedDrags = new Set();

ipcMain.on('drag-start', (_event, id) => {
  if (!win) return;
  if (releasedDrags.has(id)) {
    releasedDrags.delete(id);
    return;
  }
  motion = null;
  const cursor = noteCursor();
  const bounds = win.getBounds();
  grab = { id, x: bounds.x - cursor.x, y: bounds.y - cursor.y };
  sendOverride('drag');
});

ipcMain.on('drag-move', () => {
  if (!win || !grab) return;
  motion = null;
  followCursor();
});

ipcMain.on('pointer-up', (_event, id) => {
  if (!win) return;
  if (!grab || grab.id !== id) {
    releasedDrags.add(id);
    sendOverride(null);
    return;
  }
  const speed = dragVelocity();
  const moving = Math.hypot(speed.vx, speed.vy);
  grab = null;
  dragSamples.length = 0;
  if (moving < THROW_SPEED) {
    stopMotion(true);
    return;
  }
  const bounds = win.getBounds();
  motion = { x: bounds.x, y: bounds.y, vx: speed.vx, vy: speed.vy };
  sendOverride('flight');
});

ipcMain.on('reset-position', () => {
  if (!win) return;
  stopMotion(false);
  menuExtra = 0;
  const next = defaultPosition();
  win.setBounds({ ...next, width: WIDTH, height: HEIGHT });
  savePosition(next);
});

ipcMain.handle('set-menu-space', (_event, extra) => {
  setMenuSpace(extra);
});

ipcMain.on('interactive', (_event, on) => {
  if (!win || grab) return;
  win.setIgnoreMouseEvents(on !== true, { forward: true });
});

ipcMain.on('hide', () => {
  hidePet();
});

ipcMain.on('quit', () => {
  app.quit();
});

function nodeBin() {
  const found = spawnSync('where.exe', ['node'], { encoding: 'utf8', windowsHide: true });
  const line = String(found.stdout || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  return line || 'node';
}

function readBalance() {
  return new Promise((resolve) => {
    const child = spawn(nodeBin(), [path.join(PET_DIR, 'src', 'cursor-usage.js')], {
      windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.on('error', () => resolve({ ok: false, message: '查余额失败' }));
    child.on('close', () => {
      try {
        resolve(JSON.parse(out.trim().split('\n').pop()));
      } catch {
        resolve({ ok: false, message: '查余额失败' });
      }
    });
  });
}

function readBalanceCache() {
  try {
    const saved = JSON.parse(fs.readFileSync(BALANCE_CACHE, 'utf8'));
    if (saved && saved.ok && Date.now() - saved.fetchedAt < BALANCE_TTL) return saved;
  } catch {
    // 没有缓存就等用户点刷新。
  }
  return null;
}

function rememberBalance(balance) {
  if (!balance || !balance.ok) return balance;
  const saved = { ...balance, fetchedAt: Date.now() };
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(BALANCE_CACHE, JSON.stringify(saved));
  return saved;
}

async function loadBalance(refresh) {
  if (!refresh) {
    const cached = readBalanceCache();
    if (cached) return cached;
    if (refresh === false) return { ok: false, message: '还没查过。点刷新才会问 Cursor' };
  }
  const balance = rememberBalance(await readBalance());
  return balance;
}

ipcMain.handle('get-balance', (_event, refresh) => loadBalance(refresh === true));

function readEvents() {
  const file = path.join(LOG_DIR, 'events.jsonl');
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((event) => event && Number.isFinite(event.ts));
  } catch {
    return [];
  }
}

function todaySummary() {
  return formatToday(summarizeToday(readEvents()));
}

function alertThreshold() {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    const value = Number(settings.alertPercent);
    if (value >= 1 && value <= 100) return value;
  } catch {
    // 没写设置就用 80%。
  }
  return 80;
}

function localDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

let alertBusy = false;

async function checkBalanceAlert() {
  if (alertBusy || !win || win.isDestroyed()) return;
  alertBusy = true;
  try {
    let balance = await loadBalance(false);
    if (!balance || !balance.ok) balance = await loadBalance(true);
    if (!balance || !balance.ok) return;
    const today = localDate();
    let saved = { date: today, sent: [] };
    try {
      saved = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
    } catch {
      saved = { date: today, sent: [] };
    }
    if (saved.date !== today) saved = { date: today, sent: [] };
    const level = nextAlert(balance.percent, saved.sent, alertThreshold());
    if (level == null) return;
    saved.sent.push(level);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(ALERT_FILE, JSON.stringify(saved));
    win.webContents.send('notice', {
      text: `额度用了 ${Math.round(balance.percent)}%，${balance.text}`,
      clip: 'error',
    });
  } catch (error) {
    bootLog(`balance alert failed: ${error.message}`);
  } finally {
    alertBusy = false;
  }
}

ipcMain.handle('get-today', () => todaySummary());

ipcMain.handle('say', async (_event, text) => {
  const today = todaySummary();
  const needsBalance = /余额|额度|钱|剩/.test(String(text || ''));
  const balance = needsBalance ? await loadBalance(false) : null;
  return { ok: true, text: replyTo(text, { today, balance }) };
});

ipcMain.handle('get-state', () => {
  if (!petServer) return { phase: 'idle', bubble: '', since: Date.now() };
  return petServer.current();
});
