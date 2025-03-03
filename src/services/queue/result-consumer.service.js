import { QueueService } from './queue.service.js';
import logger from '../../utils/logger/index.js';
import { config } from '../../config/environment.js';
import redisService from '../storage/redis.service.js';
import prismaService from '../db/prisma.service.js';

/**
 * Service to consume and process results from the RabbitMQ results queue
 */
export class ResultConsumerService {
  constructor() {
    this.queueService = new QueueService();
    this.isRunning = false;
  }

  /**
   * Process a result message
   * @param {Object} resultMessage Result message from the queue
   */
  // In ResultConsumerService class, update processResultMessage method
  async processResultMessage(resultMessage) {
    const { correlationId, status, result, error } = resultMessage;

    logger.info('Processing result message', { correlationId, status });

    try {
      // Import processJobResult dynamically to avoid circular dependency
      const { processJobResult } = await import('../../api/controllers/llm.controller.js');

      const exists = await redisService.jobExists(correlationId);
      if (!exists) {
        logger.warn('Job not found in Redis before processing', { correlationId });
      }

      await processJobResult(correlationId, { status, result, error });

      if (status === 'success' && result) {
        try {
          // Calculate processing time
          const job = await redisService.getJob(correlationId);
          const startTime = new Date(job.processingStartedAt || job.createdAt).getTime();
          const endTime = new Date().getTime();
          const processingTimeMs = endTime - startTime;

          await prismaService.updateRequestStatus(
            correlationId,
            'completed',
            new Date(),
            processingTimeMs
          );

          const existingResult = await prismaService.prisma.enhancementResult.findFirst({
            where: {
              request: { correlationId }
            }
          });

          if (!existingResult && result.enhanced) {
            await prismaService.createEnhancementResult(
              correlationId,
              result.enhanced,
              result.metadata || {},
              result.metadata?.model || 'gpt-3.5-turbo',
              result.metadata?.tokensUsed || 0
            );
          }

          // Record API usage
          await prismaService.recordApiUsage(
            new Date(),
            null, // userId
            true, // success
            result.metadata?.tokensUsed || 0,
            processingTimeMs
          );

          logger.info('Database updated with job result', { correlationId });
        } catch (dbError) {
          logger.error('Failed to update database with job result', {
            correlationId,
            error: dbError.message,
            stack: dbError.stack
          });
        }
      } else if (status === 'error') {
        try {
          await prismaService.updateRequestStatus(
            correlationId,
            'failed',
            new Date()
          );

          // Record failed API usage
          await prismaService.recordApiUsage(
            new Date(),
            null, // userId
            false, // success
            0, // tokens used
            0 // processing time
          );

          logger.info('Database updated with job failure', { correlationId });
        } catch (dbError) {
          logger.error('Failed to update database with job failure', {
            correlationId,
            error: dbError.message,
            stack: dbError.stack
          });
        }
      }

      const updatedJob = await redisService.getJob(correlationId);
      logger.info('Job status after processing', {
        correlationId,
        newStatus: updatedJob?.status || 'not found',
        hasResult: !!updatedJob?.result
      });
    } catch (error) {
      logger.error('Error in processResultMessage', {
        correlationId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Start consuming from the results queue
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Result consumer is already running');
      return;
    }

    try {
      logger.info('Starting result consumer service...');

      await redisService.connect();
      logger.info('Redis connection initialized for result consumer');

      await this.queueService.connect();
      logger.info('RabbitMQ connection established for result consumer');

      await this.queueService.channel.consume(
        config.rabbitmq.queues.llmResults,
        async (msg) => {
          if (!msg) {
            logger.warn('Received null message from results queue');
            return;
          }

          try {
            logger.debug('Received message from results queue', {
              messageId: msg.properties.messageId,
              correlationId: msg.properties.correlationId
            });

            const resultMessage = JSON.parse(msg.content.toString());
            await this.processResultMessage(resultMessage);

            this.queueService.channel.ack(msg);
            logger.debug('Message acknowledged', {
              correlationId: resultMessage.correlationId
            });
          } catch (error) {
            logger.error('Error processing result message', {
              error: error.message,
              stack: error.stack
            });

            try {
              const content = msg.content.toString();
              logger.debug('Failed message content', {
                content: content.length > 200 ? `${content.substring(0, 200)}...` : content
              });
            } catch (e) {
              logger.error('Could not extract message content', { error: e.message });
            }

            this.queueService.channel.nack(msg, false, false);
            logger.info('Message negatively acknowledged (not requeued)');
          }
        },
        { noAck: false } // We'll handle acknowledgements manually
      );

      this.isRunning = true;
      logger.info('Result consumer started successfully');
    } catch (error) {
      logger.error('Failed to start result consumer', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Stop the result consumer
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('Result consumer is not running');
      return;
    }

    try {
      await this.queueService.close();

      await redisService.close();

      this.isRunning = false;
      logger.info('Result consumer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop result consumer', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default ResultConsumerService;