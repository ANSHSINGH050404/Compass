import { Session, SessionManager } from './index.ts';
import { Bus } from '../bus/index.ts';
import { LLM } from './llm.ts';
import { ToolRegistry } from '../tool/registry.ts';
import { PartEvent, ToolEvent } from '../bus/bus-event.ts';
import { ConfigLoader } from '../config/config.ts';
import '../tool/bash.ts';
import '../tool/fs.ts';

export const SessionProcessor = {
  create(sessionId: string) {
    const session = SessionManager.get(sessionId);
    if (!session) throw new Error('Session not found');
    const config = ConfigLoader.load();

    return {
      async process() {
        session.status = 'busy';
        Bus.publish({ name: 'session:updated' }, { sessionId: session.id, status: session.status });

        const message = SessionManager.addMessage(session.id, 'assistant', '');
        let currentPartId = '';

        for await (const chunk of LLM.stream({
          model: config.model,
          messages: session.messages,
          tools: ToolRegistry.list(),
        })) {
          switch (chunk.type) {
            case 'text-start':
              currentPartId = chunk.partId;
              message.parts.push({ id: currentPartId, type: 'text', content: '' });
              break;

            case 'text-delta':
              SessionManager.updatePart(session.id, message.id, currentPartId, chunk.content);
              Bus.publish(PartEvent.Updated, { sessionId: session.id, messageId: message.id, partId: currentPartId });
              break;

            case 'tool-call':
              message.parts.push({
                id: Math.random().toString(36).substring(7),
                type: 'tool',
                content: `\n\n[Tool Call] ${chunk.toolId}\n${JSON.stringify(chunk.args)}`,
                metadata: { toolId: chunk.toolId, args: chunk.args, callId: chunk.callId, status: 'call' }
              });
              break;

            case 'tool-result':
              message.parts.push({
                id: Math.random().toString(36).substring(7),
                type: 'tool',
                content: `\n\n[Tool Result] ${chunk.toolId}\n${JSON.stringify(chunk.result)}`,
                metadata: {
                  toolId: chunk.toolId,
                  args: chunk.args,
                  callId: chunk.callId,
                  status: chunk.result?.ok ? 'success' : 'error',
                }
              });
              Bus.publish(ToolEvent.Executed, {
                sessionId: session.id,
                toolId: chunk.toolId,
                callId: chunk.callId,
                args: chunk.args,
                result: chunk.result,
              });
              break;

            case 'finish':
              session.status = 'idle';
              break;
          }
        }

        Bus.publish({ name: 'session:updated' }, { sessionId: session.id, status: session.status });
        return 'stop';
      }
    };
  }
};
