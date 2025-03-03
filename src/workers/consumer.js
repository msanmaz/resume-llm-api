import { ConsumerService } from '../services/queue/consumer.service.js';
import logger from '../utils/logger/index.js';
import redisService from '../services/storage/redis.service.js';
import { ensurePrismaConnection } from '../services/db/ensure-prisma.js';
import prismaService from '../services/db/prisma.service.js';

const shutdown = async (consumerService, signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  try {
    await consumerService.stop();
    await redisService.close();
    await prismaService.disconnect();
    logger.info('Consumer stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1)
  }
};

const startConsumer = async () => {
  const consumerService = new ConsumerService();
  
  try {
    logger.info('Starting consumer service');
    
    await redisService.connect();
    logger.info('Redis connected successfully');

    const prismaConnected = await ensurePrismaConnection();
    if (!prismaConnected) {
      logger.warn('Prisma connection failed, but will continue without database persistence');
    }
    
    await consumerService.start();
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', () => shutdown(consumerService, 'SIGINT'));
    process.on('SIGTERM', () => shutdown(consumerService, 'SIGTERM'));
    
    logger.info('Consumer service started');
  } catch (error) {
    logger.error('Failed to start consumer service', { error: error.message });
    process.exit(1);
  }
};





// Run the consumer
startConsumer().catch(error => {
  logger.error('Uncaught error in consumer', { error: error.message });
  process.exit(1);
});