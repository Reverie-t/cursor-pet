const test = require('node:test');
const assert = require('node:assert/strict');
const { formatToday, summarizeToday } = require('./today');

test('只统计本地今天的干活时间、成功和失败', () => {
  const now = new Date(2026, 9, 16, 15, 0, 0).getTime();
  const morning = new Date(2026, 9, 16, 9, 0, 0).getTime();
  const yesterday = morning - 24 * 60 * 60 * 1000;
  const summary = summarizeToday(
    [
      { ts: yesterday, event: 'preToolUse', phase: 'working' },
      { ts: yesterday + 60000, event: 'stop', phase: 'success', interrupt: false },
      { ts: morning, event: 'beforeSubmitPrompt', phase: 'thinking' },
      { ts: morning + 10 * 60000, event: 'stop', phase: 'success', interrupt: false },
      { ts: morning + 20 * 60000, event: 'preToolUse', phase: 'working' },
      { ts: morning + 25 * 60000, event: 'stop', phase: 'error', interrupt: false },
    ],
    now,
  );
  assert.equal(summary.success, 1);
  assert.equal(summary.failure, 1);
  assert.equal(summary.ms, 15 * 60000);
  assert.equal(formatToday(summary).text, '今天 15 分钟 · 成功 1 · 失败 1');
});

test('还在干活时，时间算到现在', () => {
  const now = new Date(2026, 9, 16, 15, 0, 0).getTime();
  const start = now - 2 * 60000;
  const summary = summarizeToday([{ ts: start, event: 'preToolUse', phase: 'working' }], now);
  assert.equal(summary.ms, 2 * 60000);
});
