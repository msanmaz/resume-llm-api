// src/api/middleware/__tests__/errorHandler.test.js
import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { errorHandler } from '../errorHandler.js';
import { AppError } from '../../../utils/errors/AppError.js';

describe('Error Handler Middleware', () => {
  let app;
  
  beforeEach(() => {
    // Create a test app for each test
    app = express();
    
    // Add a route that generates different errors based on path
    app.get('/app-error', (req, res, next) => {
      next(new AppError(400, 'Bad Request Error'));
    });
    
    app.get('/validation-error', (req, res, next) => {
      const error = new Error('Validation failed');
      error.isJoi = true;
      error.details = [
        { path: ['field1'], message: 'Field 1 is required' },
        { path: ['field2'], message: 'Field 2 is too short' }
      ];
      next(error);
    });
    
    app.get('/generic-error', (req, res, next) => {
      next(new Error('Some error'));
    });
    
    // Add the error handler middleware
    app.use(errorHandler);
  });
  
  test('should handle AppError correctly', async () => {
    const response = await supertest(app).get('/app-error');
    
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'fail',
      message: 'Bad Request Error'
    });
  });
  
  test('should handle Joi validation errors correctly', async () => {
    const response = await supertest(app).get('/validation-error');
    
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      validationErrors: [
        { field: 'field1', message: 'Field 1 is required' },
        { field: 'field2', message: 'Field 2 is too short' }
      ]
    });
  });
  
  test('should handle generic errors with appropriate mode', async () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    // Test production mode
    process.env.NODE_ENV = 'production';
    let response = await supertest(app).get('/generic-error');
    
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Something went wrong!',
      code: 'SERVER_ERROR'
    });
    
    // Test development mode
    process.env.NODE_ENV = 'development';
    response = await supertest(app).get('/generic-error');
    
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Some error',
      code: 'UNKNOWN_ERROR'
    });
    expect(response.body).toHaveProperty('stack');
    
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
});