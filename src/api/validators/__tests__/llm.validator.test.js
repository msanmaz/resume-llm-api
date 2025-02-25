// Create a new file: src/api/validators/__tests__/llm.validator.test.js
import { generateContentSchema } from '../llm.validator.js';

describe('LLM Validator', () => {
  test('should validate a valid request', () => {
    const validRequest = {
      section: 'work',
      content: 'I worked on fixing API stuff at Google',
      context: {
        role: 'Software Engineer',
        industry: 'Technology',
        experienceLevel: 'mid'
      },
      parameters: {
        temperature: 0.7,
        style: 'professional'
      }
    };
    
    const { error } = generateContentSchema.validate(validRequest);
    expect(error).toBeUndefined();
  });
  
  test('should reject invalid section', () => {
    const invalidRequest = {
      section: 'invalid-section',
      content: 'I worked on fixing API stuff at Google'
    };
    
    const { error } = generateContentSchema.validate(invalidRequest);
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('section');
  });
  
  test('should require content', () => {
    const invalidRequest = {
      section: 'work'
    };
    
    const { error } = generateContentSchema.validate(invalidRequest);
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('content');
  });
});