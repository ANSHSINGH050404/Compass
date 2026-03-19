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

function appendTail(existing: string, chunk: string, maxChars: number) {
  const combined = existing + chunk;
  if (combined.length <= maxChars) return { value: combined, truncated: false };
  return { value: combined.slice(combined.length - maxChars), truncated: true };
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

  const wipeLine = () => {
    const columns = Math.max(40, process.stdout.columns || 80);
    process.stdout.write('\r' + ' '.repeat(columns) + '\r');
  };

  const stopSpinner = () => {
    if (!spinnerTimer) return;
    clearInterval(spinnerTimer);
    spinnerTimer = undefined;
    spinnerIndex = 0;
    spinnerBase = '';
    wipeLine();
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

  const maxToolRuns = 50;
  const maxToolOutputChars = 200_000;
  const toolRuns = new Map<string, {
    id: string;
    toolId: string;
    callId?: string;
    args: any;
    startedAt: number;
    finishedAt?: number;
    stdout: string;
    stderr: string;
    truncated: boolean;
    result?: any;
  }>();
  const toolOrder: string[] = [];

  let toolLiveTimer: ReturnType<typeof setInterval> | undefined;
  let toolLiveIndex = 0;
  let toolLivePrefix = '';
  let toolLiveTail = '';
  let toolLiveId = '';

  const stopToolLive = () => {
    if (!toolLiveTimer) return;
    clearInterval(toolLiveTimer);
    toolLiveTimer = undefined;
    toolLiveIndex = 0;
    toolLivePrefix = '';
    toolLiveTail = '';
    toolLiveId = '';
    wipeLine();
  };

  const renderToolLive = () => {
    if (!toolLiveTimer) return;
    wipeLine();
    process.stdout.write(`${toolLivePrefix}${spinnerFrames[toolLiveIndex]} ${paint(ansi.dim, toolLiveTail)}`);
  };

  const startToolLive = (id: string, toolId: string, args: any) => {
    stopSpinner();
    stopToolLive();

    toolLiveId = id;
    toolLiveIndex = 0;
    const shortId = id.length > 8 ? id.slice(0, 8) : id;
    const argsPreview = safeJson(args ?? {}, 80);
    toolLivePrefix =
      `${paint(ansi.gray, now())} ${prefixTool}${paint(ansi.magenta, toolId)}` +
      ` ${paint(ansi.gray, `(${shortId})`)} ${paint(ansi.dim, argsPreview)} `;
    toolLiveTail = '';

    toolLiveTimer = setInterval(() => {
      toolLiveIndex = (toolLiveIndex + 1) % spinnerFrames.length;
      renderToolLive();
    }, 80);

    renderToolLive();
  };

  const rememberTool = (id: string) => {
    toolOrder.push(id);
    if (toolOrder.length > maxToolRuns) {
      const removed = toolOrder.shift();
      if (removed) toolRuns.delete(removed);
    }
  };

  const appendToolOutput = (id: string, stream: 'stdout' | 'stderr', chunk: string) => {
    const run = toolRuns.get(id);
    if (!run) return;
    const next = appendTail(stream === 'stdout' ? run.stdout : run.stderr, chunk, maxToolOutputChars);
    if (stream === 'stdout') run.stdout = next.value;
    else run.stderr = next.value;
    run.truncated = run.truncated || next.truncated;
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
      stopToolLive();
      stopSpinner();
      if (hasOpenAssistantLine) process.stdout.write('\n');
      process.stdout.write(paint(ansi.gray, `\n· ${now()} done\n`));
      hasOpenAssistantLine = false;
      return;
    }

    if (data.status === 'error') {
      stopToolLive();
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

  let showToolTip = true;

  Bus.subscribe(ToolEvent.Started, (data) => {
    if (data.sessionId !== sessionId) return;

    const id = data.callId || data.toolId;
    toolRuns.set(id, {
      id,
      toolId: data.toolId,
      callId: data.callId,
      args: data.args,
      startedAt: Date.now(),
      stdout: '',
      stderr: '',
      truncated: false,
    });
    rememberTool(id);

    if (hasOpenAssistantLine) {
      process.stdout.write('\n');
      hasOpenAssistantLine = false;
    }

    startToolLive(id, data.toolId, data.args);
  });

  Bus.subscribe(ToolEvent.Output, (data) => {
    if (data.sessionId !== sessionId) return;

    const id = data.callId || data.toolId;
    if (!toolRuns.has(id)) {
      toolRuns.set(id, {
        id,
        toolId: data.toolId,
        callId: data.callId,
        args: {},
        startedAt: Date.now(),
        stdout: '',
        stderr: '',
        truncated: false,
      });
      rememberTool(id);
    }

    appendToolOutput(id, data.stream, data.chunk);

    if (toolLiveId === id) {
      const normalized = String(data.chunk).replace(/\r/g, '');
      const lines = normalized.split('\n').filter((l) => l.trim().length > 0);
      const last = (lines.length ? lines[lines.length - 1] : normalized).trim();
      if (last) {
        const prefix = data.stream === 'stderr' ? 'stderr: ' : '';
        toolLiveTail = `${prefix}${ellipsis(last, 120)}`;
        renderToolLive();
      }
    }
  });

  Bus.subscribe(ToolEvent.Executed, (data) => {
    if (data.sessionId !== sessionId) return;

    const id = data.callId || data.toolId;
    const run = toolRuns.get(id);
    if (run) {
      run.finishedAt = Date.now();
      run.result = data.result;

      if (typeof data.result?.stdout === 'string' && !run.stdout) run.stdout = data.result.stdout;
      if (typeof data.result?.stderr === 'string' && !run.stderr) run.stderr = data.result.stderr;
    }

    stopToolLive();
    stopSpinner();

    if (hasOpenAssistantLine) {
      process.stdout.write('\n');
      hasOpenAssistantLine = false;
    }

    const exitCode = typeof data.result?.exitCode === 'number' ? data.result.exitCode : undefined;
    const ok = !data.result?.error && (exitCode === undefined || exitCode === 0);
    const icon = ok ? paint(ansi.green, '✓') : paint(ansi.red, '✗');
    const shortId = id.length > 8 ? id.slice(0, 8) : id;
    const durationMs = typeof data.result?.durationMs === 'number'
      ? data.result.durationMs
      : (run?.finishedAt && run.startedAt ? run.finishedAt - run.startedAt : undefined);

    const meta: string[] = [];
    if (typeof exitCode === 'number') meta.push(`exit ${exitCode}`);
    if (typeof durationMs === 'number') meta.push(`${Math.round(durationMs)}ms`);
    if (data.result?.status) meta.push(String(data.result.status));

    process.stdout.write(
      `${paint(ansi.gray, now())} ${prefixTool}${paint(ansi.magenta, data.toolId)} ${icon} ` +
      `${paint(ansi.gray, `(${shortId})`)} ${paint(ansi.dim, meta.join(' · '))}\n`
    );

    const errorText = typeof data.result?.error === 'string' ? data.result.error.trim() : '';
    if (errorText) {
      process.stdout.write(`${paint(ansi.dim, ellipsis(errorText, 240))}\n`);
    }

    if (showToolTip) {
      showToolTip = false;
      process.stdout.write(paint(ansi.dim, `tip: use /tools to list and /tool 1 to expand output\n`));
    }

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
          console.log(`${paint(ansi.dim, '/tools')}    List recent tools`);
          console.log(`${paint(ansi.dim, '/tool')}     Show tool output (e.g. /tool 1, /tool <id>, /tool clear)`);
          console.log(`${paint(ansi.dim, '/session')}  Set session id (e.g. /session my-session)`);
          console.log(`${paint(ansi.dim, '/dir')}      Set working directory (e.g. /dir D:\\repo)`);
          break;

        case 'clear':
          renderHeader();
          break;

        case 'tools': {
          stopToolLive();
          stopSpinner();

          const recent = [...toolOrder].reverse().slice(0, 10);
          if (!recent.length) {
            console.log(paint(ansi.dim, '\nNo tool runs yet.'));
            break;
          }

          console.log(paint(ansi.gray, '\nRecent tools:'));
          recent.forEach((id, index) => {
            const run = toolRuns.get(id);
            if (!run) return;

            const shortId = id.length > 8 ? id.slice(0, 8) : id;
            const status = run.finishedAt ? paint(ansi.green, 'done') : paint(ansi.yellow, 'running');
            const duration = run.finishedAt ? `${run.finishedAt - run.startedAt}ms` : '';
            const argsPreview = safeJson(run.args ?? {}, 80);

            console.log(
              `${index + 1}. ${paint(ansi.magenta, run.toolId)} ${status} ` +
              `${paint(ansi.gray, `(${shortId})`)} ${paint(ansi.dim, duration)} ${paint(ansi.dim, argsPreview)}`
            );
          });

          break;
        }

        case 'tool': {
          stopToolLive();
          stopSpinner();

          const all = [...toolOrder].reverse();
          if (!all.length) {
            console.log(paint(ansi.dim, '\nNo tool runs yet.'));
            break;
          }

          const toolArg = arg || '1';

          if (toolArg === 'clear') {
            toolRuns.clear();
            toolOrder.length = 0;
            console.log(paint(ansi.dim, '\nCleared tool history.'));
            break;
          }

          let id: string | undefined;

          if (/^\d+$/.test(toolArg)) {
            const index = Number(toolArg) - 1;
            id = all[index];
          } else {
            id = all.find((x) => x === toolArg || x.startsWith(toolArg));
          }

          if (!id) {
            console.log(paint(ansi.red, `Tool not found: ${toolArg}`));
            break;
          }

          const run = toolRuns.get(id);
          if (!run) {
            console.log(paint(ansi.red, `Tool data missing for: ${id}`));
            break;
          }

          const shortId = id.length > 8 ? id.slice(0, 8) : id;

          console.log(hr());
          console.log(
            `${paint(ansi.bold + ansi.magenta, run.toolId)} ${paint(ansi.gray, `(${shortId})`)}`
          );
          console.log(`${paint(ansi.gray, 'args:')} ${safeJson(run.args ?? {}, 4000)}`);

          if (run.stdout) {
            console.log(paint(ansi.gray, '\nstdout:'));
            console.log(ellipsis(run.stdout, 20_000));
          }

          if (run.stderr) {
            console.log(paint(ansi.gray, '\nstderr:'));
            console.log(ellipsis(run.stderr, 20_000));
          }

          if (run.result !== undefined) {
            console.log(`${paint(ansi.gray, '\nresult:')} ${safeJson(run.result, 8000)}`);
          }

          if (run.truncated) {
            console.log(paint(ansi.yellow, '\n(note: stored tool output is truncated)'));
          }

          console.log(hr());
          break;
        }

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

  stopToolLive();
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
