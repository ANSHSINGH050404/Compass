export type PartType = 'text' | 'tool' | 'reasoning' | 'patch';

export interface Part {
  id: string;
  type: PartType;
  content: string;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Part[];
  createdAt: number;
}

export interface Session {
  id: string;
  directory: string;
  messages: Message[];
  status: 'idle' | 'busy' | 'error';
}

// In-memory storage for the roadmap example
const sessions = new Map<string, Session>();

export const SessionManager = {
  create(directory: string, id?: string): Session {
    const session: Session = {
      id: id || Math.random().toString(36).substring(7),
      directory,
      messages: [],
      status: 'idle',
    };
    sessions.set(session.id, session);
    return session;
  },

  get(id: string): Session | undefined {
    return sessions.get(id);
  },

  addMessage(sessionId: string, role: Message['role'], content: string): Message {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const message: Message = {
      id: Math.random().toString(36).substring(7),
      role,
      parts: [{ id: Math.random().toString(36).substring(7), type: 'text', content }],
      createdAt: Date.now(),
    };
    session.messages.push(message);
    return message;
  },

  updatePart(sessionId: string, messageId: string, partId: string, delta: string) {
    const session = sessions.get(sessionId);
    if (!session) return;
    const msg = session.messages.find((m) => m.id === messageId);
    if (!msg) return;
    const part = msg.parts.find((p) => p.id === partId);
    if (!part) return;
    part.content += delta;
  }
};
