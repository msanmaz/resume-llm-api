// src/api/middleware/__tests__/validateRequest.test.js
import { jest } from '@jest/globals';
import { validateRequest } from '../validateRequest.js';
import { AppError } from '../../../utils/errors/AppError.js';

describe('Validate Request Middleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      body: {
        testField: 'test value'
      }
    };
    
    res = {};
    
    next = jest.fn();
  });
  
  test('should call next() if validation passes', () => {
    // Create a mock schema that passes validation
    const mockSchema = {
      validate: jest.fn().mockReturnValue({})
    };
    
    // Create middleware
    const middleware = validateRequest(mockSchema);
    
    // Call middleware
    middleware(req, res, next);
    
    // Verify schema was called with request body
    expect(mockSchema.validate).toHaveBeenCalledWith(req.body, { abortEarly: false });
    
    // Verify next was called with no arguments
    expect(next).toHaveBeenCalledWith();
  });
  
  test('should call next() with error if validation fails', () => {
    // Create a mock schema that fails validation
    const mockError = {
      details: [
        { message: 'Field is required', path: ['requiredField'] },
        { message: 'Value too short', path: ['shortField'] }
      ]
    };
    
    const mockSchema = {
      validate: jest.fn().mockReturnValue({ error: mockError })
    };
    
    // Create middleware
    const middleware = validateRequest(mockSchema);
    
    // Call middleware
    middleware(req, res, next);
    
    // Verify next was called with error
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    
    // Verify error properties
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Field is required, Value too short');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.validationErrors).toEqual([
      { field: 'requiredField', message: 'Field is required' },
      { field: 'shortField', message: 'Value too short' }
    ]);
  });
});