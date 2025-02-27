// src/api/routes/__tests__/routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

// Set up mocks before imports
const mockEnhance = jest.fn().mockResolvedValue({
  original: 'Test content',
  enhanced: 'Enhanced Test content',
  metadata: {
    section: 'work',
    timestamp: new Date().toISOString(),
    enhancementFocus: ['keywords', 'achievements']
  }
});

// Mock the LLMService module with factory function
jest.mock('../../../services/llm/llm.service.js', () => {
  return {
    LLMService: jest.fn().mockImplementation(() => ({
      enhance: mockEnhance
    }))
  };
});

// Import modules after mocking
import healthRoutes from '../health.routes.js';
import llmRoutes from '../llm.routes.js';
import routes from '../index.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { AppError } from '../../../utils/errors/AppError.js';
import { LLMService } from '../../../services/llm/llm.service.js';

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Health Routes', () => {
    let app;
    
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/', healthRoutes);
    });
    
    test('GET / should return health status', async () => {
      const response = await supertest(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Server is healthy'
      });
    });
  });
  
  describe('LLM Routes', () => {
    let app;
    
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/', llmRoutes);
      
      // Add error handler
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          status: err.status || 'error',
          message: err.message
        });
      });
    });
    
    test('POST /generate should enhance content', async () => {
      const testData = {
        section: 'work',
        content: 'Test content'
      };
      
      const response = await supertest(app)
        .post('/generate')
        .send(testData)
        .set('Accept', 'application/json');
      
      // Verify LLMService constructor was called
      expect(LLMService).toHaveBeenCalled();
      
      // Verify enhance method was called
      expect(mockEnhance).toHaveBeenCalled();
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          original: 'Test content',
          enhanced: 'Enhanced Test content'
        }
      });
    },10000);
    
    test('POST /generate with invalid data should return validation error', async () => {
      const invalidData = {
        // Missing required fields
        section: 'invalid'
      };
      
      const response = await supertest(app)
        .post('/generate')
        .send(invalidData)
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });
  });
  
  describe('Index Routes', () => {
    let app;
    
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/api', routes);
      
      // Add error handler for non-existent routes
      app.use((req, res, next) => {
        next(new AppError(404, `Route ${req.originalUrl} not found`));
      });
      
      app.use(errorHandler);
    });
    
    test('should set up health routes correctly', async () => {
      const response = await supertest(app).get('/api/v1/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Server is healthy'
      });
    });
    
    test('should set up LLM routes correctly', async () => {
      const testData = {
        section: 'work',
        content: 'Test content'
      };
      
      const response = await supertest(app)
        .post('/api/v1/llm/generate')
        .send(testData)
        .set('Accept', 'application/json');
      
      // Verify LLMService constructor was called
      expect(LLMService).toHaveBeenCalled();
      
      // Verify enhance method was called
      expect(mockEnhance).toHaveBeenCalled();
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          original: 'Test content',
          enhanced: 'Enhanced Test content'
        }
      });
    });
    
    test('should handle non-existent routes', async () => {
      const response = await supertest(app).get('/api/non-existent');
      
      expect(response.status).toBe(404);
      
      // Log the actual response for debugging
      console.log('404 Response:', response.body);
      
      // The AppError for 404 should set status to 'fail'
      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('not found');
    });
  });
});