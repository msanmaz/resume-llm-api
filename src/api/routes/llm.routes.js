// src/api/routes/llm.routes.js
import express from 'express';
import { generateContent, getJobStatus } from '../controllers/llm.controller.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { generateContentSchema } from '../validators/llm.validator.js';

const router = express.Router();

router.post('/generate', validateRequest(generateContentSchema), generateContent);
router.get('/status/:jobId', getJobStatus);

export default router;