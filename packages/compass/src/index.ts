import { Server, startHttpServer } from './server/server.ts';
import { Bus } from './bus/index.ts';
import { PartEvent, SessionEvent, ToolEvent } from './bus/bus-event.ts';
import { SessionManager } from './session/index.ts';
import { ConfigLoader } from './config/config.ts';
import { createInterface } from 'node:readline/promises';

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function paint(color: string, text: string) {
  return `${color}${text}${ansi.reset}`;
}

function now() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function hr() {
  const width = Math.max(40, Math.min(process.stdout.columns || 80, 120));
  return paint(ansi.gray, '─'.repeat(width));
}

function clear() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function ellipsis(text: string, max = 240) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function safeJson(value: any, max = 400) {
  try {
    return ellipsis(JSON.stringify(value), max);
  } catch {
    return ellipsis(String(value), max);
  }
}

async function runTUI() {
  let directory = process.cwd();
  let sessionId = 'test-session';
  const config = ConfigLoader.load();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prefixUser = `${paint(ansi.bold + ansi.green, 'You')} ${paint(ansi.gray, '›')} `;
  const prefixAssistant = `${paint(ansi.bold + ansi.cyan, 'Assistant')} ${paint(ansi.gray, '›')} `;
  const prefixTool = `${paint(ansi.bold + ansi.magenta, 'Tool')} ${paint(ansi.gray, '›')} `;

  const renderHeader = () => {
    clear();
    console.log(`${paint(ansi.bold + ansi.cyan, '🧭 OpenCode')} ${paint(ansi.gray, 'interactive')}`);
    console.log(
      `${paint(ansi.gray, 'session:')} ${paint(ansi.yellow, sessionId)}  ` +
      `${paint(ansi.gray, 'dir:')} ${paint(ansi.yellow, directory)}`
    );
    console.log(
      `${paint(ansi.gray, 'provider:')} ${paint(ansi.yellow, config.provider)}  ` +
      `${paint(ansi.gray, 'model:')} ${paint(ansi.yellow, config.model)}`
    );
    console.log(
      `${paint(ansi.gray, 'commands:')} ${paint(ansi.dim, '/help /clear /session <id> /dir <path>  exit')}`
    );
    console.log(hr());
  };

  renderHeader();

  const statusBySession = new Map<string, string>();
  const printedLen = new Map<string, number>();
  let hasOpenAssistantLine = false;

  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let spinnerIndex = 0;
  let spinnerBase = '';

  const stopSpinner = () => {
    if (!spinnerTimer) return;
    clearInterval(spinnerTimer);
    spinnerTimer = undefined;
    spinnerIndex = 0;
    spinnerBase = '';

    const columns = Math.max(40, process.stdout.columns || 80);
    process.stdout.write('\r' + ' '.repeat(columns) + '\r');
  };

  const startSpinner = () => {
    if (spinnerTimer) return;
    spinnerBase = `${paint(ansi.gray, now())} ${prefixAssistant}${paint(ansi.dim, 'thinking')} `;
    process.stdout.write(spinnerBase + spinnerFrames[spinnerIndex]);
    spinnerTimer = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      process.stdout.write('\r' + spinnerBase + spinnerFrames[spinnerIndex]);
    }, 80);
  };

  Bus.subscribe(SessionEvent.Updated, (data) => {
    if (data.sessionId !== sessionId) return;

    const prev = statusBySession.get(data.sessionId);
    if (prev === data.status) return;
    statusBySession.set(data.sessionId, data.status);

    if (data.status === 'busy') {
      hasOpenAssistantLine = false;
      startSpinner();
      return;
    }

    if (data.status === 'idle') {
      stopSpinner();
      if (hasOpenAssistantLine) process.stdout.write('\n');
      process.stdout.write(paint(ansi.gray, `\n· ${now()} done\n`));
      hasOpenAssistantLine = false;
      return;
    }

    if (data.status === 'error') {
      stopSpinner();
      process.stdout.write(paint(ansi.red, `\n· ${now()} error\n`));
      hasOpenAssistantLine = false;
    }
  });

  Bus.subscribe(PartEvent.Updated, (data) => {
    if (data.sessionId !== sessionId) return;

    const session = SessionManager.get(data.sessionId);
    const msg = session?.messages.find((m) => m.id === data.messageId);
    const part = msg?.parts.find((p) => p.id === data.partId);
    if (!part || part.type !== 'text') return;

    const key = `${data.sessionId}:${data.messageId}:${data.partId}`;
    const prev = printedLen.get(key) || 0;
    const next = part.content;
    if (next.length <= prev) return;

    const delta = next.slice(prev);
    printedLen.set(key, next.length);

    if (!hasOpenAssistantLine) {
      stopSpinner();
      process.stdout.write(`${paint(ansi.gray, now())} ${prefixAssistant}`);
      hasOpenAssistantLine = true;
    }

    process.stdout.write(delta);
  });

  Bus.subscribe(ToolEvent.Executed, (data) => {
    if (data.sessionId !== sessionId) return;

    stopSpinner();

    if (hasOpenAssistantLine) {
      process.stdout.write('\n');
      hasOpenAssistantLine = false;
    }

    const args = safeJson(data.args ?? {}, 160);
    const result = safeJson(data.result ?? {}, 500);

    process.stdout.write(
      `${paint(ansi.gray, now())} ${prefixTool}${paint(ansi.magenta, data.toolId)} ${paint(ansi.dim, args)}\n` +
      `${paint(ansi.dim, result)}\n`
    );

    if (statusBySession.get(data.sessionId) === 'busy') {
      startSpinner();
    }
  });

  while (true) {
    const raw = await rl.question(`\n${paint(ansi.gray, now())} ${prefixUser}`);
    const input = raw.trim();

    if (!input) continue;
    if (input.toLowerCase() === 'exit') break;

    if (input.startsWith('/')) {
      const [cmd, ...rest] = input.slice(1).split(/\s+/);
      const arg = rest.join(' ').trim();

      switch (cmd) {
        case 'help':
          console.log(paint(ansi.gray, '\nCommands:'));
          console.log(`${paint(ansi.dim, '/help')}     Show this help`);
          console.log(`${paint(ansi.dim, '/clear')}    Clear screen`);
          console.log(`${paint(ansi.dim, '/session')}  Set session id (e.g. /session my-session)`);
          console.log(`${paint(ansi.dim, '/dir')}      Set working directory (e.g. /dir D:\\repo)`);
          break;

        case 'clear':
          renderHeader();
          break;

        case 'session':
          if (!arg) {
            console.log(paint(ansi.red, 'Missing session id.'));
            break;
          }
          sessionId = arg;
          renderHeader();
          break;

        case 'dir':
          if (!arg) {
            console.log(paint(ansi.red, 'Missing directory path.'));
            break;
          }
          directory = arg;
          renderHeader();
          break;

        default:
          console.log(paint(ansi.red, `Unknown command: /${cmd}`));
      }

      continue;
    }

    await Server.handleRequest(directory, sessionId, raw);
  }

  stopSpinner();
  rl.close();
}

async function runServe() {
  console.log('--- 🚀 OpenCode Headless Server ---');
  startHttpServer();
}

async function runAuth() {
  console.log('--- 🔑 OpenCode Authentication ---');
  console.log('Use "opencode auth <provider>" to store API keys.');
}

async function main() {
  const [,, command] = process.argv;

  switch (command) {
    case 'serve':
      await runServe();
      break;
    case 'auth':
      await runAuth();
      break;
    case 'agent':
    case 'tui':
    default:
      await runTUI();
      break;
  }
}

main().catch(console.error);
