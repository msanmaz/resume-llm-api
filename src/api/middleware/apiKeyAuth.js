// src/api/middleware/apiKeyAuth.js
import { AppError } from '../../utils/errors/AppError.js';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger/index.js';

export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.apiKey) {
    logger.warn('Unauthorized API request', {
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method
    });
    
    return next(new AppError(401, 'Unauthorized'));
  }
  
  next();
};