// src/api/routes/health.routes.js
import express from 'express';
import { getHealthStatus } from '../controllers/health.controller.js';

const router = express.Router();

router.get('/', getHealthStatus);

export default router;