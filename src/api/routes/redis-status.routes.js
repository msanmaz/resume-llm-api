import express from 'express';
import { getRedisStatus } from '../controllers/redis-status.controller';

const router = express.Router();

router.get('/redis-status', getRedisStatus);

export default router;