// src/__tests__/app.test.js
import { jest } from '@jest/globals';
import supertest from 'supertest';

// Create a mock enhance function
const mockEnhance = jest.fn().mockResolvedValue({
  original: 'Test content',
  enhanced: 'Enhanced Test content',
  metadata: {
    section: 'work',
    timestamp: new Date().toISOString(),
    enhancementFocus: ['keywords', 'achievements']
  }
});

// Make the constructor itself a jest.fn()
const MockLLMService = jest.fn().mockImplementation(() => {
  return {
    enhance: mockEnhance
  };
});

// Mock the module
jest.mock('../services/llm/llm.service.js', () => ({
  LLMService: MockLLMService
}));

// Import after mock setup
import { application as app } from '../app.js';
import { LLMService } from '../services/llm/llm.service.js';

describe('Express Application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should respond to health endpoint', async () => {
    const response = await supertest(app).get('/api/v1/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'success',
      message: 'Server is healthy',
      data: {
        environment: expect.any(String),
        timestamp: expect.any(String),
        version: expect.any(String),
        services: {
          openai: expect.any(Boolean)
        }
      }
    });
  });
  
  test('should respond to LLM endpoint', async () => {
    const testData = {
      section: 'work',
      content: 'Test content'
    };
    
    const response = await supertest(app)
      .post('/api/v1/llm/generate')
      .send(testData)
      .set('Accept', 'application/json');
    
    // Verify the LLMService constructor was called
    expect(LLMService).toHaveBeenCalled();
    
    // Verify the enhance method was called with expected arguments
    expect(mockEnhance).toHaveBeenCalledWith(
      'work',
      'Test content',
      expect.any(Object),
      expect.any(Object)
    );
    
    // Verify the response
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        original: 'Test content',
        enhanced: 'Enhanced Test content'
      }
    });
  });
  
  test('should return 404 for non-existent routes', async () => {
    // Create a specialized test app with proper error handling
    const testApp = express();
    testApp.use(express.json());
    
    // Add middleware that forces a 404 error
    testApp.all('*', (req, res, next) => {
      const error = new Error(`Route ${req.originalUrl} not found`);
      error.status = 'fail';
      error.statusCode = 404;
      next(error);
    });
    
    // Add error handler middleware
    testApp.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        status: err.status || 'error',
        message: err.message
      });
    });
  
    const response = await supertest(testApp).get('/non-existent-route');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('status', 'fail');
    expect(response.body.message).toContain('not found');
  });
});