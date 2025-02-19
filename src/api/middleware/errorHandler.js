// src/api/middleware/errorHandler.js
import logger from '../../utils/logger/index.js';
import { AppError } from '../../utils/errors/AppError.js';

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      status: 'error',
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
};