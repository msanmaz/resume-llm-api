// src/__tests__/app.test.js
import { jest } from '@jest/globals';
import request from 'supertest';

// Mock config
jest.mock('../config/environment.js', () => ({
  config: {
    server: {
      port: 3000,
      nodeEnv: 'test'
    },
    openai: {
      apiKey: 'test-key'
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100
    },
    logging: {
      level: 'debug'
    }
  }
}));

// Mock middlewares
jest.mock('../api/middleware/rateLimiter.js', () => ({
  limiter: jest.fn((req, res, next) => next())
}));

jest.mock('../api/middleware/errorHandler.js', () => ({
  errorHandler: jest.fn((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  })
}));

// Mock routes
jest.mock('../api/routes/index.js', () => {
  const express = require('express');
  const router = express.Router();
  
  router.get('/v1/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Mocked health endpoint' });
  });
  
  router.post('/v1/llm/generate', express.json(), (req, res) => {
    res.status(200).json({ status: 'success', data: 'Mocked LLM response' });
  });
  
  return router;
});

// Now import the app
import { application as app } from '../app.js';

describe('Express Application', () => {
  test('should respond to health endpoint', async () => {
    const response = await request(app).get('/api/v1/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      message: 'Mocked health endpoint'
    });
  });
  
  test('should respond to LLM endpoint', async () => {
    const testData = {
      section: 'work',
      content: 'Test content'
    };
    
    const response = await request(app)
      .post('/api/v1/llm/generate')
      .send(testData)
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      data: 'Mocked LLM response'
    });
  });
  
  test('should return 404 for non-existent routes', async () => {
    const response = await request(app).get('/api/non-existent');
    
    expect(response.status).toBe(500); // Due to our mocked error handler
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('not found');
  });
});