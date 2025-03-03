import { AppError } from '../../utils/errors/appError.js';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      // Create a structured validation error
      const validationError = new AppError(400, errorMessage);
      validationError.code = 'VALIDATION_ERROR';
      validationError.validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return next(validationError);
    }
    
    next();
  };
};