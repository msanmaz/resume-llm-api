// src/api/controllers/__tests__/llm.controller.test.js
import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

// Set up mock enhance function
const mockEnhance = jest.fn().mockResolvedValue({
  original: 'Test content',
  enhanced: 'Enhanced Test content',
  metadata: {
    section: 'work',
    timestamp: new Date().toISOString(),
    enhancementFocus: ['keywords', 'achievements']
  }
});

// Mock using factory function - make sure LLMService is a jest.fn()
jest.mock('../../../services/llm/llm.service.js', () => ({
  LLMService: jest.fn().mockImplementation(() => ({
    enhance: mockEnhance
  }))
}));

// Import after mocking
import { generateContent } from '../llm.controller.js';
import { LLMService } from '../../../services/llm/llm.service.js';

describe('LLM Controller', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a test app
    app = express();
    app.use(express.json());
    
    // Add the controller
    app.post('/generate', generateContent);
    
    // Add basic error handling
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        status: err.status || 'error',
        message: err.message
      });
    });
  });
  
  test('should generate content successfully', async () => {
    const testData = {
      section: 'work',
      content: 'Test content',
      context: {
        role: 'Developer'
      },
      parameters: {
        temperature: 0.7
      }
    };
    
    const response = await supertest(app)
      .post('/generate')
      .send(testData)
      .set('Accept', 'application/json');
    
    // Verify LLM service constructor was called
    expect(LLMService).toHaveBeenCalled();
    
    // Verify enhance method was called with correct parameters
    expect(mockEnhance).toHaveBeenCalledWith(
      'work',
      'Test content',
      { role: 'Developer' },
      { temperature: 0.7 }
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
  
  test('should handle errors', async () => {
    // Override mock for this test only
    mockEnhance.mockRejectedValueOnce(new Error('Test error'));
    
    const testData = {
      section: 'work',
      content: 'Test content'
    };
    
    const response = await supertest(app)
      .post('/generate')
      .send(testData)
      .set('Accept', 'application/json');
    
    // Verify LLM service constructor was called
    expect(LLMService).toHaveBeenCalled();
    
    // Verify enhance method was called
    expect(mockEnhance).toHaveBeenCalled();
    
    // Verify error handling
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Failed to generate content'
    });
  });
});