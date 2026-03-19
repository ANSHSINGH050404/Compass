export interface ToolInfo {
  id: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, ctx: { directory: string }) => Promise<any>;
}

const registry = new Map<string, ToolInfo>();

export const ToolRegistry = {
  register(tool: ToolInfo) {
    registry.set(tool.id, tool);
  },

  get(id: string): ToolInfo | undefined {
    return registry.get(id);
  },

  list(): ToolInfo[] {
    return Array.from(registry.values());
  },

  async run(id: string, args: any, directory: string): Promise<any> {
    const tool = registry.get(id);
    if (!tool) throw new Error(`Tool ${id} not found`);
    return await tool.execute(args, { directory });
  }
};
