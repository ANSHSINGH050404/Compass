export type EventName = string;
export type EventCallback<T = any> = (data: T) => void;

export interface EventDef<T = any> {
  name: EventName;
}

const subscribers = new Map<EventName, Set<EventCallback>>();

export const Bus = {
  publish<T>(event: EventDef<T>, data: T) {
    const list = subscribers.get(event.name);
    if (list) {
      list.forEach((cb) => cb(data));
    }
  },

  subscribe<T>(event: EventDef<T>, callback: EventCallback<T>) {
    if (!subscribers.has(event.name)) {
      subscribers.set(event.name, new Set());
    }
    subscribers.get(event.name)!.add(callback);
    return () => this.unsubscribe(event, callback);
  },

  unsubscribe<T>(event: EventDef<T>, callback: EventCallback<T>) {
    const list = subscribers.get(event.name);
    if (list) {
      list.delete(callback);
    }
  },

  once<T>(event: EventDef<T>): Promise<T> {
    return new Promise((resolve) => {
      const unsub = this.subscribe(event, (data) => {
        unsub();
        resolve(data);
      });
    });
  },
};
