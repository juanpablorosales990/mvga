import { useSyncExternalStore, useCallback } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

let toasts: Toast[] = [];
let listeners: Array<() => void> = [];
let nextId = 0;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function showToast(type: Toast['type'], message: string, durationMs = 5000) {
  const id = String(++nextId);
  toasts = [...toasts, { id, type, message }];
  emitChange();

  setTimeout(() => {
    dismissToast(id);
  }, durationMs);

  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitChange();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return toasts;
}

export function useToast() {
  const current = useSyncExternalStore(subscribe, getSnapshot);

  const toast = useCallback(
    (type: Toast['type'], message: string, durationMs?: number) =>
      showToast(type, message, durationMs),
    []
  );

  return { toasts: current, toast, dismiss: dismissToast };
}
