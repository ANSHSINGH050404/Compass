import { streamText, tool } from 'ai';
import { Message } from './index.ts';
import { Provider, ProviderTransform } from '../provider/provider.ts';
import { PermissionNext } from '../permission/next.ts';
import { Instance } from '../project/instance.ts';
import { ToolRegistry, ToolInfo } from '../tool/registry.ts';

export interface LLMStreamOptions {
  model: string;
  messages: Message[];
  tools: ToolInfo[];
}

export const LLM = {
  async *stream(options: LLMStreamOptions) {
    const model = Provider.getLanguage(options.model);
    const messages = ProviderTransform.messages(options.messages);

    // Transform internal ToolInfo to AI SDK tool format
    const sdkTools: Record<string, any> = {};
    for (const t of options.tools) {
      sdkTools[t.id] = tool({
        description: t.description,
        parameters: t.parameters as any, // Expects JSON Schema or Zod
        execute: async (args: any) => {
          const permission = await PermissionNext.ask(t.id, args, 'standard');
          if (permission.status !== 'allow') {
            return { ok: false, error: permission.reason || 'Permission denied', status: permission.status };
          }

          try {
            const directory = Instance.directory;
            const result = await ToolRegistry.run(t.id, args, directory);
            return { ok: true, result };
          } catch (error: any) {
            return { ok: false, error: error?.message || String(error) };
          }
        },
      });
    }

    const result = streamText({
      model,
      messages,
      tools: sdkTools,
      maxSteps: 10,
    });

    let hasStartedText = false;

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          if (!hasStartedText) {
            yield { type: 'text-start', partId: Math.random().toString(36).substring(7) };
            hasStartedText = true;
          }
          yield { type: 'text-delta', content: chunk.textDelta };
          break;

        case 'tool-call':
          yield {
            type: 'tool-call',
            toolId: chunk.toolName,
            args: chunk.args,
            callId: chunk.toolCallId,
          };
          break;

        case 'tool-result':
          yield {
            type: 'tool-result',
            toolId: chunk.toolName,
            args: chunk.args,
            result: chunk.result,
            callId: chunk.toolCallId,
          };
          break;

        case 'finish':
          if (hasStartedText) {
            yield { type: 'text-end' };
          }
          yield { type: 'finish' };
          break;
      }
    }
  }
};
