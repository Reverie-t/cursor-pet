const { spawnSync } = require('child_process');
const { notify } = require('./notify');

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', () => resolve(Buffer.concat(chunks)));
  });
}

function fields(event, raw) {
  const payload = { event, ok: true, interrupt: false };
  try {
    const data = JSON.parse(raw.toString('utf8') || '{}');
    if (event === 'stop' && data.status === 'error') payload.ok = false;
    if (event === 'stop' && data.status === 'aborted') payload.interrupt = true;
  } catch {
    // 解析不了就只报事件名。
  }
  return payload;
}

async function main() {
  const event = process.argv[2] || '';
  const command = process.argv[3];
  const args = process.argv.slice(4);
  const input = await readStdin();
  let status = 0;
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);

  if (command) {
    const child = spawnSync(command, args, {
      input,
      timeout: 50000,
      windowsHide: true,
    });
    stdout = child.stdout || Buffer.alloc(0);
    stderr = child.stderr || Buffer.alloc(0);
    status = child.status === null ? 1 : child.status;
  }

  if (stdout.length) process.stdout.write(stdout);
  if (stderr.length) process.stderr.write(stderr);
  await notify(fields(event, input));
  process.exit(status);
}

main().catch(() => process.exit(0));
