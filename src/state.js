const SUCCESS_IDLE_MS = 6000;
const BUSY_IDLE_MS = 10 * 60 * 1000;
const SETTLED_IDLE_MS = 5000;

const BUBBLES = {
  idle: '',
  thinking: '正在想',
  working: '正在干活',
  success: '做完了',
  error: '这步没成',
  drag: '被你拖住了',
};

const KNOWN = new Set([
  'sessionStart',
  'sessionEnd',
  'beforeSubmitPrompt',
  'afterAgentThought',
  'preToolUse',
  'postToolUse',
  'postToolUseFailure',
  'stop',
]);

function fresh(now) {
  return { phase: 'idle', failed: false, since: now };
}

function reduce(state, incoming, now = Date.now()) {
  const base = state && state.phase ? state : fresh(now);
  const event = incoming && incoming.event;
  if (!KNOWN.has(event)) return base;

  if (event === 'sessionStart' || event === 'sessionEnd' || incoming.interrupt) {
    return fresh(now);
  }

  if (event === 'beforeSubmitPrompt') {
    return { phase: 'thinking', failed: false, since: now };
  }

  if (event === 'afterAgentThought') {
    if (base.phase === 'working') {
      return { phase: 'working', failed: base.failed, since: now, toolOpen: base.toolOpen === true };
    }
    return { phase: 'thinking', failed: base.failed, since: now };
  }

  if (event === 'preToolUse') {
    return {
      phase: 'working',
      failed: base.failed || incoming.ok === false,
      since: now,
      toolOpen: true,
    };
  }

  if (event === 'postToolUse') {
    return {
      phase: 'working',
      failed: base.failed || incoming.ok === false,
      since: now,
      toolOpen: false,
    };
  }

  if (event === 'postToolUseFailure') {
    return { phase: 'error', failed: true, since: now };
  }

  if (event === 'stop') {
    const failed = base.failed || incoming.ok === false;
    return { phase: failed ? 'error' : 'success', failed: false, since: now };
  }

  return base;
}

function displayPhase(state, now = Date.now()) {
  if (!state || !state.phase) return 'idle';
  const age = now - state.since;
  if ((state.phase === 'success' || state.phase === 'error') && age >= SUCCESS_IDLE_MS) {
    return 'idle';
  }
  if ((state.phase === 'thinking' || state.phase === 'working') && age >= BUSY_IDLE_MS) {
    return 'idle';
  }
  if (state.phase === 'working' && state.toolOpen !== true && age >= SETTLED_IDLE_MS) {
    return 'idle';
  }
  return state.phase;
}

function view(state, now = Date.now()) {
  const phase = displayPhase(state, now);
  return {
    phase,
    bubble: BUBBLES[phase] || '',
    since: state && state.since ? state.since : now,
  };
}

module.exports = {
  BUBBLES,
  BUSY_IDLE_MS,
  KNOWN,
  SETTLED_IDLE_MS,
  SUCCESS_IDLE_MS,
  displayPhase,
  reduce,
  view,
};
