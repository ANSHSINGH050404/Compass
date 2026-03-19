/**
 * Google Gemini Provider for OpenCode
 * Powered by Vercel AI SDK (@ai-sdk/google)
 */
import { google } from '@ai-sdk/google';

export const Gemini = {
  id: 'google',
  name: 'Google Gemini',

  /**
   * Latest Gemini Models (March 2026)
   */
  models: [
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro (Reasoning)',
      family: 'gemini-3',
      maxTokens: 1000000,
      thinking: true, // Supports thinkingLevel
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      name: 'Gemini 3.1 Flash-Lite (Fastest)',
      family: 'gemini-3',
      maxTokens: 1000000,
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro (Stable)',
      family: 'gemini-2.5',
      maxTokens: 1000000,
      thinking: true, // Supports thinkingBudget
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (Stable)',
      family: 'gemini-2.5',
      maxTokens: 1000000,
    }
  ],

  /**
   * Returns the AI SDK language model instance
   */
  getLanguage(modelId: string, options: { thinkingLevel?: string } = {}) {
    const modelInfo = this.models.find(m => m.id === modelId);

    // For Gemini 3.1 Pro, enable high thinking level for coding by default
    if (modelId === 'gemini-3.1-pro-preview') {
      return google(modelId, {
        thinkingLevel: options.thinkingLevel || 'high'
      });
    }

    return google(modelId);
  }
};
