// src/api/routes/index.js
import express from 'express';
import llmRoutes from './llm.routes.js';

const router = express.Router();

// Health check moved to API routes
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy'
  });
});

// LLM routes
router.use('/llm', llmRoutes);

export default router;