const test = require('node:test');
const assert = require('node:assert/strict');
const { BODY, clampWindow, limitsFor } = require('./desktop-bounds');

const desktop = { x: 0, y: 0, width: 1707, height: 920 };

test('鱼的身体左右都能贴到桌面边缘', () => {
  const limits = limitsFor(desktop);
  assert.equal(limits.minX + BODY.x, desktop.x);
  assert.equal(limits.maxX + BODY.x + BODY.width, desktop.x + desktop.width);
  assert.equal(limits.minY + BODY.y, desktop.y);
  assert.equal(limits.maxY + BODY.y + BODY.height, desktop.y + desktop.height);
});

test('往左右外边拖，会被拉回到身体贴边', () => {
  const limits = limitsFor(desktop);
  assert.equal(clampWindow(-1000, 100, desktop).x, limits.minX);
  assert.equal(clampWindow(5000, 100, desktop).x, limits.maxX);
  assert.ok(limits.minX < 0);
  assert.ok(limits.maxX + 300 > desktop.width);
});
