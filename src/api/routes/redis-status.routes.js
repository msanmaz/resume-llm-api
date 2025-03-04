import express from 'express';
import { getRedisStatus } from '../controllers/redis-status.controller.js';

const router = express.Router();

router.get('/', getRedisStatus);

export default router;