import { Server, startHttpServer } from './server/server.ts';
import { Bus } from './bus/index.ts';
import { SessionEvent, PartEvent } from './bus/bus-event.ts';
import { SessionManager } from './session/index.ts';
import { createInterface } from 'node:readline/promises';

async function runTUI() {
  const directory = process.cwd();
  const sessionId = 'test-session';
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('--- 🧭 OpenCode TUI (Interactive) ---');
  console.log(`Working directory: ${directory}`);
  console.log('Type "exit" to quit.\n');

  Bus.subscribe(SessionEvent.Updated, (data) => {
    if (data.status === 'busy') process.stdout.write('\n[Agent] Thinking...');
  });

  Bus.subscribe(PartEvent.Updated, (data) => {
    const session = SessionManager.get(data.sessionId);
    const msg = session?.messages.find((m) => m.id === data.messageId);
    const part = msg?.parts.find((p) => p.id === data.partId);
    if (part && part.type === 'text') {
      process.stdout.write(`\r[Agent]: ${part.content}`);
    }
  });

  while (true) {
    const userPrompt = await rl.question('\nUser > ');
    if (userPrompt.toLowerCase() === 'exit') break;
    if (!userPrompt.trim()) continue;
    await Server.handleRequest(directory, sessionId, userPrompt);
    console.log();
  }
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
