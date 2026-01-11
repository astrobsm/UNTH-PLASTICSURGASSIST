/**
 * Rate Limiting Utility for Client-Side Protection
 * Prevents brute force attacks and excessive API calls
 */

class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Record an attempt and check if rate limit is exceeded
   */
  attempt(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Filter out old attempts outside the time window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    // Add current attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    // Check if limit exceeded
    return recentAttempts.length <= this.maxAttempts;
  }

  /**
   * Check if rate limit is exceeded without recording an attempt
   */
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return recentAttempts.length >= this.maxAttempts;
  }

  /**
   * Get remaining attempts before rate limit
   */
  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getTimeUntilReset(key: string): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;

    const now = Date.now();
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length === 0) return 0;

    const oldestAttempt = Math.min(...recentAttempts);
    const resetTime = oldestAttempt + this.windowMs;
    
    return Math.max(0, resetTime - now);
  }

  /**
   * Get time until rate limit resets (in human-readable format)
   */
  getResetTimeFormatted(key: string): string {
    const ms = this.getTimeUntilReset(key);
    if (ms === 0) return '0 seconds';

    const minutes = Math.ceil(ms / (60 * 1000));
    if (minutes < 1) return 'less than a minute';
    if (minutes === 1) return '1 minute';
    
    return `${minutes} minutes`;
  }

  /**
   * Clear rate limit for a key (e.g., after successful login)
   */
  clear(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    this.attempts.clear();
  }

  /**
   * Get current attempt count
   */
  getAttemptCount(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return recentAttempts.length;
  }
}

// Singleton instances for different actions
export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
export const apiRateLimiter = new RateLimiter(100, 60 * 1000); // 100 requests per minute
export const exportRateLimiter = new RateLimiter(10, 60 * 60 * 1000); // 10 exports per hour
