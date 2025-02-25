// src/services/llm/__tests__/llm.service.test.js
import { jest } from '@jest/globals';
import { LLMService } from '../llm.service.js';
import { AppError } from '../../../utils/errors/AppError.js';

// Create a completely fake OpenAI module to prevent any real API calls
jest.mock('openai', () => {
  return {
    default: jest.fn(() => {
      throw new Error('OpenAI constructor should not be called in tests');
    })
  };
});

// Mock the config to control API key for testing
jest.mock('../../../config/environment.js', () => ({
  config: {
    openai: {
      apiKey: 'test-key' // Default config
    }
  }
}));

// Import the real logger and then spy on its methods
import logger from '../../../utils/logger/index.js';
import { config } from '../../../config/environment.js';

describe('LLMService', () => {
  let mockOpenAIClient;
  let mockCompletionsCreate;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset API key before each test
    config.openai.apiKey = 'test-key';
    
    // Create a fresh mock for each test
    mockCompletionsCreate = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Enhanced content' } }]
    });
    
    // Create mock OpenAI client with the exact structure needed
    mockOpenAIClient = {
      chat: {
        completions: {
          create: mockCompletionsCreate
        }
      }
    };
    
    // Properly spy on logger methods
    jest.spyOn(logger, 'debug').mockImplementation(jest.fn());
    jest.spyOn(logger, 'info').mockImplementation(jest.fn());
    jest.spyOn(logger, 'error').mockImplementation(jest.fn());
    jest.spyOn(logger, 'warn').mockImplementation(jest.fn());
  });
  
  afterEach(() => {
    // Restore original logger methods
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should throw error if API key is not configured', () => {
      // Remove API key 
      config.openai.apiKey = undefined;
      
      // Check that constructor throws
      expect(() => new LLMService()).toThrow(AppError);
    });
    
    test('should use provided OpenAI client', () => {
      // Ensure API key is set
      config.openai.apiKey = 'test-key';
      
      // Instantiate service with mock client
      const service = new LLMService(mockOpenAIClient);
      
      // Verify service is created correctly
      expect(service).toBeInstanceOf(LLMService);
      expect(service.openai).toBe(mockOpenAIClient);
    });
  });
  
  describe('enhance method', () => {
    test('should process content with defaults', async () => {
      // Set up service with mock client and spies
      const service = new LLMService(mockOpenAIClient);
      const buildPromptSpy = jest.spyOn(service, 'buildPrompt');
      const getSystemPromptSpy = jest.spyOn(service, 'getSystemPrompt');
      
      // Call enhance method
      const result = await service.enhance('work', 'Original content');
      
      // Verify internal methods were called
      expect(buildPromptSpy).toHaveBeenCalled();
      expect(getSystemPromptSpy).toHaveBeenCalled();
      expect(mockCompletionsCreate).toHaveBeenCalled();
      
      // Verify the result structure
      expect(result).toHaveProperty('original', 'Original content');
      expect(result).toHaveProperty('enhanced', 'Enhanced content');
      expect(result).toHaveProperty('metadata');
      
      // Verify logger was called
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
    
    test('should handle empty OpenAI response', async () => {
      // Setup service with mock client
      const service = new LLMService(mockOpenAIClient);
      
      // Mock empty response for this test only
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [] // Empty choices array
      });
      
      // Verify it throws the expected error
      await expect(
        service.enhance('work', 'Original content')
      ).rejects.toThrow('No content generated from OpenAI');
      
      expect(mockCompletionsCreate).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
    
    test('should handle API response errors', async () => {
      // Setup service with mock client
      const service = new LLMService(mockOpenAIClient);
      
      // Mock API error for this test
      const apiError = new Error('API error');
      apiError.response = {
        status: 429,
        data: { error: { message: 'Rate limit exceeded' } }
      };
      mockCompletionsCreate.mockRejectedValueOnce(apiError);
      
      // Verify it throws the expected error
      await expect(
        service.enhance('work', 'Original content')
      ).rejects.toThrow('OpenAI API error');
      
      expect(mockCompletionsCreate).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
    
    test('should handle network errors', async () => {
      // Setup service with mock client
      const service = new LLMService(mockOpenAIClient);
      
      // Mock network error for this test
      const networkError = new Error('Network error');
      networkError.request = {}; // This indicates a request was made but no response was received
      mockCompletionsCreate.mockRejectedValueOnce(networkError);
      
      // Verify it throws the expected error
      await expect(
        service.enhance('work', 'Original content')
      ).rejects.toThrow('No response from OpenAI API');
      
      expect(mockCompletionsCreate).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
    
    test('should handle generic errors', async () => {
      // Setup service with mock client
      const service = new LLMService(mockOpenAIClient);
      
      // Mock generic error for this test
      mockCompletionsCreate.mockRejectedValueOnce(new Error('Generic error'));
      
      // Verify it throws the expected error
      await expect(
        service.enhance('work', 'Original content')
      ).rejects.toThrow('Failed to generate content');
      
      expect(mockCompletionsCreate).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('prompt building', () => {
    test('should build work experience prompt correctly', () => {
      const service = new LLMService(mockOpenAIClient);
      
      // We need to bind the method to the service instance
      const workPrompt = service.buildWorkExperiencePrompt.bind(service)(
        'Original content',
        { 
          role: 'Developer', 
          industry: 'Tech',
          keywords: ['JavaScript', 'React'] 
        },
        {}
      );
      
      expect(workPrompt).toContain('Original content');
      expect(workPrompt).toContain('Target Role: Developer');
      expect(workPrompt).toContain('Industry: Tech');
      expect(workPrompt).toContain('JavaScript, React');
    });
    
    test('should select correct prompt builder based on section', () => {
      const service = new LLMService(mockOpenAIClient);
      
      // Spy on the individual prompt builders
      const workSpy = jest.spyOn(service, 'buildWorkExperiencePrompt');
      const summarySpy = jest.spyOn(service, 'buildSummaryPrompt');
      const educationSpy = jest.spyOn(service, 'buildEducationPrompt');
      const achievementsSpy = jest.spyOn(service, 'buildAchievementsPrompt');
      const defaultSpy = jest.spyOn(service, 'buildDefaultPrompt');
      
      // Bind all methods - this is required since the methods reference 'this'
      service.buildWorkExperiencePrompt = service.buildWorkExperiencePrompt.bind(service);
      service.buildSummaryPrompt = service.buildSummaryPrompt.bind(service);
      service.buildEducationPrompt = service.buildEducationPrompt.bind(service);
      service.buildAchievementsPrompt = service.buildAchievementsPrompt.bind(service);
      service.buildDefaultPrompt = service.buildDefaultPrompt.bind(service);
      
      // Call buildPrompt with different sections
      service.buildPrompt('work', 'content', {}, {});
      service.buildPrompt('summary', 'content', {}, {});
      service.buildPrompt('education', 'content', {}, {});
      service.buildPrompt('achievements', 'content', {}, {});
      service.buildPrompt('unknown', 'content', {}, {});
      
      // Verify the correct prompt builder was called each time
      expect(workSpy).toHaveBeenCalled();
      expect(summarySpy).toHaveBeenCalled();
      expect(educationSpy).toHaveBeenCalled();
      expect(achievementsSpy).toHaveBeenCalled();
      expect(defaultSpy).toHaveBeenCalled();
    });
    
    test('education prompt includes required fields', () => {
      const service = new LLMService(mockOpenAIClient);
      
      const prompt = service.buildEducationPrompt.bind(service)(
        'Original content',
        {},
        {}
      );
      
      expect(prompt).toContain('Original Content');
      expect(prompt).toContain('Enhancement Requirements');
      expect(prompt).toContain('relevant coursework');
    });
    
    test('achievements prompt includes required fields', () => {
      const service = new LLMService(mockOpenAIClient);
      
      const prompt = service.buildAchievementsPrompt.bind(service)(
        'Original content', 
        {},
        {}
      );
      
      expect(prompt).toContain('Original Content');
      expect(prompt).toContain('action verbs');
      expect(prompt).toContain('metrics');
    });
  });
  
  describe('system prompt generation', () => {
    test('should generate system prompt with default parameters', () => {
      const service = new LLMService(mockOpenAIClient);
      const prompt = service.getSystemPrompt();
      
      expect(prompt).toContain('professional');
      expect(prompt).toContain('Preserving important technical terms and keywords');
      expect(prompt).toContain('Preserve and enhance');
    });
    
    test('should respect custom parameters', () => {
      const service = new LLMService(mockOpenAIClient);
      const prompt = service.getSystemPrompt({
        style: 'technical',
        preserveKeywords: false,
        focusAreas: ['metrics']
      });
      
      expect(prompt).toContain('technical');
      expect(prompt).toContain('Optimizing keyword usage');
      expect(prompt).toContain('Optimize and standardize');
      expect(prompt).toContain('Quantified with specific metrics');
      expect(prompt).not.toContain('Achievement-oriented');
    });
  });
});