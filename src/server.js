// src/server.js
import { application as app } from './app.js';
import { config } from './config/environment.js';
import logger from './utils/logger/index.js';

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err);
  process.exit(1);
});

// Log the config values before using them
logger.debug('Starting server with config:', config.server);

const server = app.listen(config.server.port, () => {
  logger.info(`Server running in ${config.server.nodeEnv} mode on port ${config.server.port}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err);
  server.close(() => {
    process.exit(1);
  });
});