import { describe, it, expect, beforeEach } from 'vitest';
import { generateCSRFToken, validateCSRFToken, initializeCSRFToken } from '../utils/csrf';

describe('CSRF Protection', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('generateCSRFToken', () => {
    it('should generate a token of correct length', () => {
      const token = generateCSRFToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain hex characters', () => {
      const token = generateCSRFToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate matching tokens', () => {
      const token = generateCSRFToken();
      expect(validateCSRFToken(token, token)).toBe(true);
    });

    it('should reject non-matching tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(validateCSRFToken(token1, token2)).toBe(false);
    });

    it('should reject empty tokens', () => {
      expect(validateCSRFToken('', 'token')).toBe(false);
      expect(validateCSRFToken('token', '')).toBe(false);
    });

    it('should reject tokens of different lengths', () => {
      expect(validateCSRFToken('short', 'muchlongertoken')).toBe(false);
    });
  });

  describe('initializeCSRFToken', () => {
    it('should initialize a new token', () => {
      const token = initializeCSRFToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
    });

    it('should reuse existing token', () => {
      const token1 = initializeCSRFToken();
      const token2 = initializeCSRFToken();
      expect(token1).toBe(token2);
    });
  });
});
