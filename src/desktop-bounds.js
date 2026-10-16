const WINDOW = { width: 300, height: 240 };

// 画面是 1024 方图，放进 280×158 的横框后左右留白。
// 身体位置按 grok-idle.png 的不透明像素量过，相对整个 300×240 窗口。
const BODY = { x: 94, y: 90, width: 110, height: 142 };

function limitsFor(area) {
  return {
    minX: area.x - BODY.x,
    maxX: area.x + area.width - BODY.x - BODY.width,
    minY: area.y - BODY.y,
    maxY: area.y + area.height - BODY.y - BODY.height,
  };
}

function clampWindow(x, y, area) {
  const limits = limitsFor(area);
  return {
    x: Math.round(Math.min(Math.max(limits.minX, x), limits.maxX)),
    y: Math.round(Math.min(Math.max(limits.minY, y), limits.maxY)),
  };
}

module.exports = { BODY, WINDOW, clampWindow, limitsFor };
