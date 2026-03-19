import { EventDef } from './index.ts';

export const SessionEvent = {
  Updated: { name: 'session:updated' } as EventDef<{ sessionId: string; status: string }>,
  Deleted: { name: 'session:deleted' } as EventDef<{ sessionId: string }>,
};

export const MessageEvent = {
  Created: { name: 'message:created' } as EventDef<{ sessionId: string; messageId: string }>,
  Updated: { name: 'message:updated' } as EventDef<{ sessionId: string; messageId: string }>,
};

export const PartEvent = {
  Created: { name: 'part:created' } as EventDef<{ sessionId: string; messageId: string; partId: string }>,
  Updated: { name: 'part:updated' } as EventDef<{ sessionId: string; messageId: string; partId: string }>,
};

export const ToolEvent = {
  Executed: { name: 'tool:executed' } as EventDef<{
    sessionId: string;
    toolId: string;
    callId?: string;
    args: any;
    result: any;
  }>,
};
