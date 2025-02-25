// src/api/middleware/__tests__/errorHandler.test.js
import { jest } from '@jest/globals';
import { errorHandler } from '../errorHandler.js';
import { AppError } from '../../../utils/errors/AppError.js';

// Mock logger
jest.mock('../../../utils/logger/index.js', () => ({
  default: {
    error: jest.fn()
  }
}));

// Import after mocking
import logger from '../../../utils/logger/index.js';

describe('Error Handler Middleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Setup mocks
    req = {
      path: '/test',
      method: 'GET'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
  });
  
  test('should handle AppError correctly', () => {
    // Create AppError
    const error = new AppError(400, 'Bad Request Error');
    error.code = 'BAD_REQUEST';
    
    // Call error handler
    errorHandler(error, req, res, next);
    
    // Verify logger was called
    expect(logger.error).toHaveBeenCalled();
    
    // Verify response
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'fail',
      message: 'Bad Request Error',
      code: 'BAD_REQUEST',
      validationErrors: null
    });
  });
  
  test('should handle Joi validation errors correctly', () => {
    // Create Joi error
    const error = new Error('Validation failed');
    error.isJoi = true;
    error.details = [
      { path: ['field1'], message: 'Field 1 is required' },
      { path: ['field2'], message: 'Field 2 is too short' }
    ];
    
    // Call error handler
    errorHandler(error, req, res, next);
    
    // Verify response
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      validationErrors: [
        { field: 'field1', message: 'Field 1 is required' },
        { field: 'field2', message: 'Field 2 is too short' }
      ]
    });
  });
  
  test('should handle generic errors in production mode', () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    // Set NODE_ENV to production
    process.env.NODE_ENV = 'production';
    
    // Create generic error
    const error = new Error('Some error');
    
    // Call error handler
    errorHandler(error, req, res, next);
    
    // Verify response for production
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Something went wrong!',
      code: 'SERVER_ERROR'
    });
    
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  test('should handle generic errors in development mode with more details', () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    // Set NODE_ENV to development
    process.env.NODE_ENV = 'development';
    
    // Create generic error
    const error = new Error('Development error');
    error.stack = 'Error stack';
    
    // Call error handler
    errorHandler(error, req, res, next);
    
    // Verify response for development
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Development error',
      code: 'UNKNOWN_ERROR',
      validationErrors: null,
      error: error,
      stack: 'Error stack'
    });
    
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
});