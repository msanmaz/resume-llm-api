// src/api/controllers/redis-status.controller.js
import redisService from '../../services/storage/redis.service.js';

export const getRedisStatus = async (req, res) => {
    try {
        await redisService.connect();
        const pingResult = await redisService.client.ping();
        res.json({
            status: 'success',
            ping: pingResult,
            connected: redisService.isConnected,
            clientInfo: {
                status: redisService.client.status,
                options: {
                    host: redisService.client.options.host,
                    port: redisService.client.options.port,
                    tls: !!redisService.client.options.tls,
                    maxRetriesPerRequest: redisService.client.options.maxRetriesPerRequest
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
};