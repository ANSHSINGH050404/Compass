import { anthropic } from '@ai-sdk/anthropic';
import { Gemini } from './gemini.ts';

export const Provider = {
  /**
   * List of supported providers
   */
  providers: [
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'google', name: 'Google Gemini' },
  ],

  /**
   * List of standard models
   */
  models: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    ...Gemini.models.map(m => ({ ...m, provider: 'google' })),
  ],

  /**
   * Fetches metadata for a specific model
   */
  getModel(modelId: string) {
    return this.models.find(m => m.id === modelId);
  },

  /**
   * Returns the AI SDK language model for the requested modelId
   */
  getLanguage(modelId: string) {
    const model = this.getModel(modelId);

    if (model?.provider === 'google') {
      return Gemini.getLanguage(modelId);
    }

    if (model?.provider === 'anthropic') {
      return anthropic(modelId);
    }

    throw new Error(`Model ${modelId} not supported`);
  }
};

export const ProviderTransform = {
  messages(messages: any[]) {
    // Transform Session Messages into standard AI SDK Message format
    return messages.map((m) => ({
      role: m.role,
      content: m.parts.map((p: any) => p.content).join(''),
    }));
  }
};
