// src/api/controllers/__tests__/health.controller.test.js
import { jest } from '@jest/globals';
import { getHealthStatus } from '../health.controller.js';

// Mock the config
jest.mock('../../../config/environment.js', () => ({
  config: {
    server: {
      nodeEnv: 'test',
    },
    openai: {
      apiKey: 'test-key',
    }
  }
}));

describe('Health Controller', () => {
  test('should return health status with correct data', () => {
    // Mock request and response
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    const originalDateNow = Date.now;
    const mockDate = new Date('2025-02-25T00:00:00Z');
    global.Date = class extends Date {
      constructor() {
        super();
        return mockDate;
      }
      
      static now() {
        return mockDate.getTime();
      }
      
      toISOString() {
        return '2025-02-25T00:00:00.000Z';
      }
    };
    
    // Call the controller
    getHealthStatus(req, res);
    
    // Verify response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Server is healthy',
      data: {
        environment: 'test',
        timestamp: '2025-02-25T00:00:00.000Z',
        version: '1.0.0',
        services: {
          openai: true
        }
      }
    });
    
    // Restore original Date
    global.Date = Date;
    Date.now = originalDateNow;
  });
});