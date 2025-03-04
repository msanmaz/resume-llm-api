// src/api/controllers/health.controller.js
import redisService from '../../services/storage/redis.service.js';

export const getRedisStatus = async (req, res) => {
    try {
        await redisService.connect();
        const pingResult = await redisService.client.ping();
        res.json({
            status: 'success',
            ping: pingResult,
            connected: redisService.isConnected
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
};