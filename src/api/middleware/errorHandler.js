// src/api/middleware/errorHandler.js
import logger from '../../utils/logger/index.js';
import { AppError } from '../../utils/errors/appError.js';

// src/api/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Improved error response structure
  const errorResponse = {
    status: err.status,
    message: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    validationErrors: err.validationErrors || null
  };

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle validation errors from Joi differently
  if (err.isJoi) {
    errorResponse.code = 'VALIDATION_ERROR';
    errorResponse.validationErrors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return res.status(400).json(errorResponse);
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      ...errorResponse,
      error: err,
      stack: err.stack
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
    code: 'SERVER_ERROR'
  });
};