import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ToolRegistry } from './registry.ts';

const execAsync = promisify(exec);

export const BashTool = {
  id: 'bash',
  description: 'Runs a shell command in the current directory.',
  parameters: {
    command: { type: 'string', description: 'The shell command to execute.' }
  },
  async execute(args: { command: string }, ctx: { directory: string }) {
    const { stdout, stderr } = await execAsync(args.command, { cwd: ctx.directory });
    return { stdout, stderr };
  }
};

ToolRegistry.register(BashTool);
