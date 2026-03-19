import { ToolRegistry } from './registry.ts';

ToolRegistry.register({
  id: 'glob',
  description: 'Search for files matching a glob pattern.',
  parameters: {
    pattern: 'string',
    directory: 'string'
  },
  execute: async (args, ctx) => {
    return `Found files matching pattern ${args.pattern} in ${args.directory || ctx.directory}`;
  }
});

ToolRegistry.register({
  id: 'ls',
  description: 'List files in a directory.',
  parameters: {
    directory: 'string'
  },
  execute: async (args, ctx) => {
    return `List of files in ${args.directory || ctx.directory}`;
  }
});

ToolRegistry.register({
  id: 'grep',
  description: 'Search for a string or regex in files.',
  parameters: {
    pattern: 'string',
    glob: 'string'
  },
  execute: async (args, ctx) => {
    return `Found matches for pattern ${args.pattern} in files matching ${args.glob} in ${ctx.directory}`;
  }
});
