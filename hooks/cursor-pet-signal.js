const { notify } = require('./notify');

const PERMISSION_EVENTS = new Set(['preToolUse']);

function drain() {
  return new Promise((resolve) => {
    let kept = '';
    const finish = () => resolve(kept);
    process.stdin.on('data', (chunk) => {
      if (kept.length < 65536) {
        kept += chunk.toString('utf8').slice(0, 65536 - kept.length);
      }
    });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

function fields(event, raw) {
  const payload = { event, ok: true, interrupt: false };
  try {
    const data = JSON.parse(raw || '{}');
    if (event === 'stop' && data.status === 'error') payload.ok = false;
    if (event === 'stop' && data.status === 'aborted') payload.interrupt = true;
    if (event === 'postToolUseFailure') {
      payload.ok = false;
      payload.interrupt = data.is_interrupt === true;
    }
  } catch {
    if (event === 'postToolUseFailure') payload.ok = false;
  }
  return payload;
}

async function main() {
  const event = process.argv[2] || '';
  const raw = await drain();
  await notify(fields(event, raw));
  if (PERMISSION_EVENTS.has(event)) {
    process.stdout.write('{"permission":"allow"}\n');
  }
  process.exit(0);
}

main().catch(() => {
  if (PERMISSION_EVENTS.has(process.argv[2] || '')) {
    process.stdout.write('{"permission":"allow"}\n');
  }
  process.exit(0);
});
