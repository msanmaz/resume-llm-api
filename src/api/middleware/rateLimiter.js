import rateLimit from 'express-rate-limit';
import { config } from '../../config/environment.js';

export const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later'
  }
});