import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock crypto for tests
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: async (_algorithm: string, _data: BufferSource) => {
        return new ArrayBuffer(32);
      },
      importKey: async (..._args: any[]) => ({} as CryptoKey),
      deriveKey: async (..._args: any[]) => ({} as CryptoKey),
      encrypt: async (..._args: any[]) => new ArrayBuffer(64),
      decrypt: async (..._args: any[]) => new ArrayBuffer(32)
    }
  } as any;
}

// In-memory Web Storage implementation.
// The previous stub discarded every write and returned null from getItem, so any
// code under test that round-trips through storage (auth tokens, CSRF tokens,
// sync timestamps) silently read back nothing. That made the suite unable to
// catch storage-state bugs — the exact class of defect that produced the
// auth_token/psa-auth session divergence in production.
function createStorageMock(): Storage {
  let store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(String(key), String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store = new Map(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

// Two INDEPENDENT stores. They previously shared one object, so a write to
// localStorage was readable via sessionStorage and vice versa.
global.localStorage = createStorageMock();
global.sessionStorage = createStorageMock();

// Storage must not leak between tests.
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
