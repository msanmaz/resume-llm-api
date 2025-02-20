// src/api/validators/llm.validator.js
import Joi from 'joi';

export const generateContentSchema = Joi.object({
  section: Joi.string()
    .required()
    .valid('work', 'summary', 'skills', 'education', 'achievements')
    .description('Section of the resume to enhance'),
    
  content: Joi.string()
    .required()
    .min(10)
    .max(5000)
    .trim()
    .pattern(/^(?!\s*$).+/) // Ensures content isn't just whitespace
    .description('Original content to enhance'),
    
  context: Joi.object({
    role: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .description('Target role for optimization'),
      
    industry: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .description('Industry sector for keyword optimization'),
      
    experienceLevel: Joi.string()
      .valid('entry', 'mid', 'senior', 'executive')
      .description('Experience level for appropriate tone and content'),
      
    keywords: Joi.array()
      .items(Joi.string().trim())
      .max(20)
      .description('Specific keywords to include if possible')
  })
  .optional(),
    
  parameters: Joi.object({
    temperature: Joi.number()
      .min(0)
      .max(1)
      .default(0.7)
      .description('AI creativity level (0 = conservative, 1 = creative)'),
      
    style: Joi.string()
      .valid('professional', 'technical', 'executive')
      .default('professional')
      .description('Writing style for the enhanced content'),
      
    preserveKeywords: Joi.boolean()
      .default(true)
      .description('Maintain important technical terms and keywords'),
      
    enhanceATS: Joi.boolean()
      .default(true)
      .description('Optimize for ATS systems'),
      
    focusAreas: Joi.array()
      .items(
        Joi.string().valid(
          'keywords',
          'achievements',
          'metrics',
          'skills',
          'action_verbs'
        )
      )
      .default(['keywords', 'achievements'])
      .description('Areas to focus on during enhancement')
  })
  .default(() => ({
    temperature: 0.7,
    style: 'professional',
    preserveKeywords: true,
    enhanceATS: true,
    focusAreas: ['keywords', 'achievements']
  }))
}).required();