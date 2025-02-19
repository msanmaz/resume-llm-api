// src/api/middleware/validateRequest.js
import { AppError } from '../../utils/errors/AppError.js';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new AppError(400, errorMessage));
    }
    
    next();
  };
};