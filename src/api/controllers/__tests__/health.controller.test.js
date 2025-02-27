// src/api/controllers/__tests__/health.controller.test.js
import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { getHealthStatus } from '../health.controller.js';

describe('Health Controller', () => {
  let app;
  
  beforeEach(() => {
    // Create a test app
    app = express();
    
    // Add the controller
    app.get('/health', getHealthStatus);
  });
  
  test('should return health status with correct data', async () => {
    const response = await supertest(app).get('/health');
    
    // Verify the response
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
});