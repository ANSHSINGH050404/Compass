import { AsyncLocalStorage } from 'node:async_hooks';

export interface InstanceContext {
  directory: string;
}

const storage = new AsyncLocalStorage<InstanceContext>();
const states = new Map<string, Map<any, any>>();

export const Instance = {
  provide<T>(ctx: InstanceContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },

  get directory(): string {
    const ctx = storage.getStore();
    if (!ctx) throw new Error('No instance context');
    return ctx.directory;
  },

  state<T>(fn: () => T): T {
    const dir = this.directory;
    if (!states.has(dir)) {
      states.set(dir, new Map());
    }
    const instanceStates = states.get(dir)!;
    if (!instanceStates.has(fn)) {
      instanceStates.set(fn, fn());
    }
    return instanceStates.get(fn);
  },
};
