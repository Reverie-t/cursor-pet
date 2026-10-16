const test = require('node:test');
const assert = require('node:assert/strict');
const { nextAlert } = require('./alert');

test('过了门槛才提醒，同一档一天只报一次', () => {
  assert.equal(nextAlert(70, [], 80), null);
  assert.equal(nextAlert(82, [], 80), 80);
  assert.equal(nextAlert(96, [80], 80), 95);
  assert.equal(nextAlert(96, [80, 95], 80), null);
  assert.equal(nextAlert(100, [80, 95], 80), 100);
});
