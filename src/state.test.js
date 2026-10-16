const test = require('node:test');
const assert = require('node:assert/strict');
const { reduce, displayPhase, SUCCESS_IDLE_MS, BUSY_IDLE_MS, SETTLED_IDLE_MS } = require('./state');

test('发话进入思考，并清掉上一轮的失败', () => {
  const failed = { phase: 'error', failed: true, since: 1 };
  const next = reduce(failed, { event: 'beforeSubmitPrompt' }, 10);
  assert.deepEqual(next, { phase: 'thinking', failed: false, since: 10 });
});

test('用工具时算正在干活', () => {
  const thinking = reduce(null, { event: 'beforeSubmitPrompt' }, 1);
  const working = reduce(thinking, { event: 'preToolUse', ok: true }, 2);
  assert.equal(working.phase, 'working');
  assert.equal(working.failed, false);
});

test('工具失败先显示出错，之后继续干活仍记住失败', () => {
  let state = reduce(null, { event: 'beforeSubmitPrompt' }, 1);
  state = reduce(state, { event: 'postToolUseFailure', ok: false }, 2);
  assert.equal(state.phase, 'error');
  assert.equal(state.failed, true);
  state = reduce(state, { event: 'preToolUse', ok: true }, 3);
  assert.equal(state.phase, 'working');
  assert.equal(state.failed, true);
  state = reduce(state, { event: 'stop', ok: true }, 4);
  assert.equal(state.phase, 'error');
  assert.equal(state.failed, false);
});

test('顺利结束显示做完了', () => {
  let state = reduce(null, { event: 'preToolUse', ok: true }, 1);
  state = reduce(state, { event: 'stop', ok: true }, 2);
  assert.equal(state.phase, 'success');
});

test('这一轮被标成 error 时，结束也是出错', () => {
  const state = reduce({ phase: 'working', failed: false, since: 1 }, { event: 'stop', ok: false }, 2);
  assert.equal(state.phase, 'error');
});

test('你中途停下就回到闲着', () => {
  const state = reduce(
    { phase: 'working', failed: true, since: 1 },
    { event: 'stop', interrupt: true, ok: false },
    2,
  );
  assert.deepEqual(state, { phase: 'idle', failed: false, since: 2 });
});

test('已经在干活时，后到的思考不再把动作退回去', () => {
  const working = { phase: 'working', failed: false, since: 1 };
  const next = reduce(working, { event: 'afterAgentThought' }, 2);
  assert.equal(next.phase, 'working');
});

test('不认识的事件保持原样', () => {
  const state = { phase: 'thinking', failed: false, since: 1 };
  assert.equal(reduce(state, { event: 'beforeShellExecution' }, 2), state);
});

test('做完和出错过几秒回到闲着，干活中不会那么快消失', () => {
  const success = { phase: 'success', failed: false, since: 0 };
  assert.equal(displayPhase(success, SUCCESS_IDLE_MS - 1), 'success');
  assert.equal(displayPhase(success, SUCCESS_IDLE_MS), 'idle');

  const working = { phase: 'working', failed: false, since: 0, toolOpen: true };
  assert.equal(displayPhase(working, BUSY_IDLE_MS - 1), 'working');
  assert.equal(displayPhase(working, BUSY_IDLE_MS), 'idle');

  const finished = reduce(working, { event: 'postToolUse', ok: true }, 10);
  assert.equal(finished.toolOpen, false);
  assert.equal(displayPhase(finished, 10 + SETTLED_IDLE_MS - 1), 'working');
  assert.equal(displayPhase(finished, 10 + SETTLED_IDLE_MS), 'idle');
});
