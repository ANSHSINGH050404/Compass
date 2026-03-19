// Mock Drizzle schema
export const SessionTable = {
  id: 'string',
  directory: 'string',
  status: 'string',
  createdAt: 'number',
};

export const MessageTable = {
  id: 'string',
  sessionId: 'string',
  role: 'string',
  createdAt: 'number',
};

export const PartTable = {
  id: 'string',
  messageId: 'string',
  type: 'string',
  content: 'text',
  metadata: 'json',
};
