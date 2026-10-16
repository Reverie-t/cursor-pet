function startOfLocalDay(now) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function summarizeToday(events, now = Date.now()) {
  const from = startOfLocalDay(now);
  const list = (events || [])
    .filter((event) => event && event.ts >= from && event.ts <= now)
    .sort((a, b) => a.ts - b.ts);
  let activeFrom = null;
  let ms = 0;
  let success = 0;
  let failure = 0;
  for (const event of list) {
    const active = event.phase === 'thinking' || event.phase === 'working';
    if (active) {
      if (activeFrom == null) activeFrom = event.ts;
    } else if (activeFrom != null) {
      ms += event.ts - activeFrom;
      activeFrom = null;
    }
    if (event.event === 'stop' && !event.interrupt) {
      if (event.phase === 'success') success += 1;
      else if (event.phase === 'error') failure += 1;
    }
  }
  if (activeFrom != null) ms += now - activeFrom;
  return { ms, success, failure };
}

function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return '不到 1 分钟';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} 分钟`;
  if (rest === 0) return `${hours} 小时`;
  return `${hours} 小时 ${rest} 分钟`;
}

function formatToday(summary) {
  if (summary.ms < 60000 && summary.success === 0 && summary.failure === 0) {
    return { ...summary, text: '今天还没干活' };
  }
  return {
    ...summary,
    text: `今天 ${formatDuration(summary.ms)} · 成功 ${summary.success} · 失败 ${summary.failure}`,
  };
}

module.exports = { formatDuration, formatToday, summarizeToday };
