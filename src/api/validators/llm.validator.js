// src/api/validators/llm.validator.js
import Joi from 'joi';

export const generateContentSchema = Joi.object({
  section: Joi.string()
    .required()
    .valid('work', 'summary', 'skills', 'achievements')
    .description('Section of the resume to enhance'),
    
  content: Joi.string()
    .required()
    .min(3)
    .max(1000)
    .description('Original content to enhance'),
    
  context: Joi.object({
    role: Joi.string().optional(),
    industry: Joi.string().optional(),
    experienceLevel: Joi.string().optional()
  }).optional(),
    
  parameters: Joi.object({
    temperature: Joi.number().min(0).max(1).default(0.7),
    style: Joi.string().valid('professional', 'technical', 'executive').default('professional')
  }).optional()
});