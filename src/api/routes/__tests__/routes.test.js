// src/api/routes/__tests__/routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import healthRoutes from '../health.routes.js';
import llmRoutes from '../llm.routes.js';
import routes from '../index.js';

// Mock controllers
jest.mock('../../controllers/health.controller.js', () => ({
  getHealthStatus: jest.fn((req, res) => res.status(200).json({ status: 'success', message: 'Mocked health response' }))
}));

jest.mock('../../controllers/llm.controller.js', () => ({
  generateContent: jest.fn((req, res) => res.status(200).json({ status: 'success', data: 'Mocked LLM response' }))
}));

// Mock middleware
jest.mock('../../middleware/validateRequest.js', () => ({
  validateRequest: jest.fn(() => (req, res, next) => next())
}));

// Mock validators
jest.mock('../../validators/llm.validator.js', () => ({
  generateContentSchema: { name: 'mockSchema' }
}));

describe('API Routes', () => {
  describe('Health Routes', () => {
    let app;
    
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/', healthRoutes);
    });
    
    test('GET / should route to health controller', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        message: 'Mocked health response'
      });
    });
  });
  
  describe('LLM Routes', () => {
    let app;
    
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/', llmRoutes);
    });
    
    test('POST /generate should route to LLM controller with validation', async () => {
      const testData = {
        section: 'work',
        content: 'Test content'
      };
      
      const response = await request(app)
        .post('/generate')
        .send(testData)
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: 'Mocked LLM response'
      });
    });
  });
  
  describe('Index Routes', () => {
    let app;
    
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/api', routes);
    });
    
    test('should set up health routes correctly', async () => {
      const response = await request(app).get('/api/v1/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        message: 'Mocked health response'
      });
    });
    
    test('should set up LLM routes correctly', async () => {
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
  });
});