import { QueueService } from './queue.service.js';
import { LLMService } from '../llm/llm.service.js';
import logger from '../../utils/logger/index.js';
import { config } from '../../config/environment.js';
import redisService from '../storage/redis.service.js';

/**
 * Service to consume and process messages from the RabbitMQ queue
 */
export class ConsumerService {
  constructor() {
    this.queueService = new QueueService();
    this.llmService = new LLMService();
    this.isRunning = false;
  }

  /**
   * Process an enhancement request
   * @param {string} section Section of resume
   * @param {string} content Original content
   * @param {Object} context Context data
   * @param {Object} parameters Enhancement parameters
   * @returns {Promise<Object>} Enhanced content
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Consumer is already running');
      return;
    }
  
    try {
      logger.info('Starting consumer service with connection to RabbitMQ...');
      await this.queueService.connect();
      
      logger.info('Consumer service configuration', {
        requestQueue: config.rabbitmq.queues.llmRequests,
        resultQueue: config.rabbitmq.queues.llmResults,
        prefetch: config.rabbitmq.prefetch
      });
      
      logger.info('Setting up consumer for enhancement requests queue');
      await this.queueService.consumeEnhancementRequests(
        this.processEnhancementRequest.bind(this)
      );
      
      this.isRunning = true;
      logger.info('Consumer started successfully and is listening for messages');
    } catch (error) {
      logger.error('Failed to start consumer service', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }
  

  async processEnhancementRequest(section, content, context, parameters) {
    logger.debug("Processing enhancement request:", {
      section,
      contentLength: content?.length,
      contextKeys: context ? Object.keys(context) : 'undefined',
    });
    
    const correlationId = context?.correlationId;
    if (!correlationId) {
      logger.error("Missing correlation ID in context:", context);
      throw new Error("Missing correlation ID in context");
    }
    
    try {
      await redisService.updateJob(correlationId, {
        status: 'processing',
        progress: 0,
        processingStartedAt: new Date().toISOString()
      });
      
      // Ensure content is a string
      const safeContent = content || '';
      
      const result = await this.llmService.enhance(
        section, 
        safeContent, 
        context, 
        parameters
      );
      
      await redisService.updateJob(correlationId, {
        status: 'completed',
        progress: 100,
        result: result,
        completedAt: new Date().toISOString()
      });
      
      await this.queueService.publishEnhancementResult(correlationId, result);
      
      logger.info('Enhancement completed and published to results queue', {
        correlationId,
        section,
        originalLength: safeContent.length,
        enhancedLength: result?.enhanced?.length
      });
      
      return result;
    } catch (error) {
      logger.error("Enhancement request failed:", {
        message: error.message,
        correlationId
      });
      
      try {
        await redisService.updateJob(correlationId, {
          status: 'failed',
          error: error.message,
          failedAt: new Date().toISOString()
        });
        
        await this.queueService.publishEnhancementError(correlationId, error.message);
        
        logger.info('Enhancement error published to results queue', {
          correlationId,
          error: error.message
        });
      } catch (redisError) {
        logger.error("Failed to update job status:", {
          error: redisError.message,
          correlationId
        });
      }
      
      throw error;
    }
  }
  /**
   * Stop the consumer
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('Consumer is not running');
      return;
    }

    try {
      await this.queueService.close();
      this.isRunning = false;
      logger.info('Consumer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop consumer', { error: error.message });
      throw error;
    }
  }
}

export default ConsumerService;