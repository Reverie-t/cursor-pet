const test = require('node:test');
const assert = require('node:assert/strict');
const { replyTo } = require('./talk');

test('问余额和今天时，用已经算好的数字回答', () => {
  const balance = { ok: true, text: '剩余 $12.97', detail: 'Pro $20/mo · 已用 35.1%' };
  const today = { text: '今天 15 分钟 · 成功 1 · 失败 0' };
  assert.match(replyTo('还剩多少钱', { balance }), /剩余 \$12\.97/);
  assert.equal(replyTo('今天用了多久', { today }), today.text);
});

test('没查过余额时，不主动去问 Cursor', () => {
  assert.match(replyTo('还剩多少钱', {}), /点菜单里的刷新/);
});

test('空话会要一句，普通话会复述', () => {
  assert.equal(replyTo('   '), '你想说什么？');
  assert.equal(replyTo('午饭吃什么'), '听到了：「午饭吃什么」。');
});
