import '@testing-library/jest-dom';

// Ensure translations are initialized for component tests.
import '../i18n';

// Node 25+ provides an experimental `globalThis.localStorage` which is not the
// Web Storage API and breaks libs/tests expecting `Storage` semantics.
// Provide a minimal in-memory Storage implementation for unit tests.
function createStorageMock(): Storage {
  let store: Record<string, string> = {};

  const storageLike = {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };

  return storageLike as unknown as Storage;
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true,
});

// Keep `window.*` in sync for code that accesses it directly.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
  });
}
