import { describe, it, expect, beforeEach } from 'vitest';

class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  attempt(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return recentAttempts.length <= this.maxAttempts;
  }

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    return recentAttempts.length >= this.maxAttempts;
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}

describe('Rate Limiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(3, 1000); // 3 attempts per second
  });

  it('should allow attempts within limit', () => {
    expect(rateLimiter.attempt('test')).toBe(true);
    expect(rateLimiter.attempt('test')).toBe(true);
    expect(rateLimiter.attempt('test')).toBe(true);
  });

  it('should block attempts exceeding limit', () => {
    rateLimiter.attempt('test');
    rateLimiter.attempt('test');
    rateLimiter.attempt('test');
    expect(rateLimiter.attempt('test')).toBe(false);
  });

  it('should track different keys separately', () => {
    rateLimiter.attempt('user1');
    rateLimiter.attempt('user1');
    rateLimiter.attempt('user1');
    
    expect(rateLimiter.attempt('user2')).toBe(true);
  });

  it('should detect rate limit status', () => {
    expect(rateLimiter.isRateLimited('test')).toBe(false);
    
    rateLimiter.attempt('test');
    rateLimiter.attempt('test');
    rateLimiter.attempt('test');
    
    expect(rateLimiter.isRateLimited('test')).toBe(true);
  });

  it('should clear rate limit', () => {
    rateLimiter.attempt('test');
    rateLimiter.attempt('test');
    rateLimiter.attempt('test');
    
    rateLimiter.clear('test');
    
    expect(rateLimiter.isRateLimited('test')).toBe(false);
    expect(rateLimiter.attempt('test')).toBe(true);
  });
});
