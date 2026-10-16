const test = require('node:test');
const assert = require('node:assert/strict');
const { formatMoney, parsePlanPrice, remainingAmount } = require('./money');

test('套餐价能从 Cursor 的价格文案里取出来', () => {
  assert.deepEqual(parsePlanPrice('$20/mo'), { amount: 20, currency: 'USD', label: '$20/mo' });
});

test('剩余金额等于套餐金额乘以还没用掉的比例', () => {
  assert.equal(remainingAmount(20, 34.30666666666667), 13.14);
  assert.equal(remainingAmount(20, 0), 20);
  assert.equal(remainingAmount(20, 100), 0);
  assert.equal(remainingAmount(20, 140), 0);
});

test('金额显示保留两位小数', () => {
  assert.equal(formatMoney(13.14), '$13.14');
});
