const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPetServer } = require('./server');

function post(port, body) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(raw),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          });
        });
      },
    );
    req.on('error', reject);
    req.end(raw);
  });
}

test('只接收阶段，发话到结束能走完一圈', async () => {
  const pet = createPetServer();
  const port = await pet.listen(0);
  try {
    const thinking = await post(port, {
      event: 'beforeSubmitPrompt',
      prompt: '这段不该被收下',
    });
    assert.equal(thinking.status, 200);
    assert.equal(thinking.body.phase, 'thinking');
    assert.equal(thinking.body.bubble, '正在想');

    const working = await post(port, { event: 'preToolUse', ok: true, tool_input: { command: 'secret' } });
    assert.equal(working.body.phase, 'working');

    const done = await post(port, { event: 'stop', ok: true, status: 'completed' });
    assert.equal(done.body.phase, 'success');
    assert.equal(done.body.bubble, '做完了');
  } finally {
    pet.server.close();
  }
});

test('不认识的事件直接拒绝', async () => {
  const pet = createPetServer();
  const port = await pet.listen(0);
  try {
    const res = await post(port, { event: 'beforeShellExecution' });
    assert.equal(res.status, 400);
  } finally {
    pet.server.close();
  }
});

test('宠物没起来时先记下的事件，起来后能补上', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-pet-'));
  const inbox = path.join(dir, 'inbox.jsonl');
  fs.writeFileSync(inbox, `${JSON.stringify({ event: 'beforeSubmitPrompt', ok: true })}\n`);
  const pet = createPetServer();
  const count = pet.takeInbox(inbox);
  assert.equal(count, 1);
  assert.equal(pet.current().phase, 'thinking');
  assert.equal(fs.existsSync(inbox), false);
});
