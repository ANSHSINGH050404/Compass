import { streamText, tool } from 'ai';
import { Message } from './index.ts';
import { Provider, ProviderTransform } from '../provider/provider.ts';
import { ToolInfo } from '../tool/registry.ts';

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
      });
    }

    const result = streamText({
      model,
      messages,
      tools: sdkTools,
      maxSteps: 1,
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
          return;

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
