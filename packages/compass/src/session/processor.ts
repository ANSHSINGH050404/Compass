import { Session, SessionManager } from './index.ts';
import { Bus } from '../bus/index.ts';
import { LLM } from './llm.ts';
import { ToolRegistry } from '../tool/registry.ts';
import { PartEvent, ToolEvent } from '../bus/bus-event.ts';
import { ConfigLoader } from '../config/config.ts';
import { PermissionNext } from '../permission/next.ts';
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

        const maxSteps = 10;

        for (let step = 0; step < maxSteps; step++) {
          const message = SessionManager.addMessage(session.id, 'assistant', '');
          let currentPartId = '';
          let toolCall:
            | { toolId: string; args: any; callId: string }
            | undefined;

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
                toolCall = { toolId: chunk.toolId, args: chunk.args, callId: chunk.callId };
                message.parts.push({
                  id: Math.random().toString(36).substring(7),
                  type: 'tool',
                  content: '',
                  metadata: { toolId: chunk.toolId, args: chunk.args, callId: chunk.callId, status: 'call' }
                });
                break;

              case 'finish':
                break;
            }
          }

          if (!toolCall) {
            session.status = 'idle';
            break;
          }

          const permission = await PermissionNext.ask(toolCall.toolId, toolCall.args, 'standard');
          let toolResult: any;

          Bus.publish(ToolEvent.Started, {
            sessionId: session.id,
            toolId: toolCall.toolId,
            callId: toolCall.callId,
            args: toolCall.args,
          });

          if (permission.status === 'allow') {
            try {
              toolResult = await ToolRegistry.run(toolCall.toolId, toolCall.args, {
                directory: session.directory,
                sessionId: session.id,
                callId: toolCall.callId,
              });
            } catch (error: any) {
              toolResult = { error: error?.message || String(error) };
            }
          } else {
            toolResult = { error: permission.reason || 'Permission denied', status: permission.status };
          }

          Bus.publish(ToolEvent.Executed, {
            sessionId: session.id,
            toolId: toolCall.toolId,
            callId: toolCall.callId,
            args: toolCall.args,
            result: toolResult,
          });

          SessionManager.addMessage(
            session.id,
            'user',
            `[Tool Result] ${toolCall.toolId}\n${JSON.stringify(toolResult)}`
          );
        }

        if (session.status === 'busy') {
          session.status = 'error';
          SessionManager.addMessage(session.id, 'assistant', '[Error] Max tool steps reached.');
        }

        Bus.publish({ name: 'session:updated' }, { sessionId: session.id, status: session.status });
        return 'stop';
      }
    };
  }
};
