import { z } from 'zod';
import { spawn } from 'node:child_process';
import { Bus } from '../bus/index.ts';
import { ToolEvent } from '../bus/bus-event.ts';
import { ToolContext, ToolRegistry } from './registry.ts';

const maxOutputChars = 200_000;

function appendTail(existing: string, chunk: string, maxChars: number) {
  const combined = existing + chunk;
  if (combined.length <= maxChars) return { value: combined, truncated: false };
  return { value: combined.slice(combined.length - maxChars), truncated: true };
}

export const BashTool = {
  id: 'bash',
  description: 'Runs a shell command in the current directory.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute.'),
  }),
  async execute(args: { command: string }, ctx: ToolContext) {
    const startedAt = Date.now();

    return await new Promise((resolve, reject) => {
      const child = spawn(args.command, {
        cwd: ctx.directory,
        shell: true,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let stdoutTruncated = false;
      let stderrTruncated = false;

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');

      child.stdout?.on('data', (chunk) => {
        const text = String(chunk);
        Bus.publish(ToolEvent.Output, {
          sessionId: ctx.sessionId,
          toolId: 'bash',
          callId: ctx.callId,
          stream: 'stdout',
          chunk: text,
        });

        const next = appendTail(stdout, text, maxOutputChars);
        stdout = next.value;
        stdoutTruncated = stdoutTruncated || next.truncated;
      });

      child.stderr?.on('data', (chunk) => {
        const text = String(chunk);
        Bus.publish(ToolEvent.Output, {
          sessionId: ctx.sessionId,
          toolId: 'bash',
          callId: ctx.callId,
          stream: 'stderr',
          chunk: text,
        });

        const next = appendTail(stderr, text, maxOutputChars);
        stderr = next.value;
        stderrTruncated = stderrTruncated || next.truncated;
      });

      child.on('error', (error) => reject(error));

      child.on('close', (exitCode, signal) => {
        resolve({
          stdout,
          stderr,
          exitCode,
          signal,
          durationMs: Date.now() - startedAt,
          truncated: stdoutTruncated || stderrTruncated,
          stdoutTruncated,
          stderrTruncated,
        });
      });
    });
  }
};

ToolRegistry.register(BashTool);
