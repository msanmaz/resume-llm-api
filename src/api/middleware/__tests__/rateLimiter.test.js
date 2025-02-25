// src/api/middleware/__tests__/rateLimiter.test.js
import { jest } from '@jest/globals';
import { limiter } from '../rateLimiter.js';

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation((options) => {
    // Store the options for testing
    return { mockRateLimitOptions: options };
  });
});

// Mock the config
jest.mock('../../../config/environment.js', () => ({
  config: {
    rateLimit: {
      windowMs: 900000, // 15 minutes
      maxRequests: 100
    }
  }
}));

// Import after mocking
import rateLimit from 'express-rate-limit';
import { config } from '../../../config/environment.js';

describe('Rate Limiter Middleware', () => {
  test('should create rate limiter with correct configuration', () => {
    // Verify rate limiter was created with correct options
    expect(rateLimit).toHaveBeenCalledTimes(1);
    
    // Get the options passed to rateLimit
    const options = limiter.mockRateLimitOptions;
    
    // Verify options
    expect(options.windowMs).toBe(config.rateLimit.windowMs);
    expect(options.max).toBe(config.rateLimit.maxRequests);
    expect(options.message).toEqual({
      status: 'error',
      message: 'Too many requests from this IP, please try again later'
    });
  });
});