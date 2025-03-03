import { ensurePrismaConnection } from '../services/db/ensure-prisma.js';
import prismaService from '../services/db/prisma.service.js';
import { ResultConsumerService } from '../services/queue/result-consumer.service.js';
import redisService from '../services/storage/redis.service.js';
import logger from '../utils/logger/index.js';

const shutdown = async (resultConsumerService, signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  try {
    await resultConsumerService.stop();
    await redisService.close();
    await prismaService.disconnect();
    logger.info('Result consumer stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

const startResultConsumer = async () => {
  const resultConsumerService = new ResultConsumerService();
  
  try {
    logger.info('Starting result consumer service');
    
    await redisService.connect();
    logger.info('Redis connected successfully');
    
    const prismaConnected = await ensurePrismaConnection();
    if (!prismaConnected) {
      logger.warn('Prisma connection failed, but will continue without database persistence');
    }
    
    await resultConsumerService.start();
    
    process.on('SIGINT', () => shutdown(resultConsumerService, 'SIGINT'));
    process.on('SIGTERM', () => shutdown(resultConsumerService, 'SIGTERM'));
    
    logger.info('Result consumer service started');
  } catch (error) {
    logger.error('Failed to start result consumer service', { error: error.message });
    process.exit(1);
  }
};

// Run the result consumer
startResultConsumer().catch(error => {
  logger.error('Uncaught error in result consumer', { error: error.message });
  process.exit(1);
});