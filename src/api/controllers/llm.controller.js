// src/api/controllers/llm.controller.js
import { LLMService } from '../../services/llm/llm.service.js';
import { AppError } from '../../utils/errors/AppError.js';
import logger from '../../utils/logger/index.js';

export const generateContent = async (req, res, next) => {
  try {
    const { section, content, context, parameters } = req.body;
    
    logger.info('Content generation requested', { section });
    
    const llmService = new LLMService();
    const enhancedContent = await llmService.enhance(section, content, context, parameters);
    
    res.status(200).json({
      status: 'success',
      data: {
        original: content,
        enhanced: enhancedContent
      }
    });
  } catch (error) {
    logger.error('Content generation failed', { error: error.message });
    next(new AppError(500, 'Failed to generate content'));
  }
};