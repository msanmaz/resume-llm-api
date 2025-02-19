// src/api/controllers/health.controller.js
import { config } from '../../config/environment.js';

export const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    data: {
      environment: config.server.nodeEnv,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        openai: Boolean(config.openai.apiKey)
      }
    }
  });
};