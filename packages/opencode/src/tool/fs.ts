import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ToolRegistry } from './registry.ts';

export const ReadTool = {
  id: 'read',
  description: 'Read the contents of a file.',
  parameters: {
    path: { type: 'string', description: 'Relative path to the file.' }
  },
  async execute(args: { path: string }, ctx: { directory: string }) {
    const fullPath = join(ctx.directory, args.path);
    const content = await readFile(fullPath, 'utf8');
    return { content };
  }
};

export const WriteTool = {
  id: 'write',
  description: 'Write or overwrite a file with new content.',
  parameters: {
    path: { type: 'string', description: 'Relative path to the file.' },
    content: { type: 'string', description: 'The new content to write.' }
  },
  async execute(args: { path: string, content: string }, ctx: { directory: string }) {
    const fullPath = join(ctx.directory, args.path);
    await writeFile(fullPath, args.content, 'utf8');
    return { status: 'success', path: args.path };
  }
};

ToolRegistry.register(ReadTool);
ToolRegistry.register(WriteTool);
