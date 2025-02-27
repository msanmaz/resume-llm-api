// src/__tests__/server.test.js
import { jest } from '@jest/globals';

// Clear the cache to ensure fresh imports
jest.resetModules();

describe('Server', () => {
  let mockListen;
  let mockLogger;
  let server;
  
  beforeEach(async () => {
    // Create fresh mocks
    mockListen = jest.fn().mockImplementation((port, cb) => {
      if (cb) cb();
      return { close: jest.fn() };
    });
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    
    // Setup mocks BEFORE importing the server module
    jest.doMock('../app.js', () => ({
      application: {
        listen: mockListen
      }
    }));
    
    jest.doMock('../utils/logger/index.js', () => ({
      default: mockLogger
    }));
    
    jest.doMock('../config/environment.js', () => ({
      config: {
        server: {
          port: 3000,
          nodeEnv: 'test'
        }
      }
    }));
    
    // Mock process methods
    process.exit = jest.fn();
    process.on = jest.fn();
    
    // Now import the server module
    server = await import('../server.js');
  });
  
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });
  
  test('should set up event handlers', () => {
    // Process handlers
    expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    
    // Server listening
    expect(mockListen).toHaveBeenCalledWith(3000, expect.any(Function));
    
    // Logger calls
    expect(mockLogger.debug).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
  });
});