// Simplified server entry point + Hono HTTP server
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { SessionManager } from '../session/index.ts';
import { SessionProcessor } from '../session/processor.ts';
import { Bus } from '../bus/index.ts';
import { PartEvent, SessionEvent, ToolEvent } from '../bus/bus-event.ts';
import { ConfigLoader } from '../config/config.ts';
import { Instance } from '../project/instance.ts';
import { Provider } from '../provider/provider.ts';
import { ToolRegistry } from '../tool/registry.ts';

export const Server = {
  async handleRequest(directory: string, sessionId: string, content: string) {
    return await Instance.provide({ directory }, async () => {
      const session = SessionManager.get(sessionId) || SessionManager.create(directory, sessionId);
      SessionManager.addMessage(session.id, 'user', content);

      const processor = SessionProcessor.create(session.id);
      await processor.process();

      return session;
    });
  }
};

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));

app.get('/config', (c) => {
  const config = ConfigLoader.load();
  return c.json({
    config,
    providers: Provider.providers,
    models: Provider.models,
    tools: ToolRegistry.list().map((t) => ({ id: t.id, description: t.description })),
  });
});

app.get('/session/:id', (c) => {
  const sessionId = c.req.param('id');
  const session = SessionManager.get(sessionId);
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json(session);
});

app.post('/run', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const directory = typeof body.directory === 'string' ? body.directory : process.cwd();
  const sessionId =
    typeof body.sessionId === 'string' && body.sessionId.trim()
      ? body.sessionId.trim()
      : Math.random().toString(36).substring(7);
  const content = typeof body.content === 'string' ? body.content : '';

  if (!content.trim()) return c.json({ error: 'Missing content' }, 400);

  const session = await Server.handleRequest(directory, sessionId, content);
  return c.json(session);
});

app.get('/event', (c) => {
  const filterSessionId = c.req.query('sessionId');

  return streamSSE(c, async (stream) => {
    const send = (event: string, data: any) => {
      if (stream.aborted) return;
      stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {});
    };

    const unsubs = [
      Bus.subscribe(SessionEvent.Updated, (data) => {
        if (filterSessionId && data.sessionId !== filterSessionId) return;
        send(SessionEvent.Updated.name, data);
      }),
      Bus.subscribe(PartEvent.Updated, (data) => {
        if (filterSessionId && data.sessionId !== filterSessionId) return;
        send(PartEvent.Updated.name, data);
      }),
      Bus.subscribe(ToolEvent.Started, (data) => {
        if (filterSessionId && data.sessionId !== filterSessionId) return;
        send(ToolEvent.Started.name, data);
      }),
      Bus.subscribe(ToolEvent.Output, (data) => {
        if (filterSessionId && data.sessionId !== filterSessionId) return;
        send(ToolEvent.Output.name, data);
      }),
      Bus.subscribe(ToolEvent.Executed, (data) => {
        if (filterSessionId && data.sessionId !== filterSessionId) return;
        send(ToolEvent.Executed.name, data);
      }),
    ];

    stream.onAbort(() => {
      unsubs.forEach((unsub) => unsub());
    });

    send('open', { ok: true });

    while (!stream.aborted) {
      await stream.sleep(15000);
      send('keepalive', { t: Date.now() });
    }
  });
});

export function startHttpServer(port?: number) {
  const config = ConfigLoader.load();
  const resolvedPort = port ?? config.port;
  const server = Bun.serve({ port: resolvedPort, fetch: app.fetch });
  console.log(`OpenCode server running on http://localhost:${server.port}`);
  return server;
}

if (import.meta.main) {
  startHttpServer();
}
