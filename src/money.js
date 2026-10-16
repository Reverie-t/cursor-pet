function parsePlanPrice(price) {
  const match = String(price || '').match(/\$(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { amount, currency: 'USD', label: String(price) };
}

function remainingAmount(planAmount, percentUsed) {
  const amount = Number(planAmount);
  const percent = Number(percentUsed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isFinite(percent)) return null;
  const used = Math.min(100, Math.max(0, percent));
  return Math.round(amount * (1 - used / 100) * 100) / 100;
}

function formatMoney(amount) {
  if (!Number.isFinite(amount)) return '';
  return `$${amount.toFixed(2)}`;
}

module.exports = { formatMoney, parsePlanPrice, remainingAmount };
