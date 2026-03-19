import { Session, SessionManager } from './index.ts';
import { Bus } from '../bus/index.ts';
import { LLM } from './llm.ts';
import { ToolRegistry } from '../tool/registry.ts';
import { PermissionNext } from '../permission/next.ts';
import { PartEvent } from '../bus/bus-event.ts';
import { ConfigLoader } from '../config/config.ts';

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
              const permission = await PermissionNext.ask(chunk.toolId, chunk.args, 'standard');
              if (permission.status === 'allow') {
                try {
                  const result = await ToolRegistry.run(chunk.toolId, chunk.args, session.directory);
                  message.parts.push({
                    id: Math.random().toString(36).substring(7),
                    type: 'tool',
                    content: JSON.stringify(result),
                    metadata: { toolId: chunk.toolId, args: chunk.args, status: 'success' }
                  });
                } catch (error: any) {
                  message.parts.push({
                    id: Math.random().toString(36).substring(7),
                    type: 'tool',
                    content: error.message,
                    metadata: { toolId: chunk.toolId, args: chunk.args, status: 'error' }
                  });
                }
                // In a real loop, we would trigger another LLM call here with the tool results
              } else {
                console.log(`Tool ${chunk.toolId} rejected: ${permission.reason}`);
              }
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
