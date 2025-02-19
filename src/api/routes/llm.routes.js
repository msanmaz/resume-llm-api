// src/api/routes/llm.routes.js
import express from 'express';
import { generateContent } from '../controllers/llm.controller.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { generateContentSchema } from '../validators/llm.validator.js';

const router = express.Router();

router.post('/generate', validateRequest(generateContentSchema), generateContent);

export default router;