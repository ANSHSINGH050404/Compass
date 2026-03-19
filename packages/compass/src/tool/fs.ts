import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Glob } from 'bun';
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

export const LsTool = {
  id: 'ls',
  description: 'List files in a directory.',
  parameters: {
    directory: { type: 'string', description: 'Relative path to the directory (optional).' }
  },
  async execute(args: { directory?: string }, ctx: { directory: string }) {
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
  parameters: {
    pattern: { type: 'string', description: 'The glob pattern (e.g. "**/*.ts").' }
  },
  async execute(args: { pattern: string }, ctx: { directory: string }) {
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
  parameters: {
    pattern: { type: 'string', description: 'The regex pattern to search for.' },
    glob: { type: 'string', description: 'Glob pattern to filter files (optional).' }
  },
  async execute(args: { pattern: string, glob?: string }, ctx: { directory: string }) {
    const globPattern = args.glob || '**/*';
    const glob = new Glob(globPattern);
    const regex = new RegExp(args.pattern, 'g');
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
