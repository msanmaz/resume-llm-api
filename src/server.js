import { application as app } from './app.js';
import { config } from './config/environment.js';
import logger from './utils/logger/index.js';
import { ConsumerService } from './services/queue/consumer.service.js';
import { ResultConsumerService } from './services/queue/result-consumer.service.js';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prismaService from './services/db/prisma.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err);
  process.exit(1);
});

logger.debug('Starting server with config:', config.server);

const server = app.listen(config.server.port, () => {
  logger.info(`Server running in ${config.server.nodeEnv} mode on port ${config.server.port}`);
});


if (config.server.nodeEnv === 'development') {
  const startWorkers = async () => {
    try {
      const consumerService = new ConsumerService();
      await consumerService.start();
      logger.info('Consumer service started successfully');
      
      const resultConsumerService = new ResultConsumerService();
      await resultConsumerService.start();
      logger.info('Result consumer service started successfully');
      
      const gracefulShutdown = async (signal) => {
        logger.info(`Received ${signal}. Shutting down workers gracefully...`);
        
        try {
          await consumerService.stop();
          await resultConsumerService.stop();
          await prismaService.disconnect();
          logger.info('Workers stopped successfully');
        } catch (error) {
          logger.error('Error during worker shutdown', { error: error.message });
        }
      };
      
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      
    } catch (error) {
      logger.error('Failed to start workers', { error: error.message });
    }
  };
  
  startWorkers().catch(error => {
    logger.error('Uncaught error while starting workers', { error: error.message });
  });
}

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err);
  server.close(() => {
    process.exit(1);
  });
});