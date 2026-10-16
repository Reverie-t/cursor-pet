function nextAlert(percent, sent, threshold = 80) {
  const floor = Math.min(100, Math.max(1, Number(threshold) || 80));
  const levels = [...new Set([floor, 95, 100].filter((level) => level >= floor))].sort((a, b) => a - b);
  return levels.find((level) => percent >= level && !(sent || []).includes(level)) ?? null;
}

module.exports = { nextAlert };
