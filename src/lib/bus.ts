// /lib/bus.ts
type Handler = (payload: any) => void;
const listeners = new Map<string, Set<Handler>>();

export const bus = {
  on(event: string, handler: Handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
    return () => listeners.get(event)!.delete(handler);
  },
  emit(event: string, payload?: any) {
    listeners.get(event)?.forEach(h => h(payload));
  }
};