import { z } from 'zod';

export const ConfigSchema = z.object({
  model: z.string().default('gemini-3.1-pro-preview'),
  provider: z.string().default('google'),
  apiKey: z.string().optional(),
  directory: z.string().default(process.cwd()),
  port: z.number().default(4096),
  theme: z.enum(['light', 'dark']).default('dark'),
  tools: z.array(z.string()).default(['bash', 'read', 'write', 'edit', 'glob', 'grep']),
});

export type Config = z.infer<typeof ConfigSchema>;

export const ConfigLoader = {
  load(): Config {
    // In a real app, this would load from a file (e.g., opencode.json)
    const port = process.env.PORT ? Number(process.env.PORT) : undefined;
    const defaults = {
      model: process.env.OPENCODE_MODEL,
      provider: process.env.OPENCODE_PROVIDER,
      apiKey: process.env.OPENCODE_API_KEY,
      directory: process.env.OPENCODE_DIRECTORY,
      port: Number.isFinite(port) ? port : undefined,
    };
    return ConfigSchema.parse(defaults);
  }
};
