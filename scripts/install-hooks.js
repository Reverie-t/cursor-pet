const fs = require('fs');
const path = require('path');

const hooksFile = path.join(process.env.USERPROFILE, '.cursor', 'hooks.json');
const petDir = path.resolve(__dirname, '..');
const signal = nodeCommand('cursor-pet-signal.js');
const forward = nodeCommand('cursor-pet-forward.js');

const ADDED = [
  ['afterAgentThought', '桌宠：它在想'],
  ['preToolUse', '桌宠：它开始用工具'],
  ['postToolUse', '桌宠：工具用完了'],
  ['postToolUseFailure', '桌宠：工具没成功'],
];

const WRAPPED = [
  ['beforeSubmitPrompt', 'before-submit-prompt.js', 'beforeSubmitPrompt'],
  ['stop', 'stop.js', 'stop'],
];

function nodeCommand(scriptName) {
  const script = path.join(petDir, 'hooks', scriptName);
  const hooksDir = path.dirname(hooksFile);
  let commandPath = path.relative(hooksDir, script);
  if (path.isAbsolute(commandPath)) commandPath = script;
  return `node ${commandPath.split(path.sep).join('/')}`;
}

function commandOf(event) {
  return `${signal} ${event}`;
}

function already(list, event) {
  return (list || []).some((hook) => String(hook.command || '').includes(`cursor-pet-signal.js ${event}`));
}

function main() {
  const original = fs.readFileSync(hooksFile, 'utf8');
  const backup = `${hooksFile}.bak-cursor-pet`;
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);

  const config = JSON.parse(original);
  config.hooks = config.hooks || {};

  for (const [event, description] of ADDED) {
    const list = config.hooks[event] || [];
    if (!already(list, event)) {
      list.push({
        command: commandOf(event),
        timeout: 3,
        description,
      });
    }
    config.hooks[event] = list;
  }

  for (const [event, marker, forwardEvent] of WRAPPED) {
    const list = config.hooks[event] || [];
    const index = list.findIndex((hook) => {
      const command = String(hook.command || '');
      return command.includes(marker) && !command.includes('cursor-pet-forward.js');
    });
    if (index === -1) continue;
    const previous = list[index];
    list[index] = {
      ...previous,
      command: `${forward} ${forwardEvent} ${previous.command}`,
      timeout: Math.max(Number(previous.timeout) || 0, 15),
      description: `${previous.description || event}；并通知桌宠`,
    };
    config.hooks[event] = list;
  }

  fs.writeFileSync(hooksFile, `${JSON.stringify(config, null, 2)}\n`);
}

main();
