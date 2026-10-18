const CLIPS = {
  idle: 'grok-idle.png',
  thinking: 'grok-thinking.png',
  working: 'grok-working.png',
  success: 'grok-success.png',
  error: 'grok-error.png',
  drag: 'grok-drag.png',
};

// 每个 phase 对应的"头上装饰"（气泡/汗滴/星星），null 表示不显示。
const DECOR_FOR = {
  idle: null,
  thinking: 'bubble',
  working: null,
  success: 'spark',
  error: 'sweat',
  drag: null,
};

const PHASES = Object.keys(CLIPS);
const PHASE_CLASSES = PHASES.map((p) => `phase-${p}`);

const clip = document.querySelector('#clip');
const sprite = document.querySelector('#sprite');
const decors = {
  bubble: document.querySelector('.decor-bubble'),
  sweat: document.querySelector('.decor-sweat'),
  spark: document.querySelector('.decor-spark'),
};

const bubble = document.querySelector('#bubble');
const menu = document.querySelector('#menu');
const balance = document.querySelector('#balance');
const todayLine = document.querySelector('#today');
const talkForm = document.querySelector('#talk');
const talkInput = document.querySelector('#talk-input');

let clipName = '';
let override = null;
let phase = 'idle';
let dragging = false;
let balanceText = '';
let balanceUntil = 0;
let noticeClip = null;
let noticeUntil = 0;

function clipUrl(name) {
  const file = CLIPS[name] || CLIPS.idle;
  return new URL(`../../assets/webm/${file}`, window.location.href).href;
}

function showClip(name) {
  const next = CLIPS[name] ? name : 'idle';
  if (next === clipName) return;
  clipName = next;
  // 关键帧 PNG：换 src 让 Electron 直接走 file://，避免重复解码开销。
  clip.src = clipUrl(next);
  // 给 sprite 加 phase class，CSS keyframes 接管动作循环。
  sprite.classList.remove(...PHASE_CLASSES);
  sprite.classList.add(`phase-${next}`);
  // 头上装饰按 phase 切换：最多一个可见，避免互相打架。
  for (const [kind, el] of Object.entries(decors)) {
    el.hidden = DECOR_FOR[next] !== kind;
  }
}

function render() {
  const shown = override || (noticeClip && Date.now() < noticeUntil ? noticeClip : phase);
  showClip(shown);
  const balanceOn = balanceText && Date.now() < balanceUntil;
  const text = shown === 'drag' ? '被你拖住了' : balanceOn ? balanceText : bubble.dataset.text || '';
  const visible = shown === 'drag' || balanceOn || text !== '';
  bubble.hidden = !visible;
  bubble.textContent = shown === 'drag' ? '被你拖住了' : text;
}

async function refresh() {
  try {
    const data = await window.pet.getState();
    phase = data.phase || 'idle';
    bubble.dataset.text = data.bubble || '';
    render();
  } catch {
    // 服务还没起来时保持当前画面。
  }
}

window.pet.onOverride((value) => {
  if (value === 'drag' && !dragging) return;
  override = value === 'flight' ? 'drag' : value || null;
  if (!dragging) sprite.classList.remove('dragging');
  render();
});

window.pet.onNotice((payload) => {
  balanceText = (payload && payload.text) || '';
  balanceUntil = Date.now() + 12000;
  noticeClip = (payload && payload.clip) || 'error';
  noticeUntil = balanceUntil;
  render();
});

let dragId = 0;

sprite.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (!menu.hidden) {
    menu.hidden = true;
    fitMenu();
  }
  dragging = true;
  dragId += 1;
  override = 'drag';
  render();
  sprite.classList.add('dragging');
  sprite.setPointerCapture(event.pointerId);
  window.pet.dragStart(dragId);
});

sprite.addEventListener('pointermove', () => {
  if (!dragging) return;
  window.pet.dragMove();
});

function endDrag() {
  if (!dragging) return;
  const id = dragId;
  dragging = false;
  override = null;
  sprite.classList.remove('dragging');
  render();
  window.pet.pointerUp(id);
  window.pet.setInteractive(sprite.matches(':hover') || !menu.hidden);
}

