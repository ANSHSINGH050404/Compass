// Simplified server entry point (Hono placeholder)
import { SessionManager } from '../session/index.ts';
import { SessionProcessor } from '../session/processor.ts';
import { Bus } from '../bus/index.ts';
import { Instance } from '../project/instance.ts';

export const Server = {
  async handleRequest(directory: string, sessionId: string, content: string) {
    return await Instance.provide({ directory }, async () => {
      const session = SessionManager.get(sessionId) || SessionManager.create(directory);
      SessionManager.addMessage(session.id, 'user', content);

      const processor = SessionProcessor.create(session.id);
      await processor.process();

      return session;
    });
  }
};

// Start listening for events from the bus
Bus.subscribe({ name: 'session:updated' }, (data) => {
  console.log(`[Bus Event] Session ${data.sessionId} is now ${data.status}`);
});
