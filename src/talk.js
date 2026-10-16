function replyTo(text, context = {}) {
  const said = String(text || '').trim().slice(0, 80);
  if (!said) return '你想说什么？';
  if (/余额|额度|钱|剩/.test(said)) {
    if (context.balance && context.balance.ok) {
      return `${context.balance.text}。${context.balance.detail}`;
    }
    return '还没查过余额。点菜单里的刷新才会问 Cursor。';
  }
  if (/多久|今天/.test(said) && context.today && context.today.text) {
    return context.today.text;
  }
  if (/累|烦|困/.test(said)) return '先歇一下。我在这儿看着。';
  if (/谢谢|不错|好了|完成/.test(said)) return '听到了。你继续的话我跟着。';
  if (/你好|在吗|嗨|哈喽/.test(said)) return '在。今天我看着你干活。';
  return `听到了：「${said}」。`;
}

module.exports = { replyTo };
