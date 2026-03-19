import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ToolRegistry } from './registry.ts';

const execAsync = promisify(exec);

export const BashTool = {
  id: 'bash',
  description: 'Runs a shell command in the current directory.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute.'),
  }),
  async execute(args: { command: string }, ctx: { directory: string }) {
    const { stdout, stderr } = await execAsync(args.command, { cwd: ctx.directory });
    return { stdout, stderr };
  }
};

ToolRegistry.register(BashTool);
