// src/api/controllers/__tests__/llm.controller.test.js
import { jest } from '@jest/globals';
import { generateContent } from '../llm.controller.js';
import { AppError } from '../../../utils/errors/AppError.js';

// Mock the LLMService
jest.mock('../../../services/llm/llm.service.js', () => {
  return {
    LLMService: jest.fn().mockImplementation(() => {
      return {
        enhance: jest.fn()
      };
    })
  };
});

// Mock logger
jest.mock('../../../utils/logger/index.js', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

// Import after mocking
import { LLMService } from '../../../services/llm/llm.service.js';
import logger from '../../../utils/logger/index.js';

describe('LLM Controller', () => {
  let req;
  let res;
  let next;
  let mockLLMInstance;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create request and response mocks
    req = {
      body: {
        section: 'work',
        content: 'Test content',
        context: {
          role: 'Developer'
        },
        parameters: {
          temperature: 0.7
        }
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Get the mock LLM instance
    mockLLMInstance = new LLMService();
  });
  
  test('should generate content successfully', async () => {
    // Setup mock response from enhance
    const mockEnhancedContent = {
      original: 'Test content',
      enhanced: 'Enhanced test content',
      metadata: {
        section: 'work',
        timestamp: '2025-02-25T00:00:00.000Z'
      }
    };
    
    mockLLMInstance.enhance.mockResolvedValue(mockEnhancedContent);
    
    // Call the controller
    await generateContent(req, res, next);
    
    // Verify LLM service was called correctly
    expect(LLMService).toHaveBeenCalled();
    expect(mockLLMInstance.enhance).toHaveBeenCalledWith(
      'work', 
      'Test content', 
      { role: 'Developer' }, 
      { temperature: 0.7 }
    );
    
    // Verify response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: {
        original: 'Test content',
        enhanced: mockEnhancedContent
      }
    });
    
    // Verify logger was called
    expect(logger.info).toHaveBeenCalledTimes(2);
  });
  
  test('should handle errors and pass to next middleware', async () => {
    // Setup mock error
    const error = new Error('Test error');
    mockLLMInstance.enhance.mockRejectedValue(error);
    
    // Call the controller
    await generateContent(req, res, next);
    
    // Verify error handling
    expect(logger.error).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].message).toBe('Failed to generate content');
    expect(next.mock.calls[0][0].statusCode).toBe(500);
  });
});