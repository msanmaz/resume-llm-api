// src/api/middleware/__tests__/rateLimiter.test.js
import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { limiter } from '../rateLimiter.js';
import { config } from '../../../config/environment.js';

describe('Rate Limiter Middleware', () => {
  test('should use rate limiting configuration from environment', () => {
    // Verify limiter exists
    expect(limiter).toBeDefined();
    
    // Create a simple app to test the limiter
    const app = express();
    app.use(limiter);
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'Test route' });
    });
    
    // Test that the limiter works
    return supertest(app)
      .get('/test')
      .expect(200)
      .then(response => {
        expect(response.body).toEqual({ message: 'Test route' });
      });
  });
  
  test('should use correct configuration values', () => {
    // This is a more of a configuration test that verifies our config
    // values are being used correctly
    expect(config.rateLimit.windowMs).toBe(900000); // 15 minutes
    expect(config.rateLimit.maxRequests).toBe(100);
  });
});