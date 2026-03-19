export interface PermissionResult {
  status: 'allow' | 'deny' | 'ask';
  reason?: string;
}

export const PermissionNext = {
  async ask(toolId: string, args: any, ruleset: string): Promise<PermissionResult> {
    // Decision engine for tool execution permissions
    if (toolId === 'bash' && args.command?.includes('rm -rf')) {
      return { status: 'ask', reason: 'Destructive command' };
    }

    if (ruleset === 'readonly') {
      return toolId === 'read' || toolId === 'glob' || toolId === 'ls'
        ? { status: 'allow' }
        : { status: 'deny', reason: 'Read-only mode' };
    }

    return { status: 'allow' };
  }
};
