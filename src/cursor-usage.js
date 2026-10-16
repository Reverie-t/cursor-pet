const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { formatMoney, parsePlanPrice, remainingAmount } = require('./money');

const USAGE_URL = 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage';
const PLAN_URL = 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetPlanInfo';

function readToken() {
  const dbPath = path.join(process.env.APPDATA, 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare(`SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'`).get();
  db.close();
  if (!row || !row.value) throw new Error('没有登录 Cursor');
  return String(row.value);
}

async function postJson(url, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) throw new Error(`用量接口返回 ${response.status}`);
  return response.json();
}

async function loadBalance() {
  const token = readToken();
  const [usage, plan] = await Promise.all([postJson(USAGE_URL, token), postJson(PLAN_URL, token)]);
  const price = parsePlanPrice(plan && plan.planInfo && plan.planInfo.price);
  const percent = usage && usage.planUsage ? Number(usage.planUsage.autoPercentUsed) : Number.NaN;
  if (!price) throw new Error('没有读到套餐金额');
  if (!Number.isFinite(percent)) throw new Error('没有读到消耗百分比');
  const remaining = remainingAmount(price.amount, percent);
  const planName = (plan.planInfo && plan.planInfo.planName) || '套餐';
  return {
    ok: true,
    planName,
    planLabel: price.label,
    percent,
    remaining,
    text: `剩余 ${formatMoney(remaining)}`,
    detail: `${planName} ${price.label} · 已用 ${Math.round(percent * 10) / 10}%`,
  };
}

async function main() {
  try {
    const balance = await loadBalance();
    process.stdout.write(`${JSON.stringify(balance)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, message: error.message || '查余额失败' })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { loadBalance };
