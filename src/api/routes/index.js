import express from 'express';
import healthRoutes from './health.routes.js';
import llmRoutes from './llm.routes.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';


const router = express.Router();

// API Version prefix
const API_VERSION = 'v1';

// Base routes configuration
const routes = [
  {
    path: '/health',
    route: healthRoutes
  },
  {
    path: '/llm',
    route: llmRoutes,
    middleware: [apiKeyAuth]
  }
  // Future routes can be added here
  // {
  //   path: '/auth',
  //   route: authRoutes
  // },
  // {
  //   path: '/users',
  //   route: userRoutes
  // }
];

// Register all routes
routes.forEach((route) => {
  if (route.middleware) {
    router.use(`/${API_VERSION}${route.path}`, ...route.middleware, route.route);
  } else {
    router.use(`/${API_VERSION}${route.path}`, route.route);
  }
});

export default router;