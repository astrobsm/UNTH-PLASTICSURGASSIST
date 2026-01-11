import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
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
      digest: async (algorithm: string, data: BufferSource) => {
        return new ArrayBuffer(32);
      },
      importKey: async (...args: any[]) => ({} as CryptoKey),
      deriveKey: async (...args: any[]) => ({} as CryptoKey),
      encrypt: async (...args: any[]) => new ArrayBuffer(64),
      decrypt: async (...args: any[]) => new ArrayBuffer(32)
    }
  } as any;
}

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {}
};

global.localStorage = localStorageMock as any;
global.sessionStorage = localStorageMock as any;
