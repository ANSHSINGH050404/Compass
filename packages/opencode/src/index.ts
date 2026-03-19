import { Server } from './server/server.ts';
import { Bus } from './bus/index.ts';
import { SessionEvent, PartEvent } from './bus/bus-event.ts';
import { SessionManager } from './session/index.ts';

import { createInterface } from 'node:readline/promises';

async function main() {
  const directory = process.cwd();
  const sessionId = 'test-session';
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('--- 🧭 OpenCode TUI (Interactive) ---');
  console.log(`Working directory: ${directory}`);
  console.log('Type "exit" to quit.\n');

  // 1. Subscribe to Bus events
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

    if (userPrompt.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      break;
    }

    if (!userPrompt.trim()) continue;

    await Server.handleRequest(directory, sessionId, userPrompt);
    console.log(); // New line after response
  }

  rl.close();
}

main().catch(console.error);
