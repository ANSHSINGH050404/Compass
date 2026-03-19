import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Glob } from 'bun';
import { z } from 'zod';
import { ToolContext, ToolRegistry } from './registry.ts';

export const ReadTool = {
  id: 'read',
  description: 'Read the contents of a file.',
  parameters: z.object({
    path: z.string().describe('Relative path to the file.'),
  }),
  async execute(args: { path: string }, ctx: ToolContext) {
    const fullPath = join(ctx.directory, args.path);
    const content = await readFile(fullPath, 'utf8');
    return { content };
  }
};

export const WriteTool = {
  id: 'write',
  description: 'Write or overwrite a file with new content.',
  parameters: z.object({
    path: z.string().describe('Relative path to the file.'),
    content: z.string().describe('The new content to write.'),
  }),
  async execute(args: { path: string, content: string }, ctx: ToolContext) {
    const fullPath = join(ctx.directory, args.path);
    await writeFile(fullPath, args.content, 'utf8');
    return { status: 'success', path: args.path };
  }
};

export const LsTool = {
  id: 'ls',
  description: 'List files in a directory.',
  parameters: z.object({
    directory: z.string().describe('Relative path to the directory (optional).').optional(),
  }),
  async execute(args: { directory?: string }, ctx: ToolContext) {
    const targetDir = join(ctx.directory, args.directory || '.');
    const files = await readdir(targetDir, { withFileTypes: true });
    return files.map(f => ({
      name: f.name,
      type: f.isDirectory() ? 'directory' : 'file'
    }));
  }
};

export const GlobTool = {
  id: 'glob',
  description: 'Search for files matching a glob pattern.',
  parameters: z.object({
    pattern: z.string().describe('The glob pattern (e.g. "**/*.ts").'),
  }),
  async execute(args: { pattern: string }, ctx: ToolContext) {
    const glob = new Glob(args.pattern);
    const results = [];
    for await (const file of glob.scan(ctx.directory)) {
      results.push(file);
    }
    return results;
  }
};

export const GrepTool = {
  id: 'grep',
  description: 'Search for a string or regex in files.',
  parameters: z.object({
    pattern: z.string().describe('The regex pattern to search for.'),
    glob: z.string().describe('Glob pattern to filter files (optional).').optional(),
  }),
  async execute(args: { pattern: string, glob?: string }, ctx: ToolContext) {
    const globPattern = args.glob || '**/*';
    const glob = new Glob(globPattern);
    const regex = new RegExp(args.pattern);
    const matches: { file: string, line: number, content: string }[] = [];

    for await (const file of glob.scan(ctx.directory)) {
      try {
        const fullPath = join(ctx.directory, file);
        const content = await readFile(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (regex.test(line)) {
            matches.push({ file, line: index + 1, content: line.trim() });
          }
        });
      } catch (e) {
        // Skip files that can't be read (binary, etc)
      }
    }
    return matches;
  }
};

ToolRegistry.register(ReadTool);
ToolRegistry.register(WriteTool);
ToolRegistry.register(LsTool);
ToolRegistry.register(GlobTool);
ToolRegistry.register(GrepTool);