sprite.addEventListener('pointerenter', () => window.pet.setInteractive(true));
sprite.addEventListener('pointerleave', () => {
  if (!dragging && menu.hidden) window.pet.setInteractive(false);
});

sprite.addEventListener('pointerup', endDrag);
sprite.addEventListener('pointercancel', endDrag);
sprite.addEventListener('lostpointercapture', endDrag);

const SPRITE_TOP_GAP = 82;

async function fitMenu() {
  let extra = 0;
  if (!menu.hidden) {
    const bubbleSpace = bubble.hidden ? 0 : bubble.offsetHeight + 6;
    extra = Math.max(0, menu.offsetHeight + 8 + bubbleSpace - SPRITE_TOP_GAP);
  }
  await window.pet.setMenuSpace(extra);
}

async function closeMenu() {
  menu.hidden = true;
  await fitMenu();
}

document.addEventListener('contextmenu', async (event) => {
  event.preventDefault();
  menu.hidden = false;
  window.pet.setInteractive(true);
  await fitMenu();
  showToday();
  showBalance();
});

async function showToday() {
  try {
    const result = await window.pet.getToday();
    todayLine.textContent = (result && result.text) || '今天还没干活';
  } catch {
    todayLine.textContent = '今天的记录没读到';
  }
}

talkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  panelToken += 1;
  const text = talkInput.value;
  talkInput.value = '';
  balance.textContent = '在听…';
  try {
    const result = await window.pet.say(text);
    const reply = (result && result.text) || '这句没接住';
    balance.textContent = reply;
    balanceText = reply;
    balanceUntil = Date.now() + 15000;
    render();
    await fitMenu();
  } catch {
    balance.textContent = '这句没接住';
  }
});

let panelToken = 0;

function formatCached(result) {
  const age = Date.now() - Number(result.fetchedAt || 0);
  const minutes = Math.max(0, Math.round(age / 60000));
  const when = result.fetchedAt ? `\n${minutes} 分钟前查的，点刷新才重新问` : '';
  return `${result.text}\n${result.detail}${when}`;
}

async function showBalance() {
  const token = ++panelToken;
  try {
    const result = await window.pet.getBalance(false);
    if (token !== panelToken) return;
    if (!result || !result.ok) {
      balance.textContent = (result && result.message) || '还没查过。点刷新才会问 Cursor';
      await fitMenu();
      return;
    }
    balance.textContent = formatCached(result);
    balanceText = result.text;
    balanceUntil = Date.now() + 10000;
    render();
    await fitMenu();
  } catch {
    if (token === panelToken) balance.textContent = '还没查过。点刷新才会问 Cursor';
  }
}

document.querySelector('#refresh-balance').addEventListener('click', async () => {
  const token = ++panelToken;
  balance.textContent = '正在查余额…';
  await fitMenu();
  try {
    const result = await window.pet.getBalance(true);
    if (token !== panelToken) return;
    if (!result || !result.ok) {
      balance.textContent = (result && result.message) || '查不到余额';
      return;
    }
    balance.textContent = formatCached(result);
    balanceText = result.text;
    balanceUntil = Date.now() + 10000;
    render();
    await fitMenu();
  } catch {
    if (token === panelToken) balance.textContent = '查不到余额';
  }
});

document.querySelector('#quit').addEventListener('click', () => {
  window.pet.quit();
});

const reset = document.querySelector('#reset');
if (reset) {
  reset.addEventListener('click', async () => {
    await closeMenu();
    window.pet.resetPosition();
  });
}

const hide = document.querySelector('#hide');
if (hide) {
  hide.addEventListener('click', async () => {
    await closeMenu();
    window.pet.hide();
  });
}

document.addEventListener('pointerdown', async (event) => {
  if (menu.hidden || menu.contains(event.target)) return;
  await closeMenu();
  if (!sprite.contains(event.target)) window.pet.setInteractive(false);
});

showClip('idle');
refresh();
setInterval(refresh, 400);
