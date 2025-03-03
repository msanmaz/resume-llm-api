// src/config/environment.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
dotenv.config({ path: join(dirname(__dirname), '../.env') });

// Add some debug logging
console.log('Environment variables:', {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV
});

export const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  apiKey: process.env.API_KEY || 'api key needed for development',
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
    jobExpiry: parseInt(process.env.REDIS_JOB_EXPIRY || (24 * 60 * 60)), // 24 hours in seconds
    poolSize: parseInt(process.env.REDIS_POOL_SIZE || '10'), // Redis connection pool size
    poolMin: parseInt(process.env.REDIS_POOL_MIN || '2'), // Minimum connections in pool
    acquireTimeout: parseInt(process.env.REDIS_ACQUIRE_TIMEOUT || '5000'), // Timeout in ms for acquiring connection
    idleTimeout: parseInt(process.env.REDIS_IDLE_TIMEOUT || '30000'), // Timeout in ms for idle connections
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key']
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    queues: {
      llmRequests: 'llm-enhancement-requests',
      llmResults: 'llm-enhancement-results'
    },
    // how many messages a consumer will process concurrently
    prefetch: parseInt(process.env.RABBITMQ_PREFETCH || '10'),
    // Configure retry settings
    retryAttempts: parseInt(process.env.RABBITMQ_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY || '5000') // 5 seconds
  }
};
console.log('Config:', {
  server: config.server,
  rateLimit: config.rateLimit
});

const requiredEnvVars = ['OPENAI_API_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}