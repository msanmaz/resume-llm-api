import Redis from 'ioredis';
import logger from '../../utils/logger/index.js';
import { config } from '../../config/environment.js';

/**
 * Service for Redis operations
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Connect to Redis server
   */
  async connect() {
    if (this.isConnected) {
      return this.client;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        logger.info('Connecting to Redis server', { 
          url: config.redis.url.replace(/\/\/(.+?)@/, '//***@') // Mask credentials in logs
        });
        
        // Configure ioredis client
        this.client = new Redis(config.redis.url, {
          retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            logger.info(`Redis reconnecting in ${delay}ms`, { times });
            return delay;
          },
          // Enable TLS if the URL uses rediss://
          tls: config.redis.url.startsWith('rediss://') ? {} : undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true
        });

        this.client.on('error', (err) => {
          logger.error('Redis client error', { error: err.message });
          this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
          logger.info('Redis client reconnecting');
        });

        this.client.on('ready', () => {
          logger.info('Redis client ready');
          this.isConnected = true;
        });

        await this.client.connect?.(); // Only call connect if it exists (older ioredis doesn't need this)
        this.isConnected = true;
        logger.info('Connected to Redis successfully');
        resolve(this.client);
      } catch (error) {
        logger.error('Failed to connect to Redis', { 
          error: error.message,
          stack: error.stack
        });
        this.isConnected = false;
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Add a chunk to job's chunks array
   * @param {string} jobId - The job ID
   * @param {Object} chunk - The chunk data
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async addJobChunk(jobId, chunk) {
    console.log("DEBUG: addJobChunk called with:", {
      jobId,
      chunkType: typeof chunk,
      chunk: chunk
    });
    
    try {
      const client = await this.connect();
      
      // Check if job exists first
      const jobExists = await client.exists(`job:${jobId}`);
      if (!jobExists) {
        console.log("WARN: Job does not exist for adding chunk:", jobId);
        console.log("DEBUG: Creating job for chunk");
        
        await this.setJob(jobId, {
          status: 'processing',
          createdAt: new Date().toISOString(),
          chunks: [chunk]
        });
        return true;
      }
      
      const currentChunksStr = await client.hget(`job:${jobId}`, 'chunks');
      console.log("DEBUG: Current chunks string:", {
        jobId,
        chunksStr: currentChunksStr ? `${currentChunksStr.substring(0, 50)}...` : 'null'
      });
      
      let chunks = [];
      
      if (currentChunksStr) {
        try {
          chunks = JSON.parse(currentChunksStr);
          console.log("DEBUG: Parsed existing chunks:", {
            count: chunks.length,
            firstChunk: chunks.length > 0 ? chunks[0] : 'none'
          });
        } catch (e) {
          console.log("ERROR: Failed to parse chunks from Redis:", {
            error: e.message,
            chunksStr: currentChunksStr.substring(0, 100)
          });
        }
      }
      
      chunks.push(chunk);
      
      if (chunk.content === undefined) {
        console.log("WARN: Chunk missing content property:", chunk);
      }
      
      // Store updated chunks
      await client.hset(`job:${jobId}`, 'chunks', JSON.stringify(chunks));
      
      console.log("DEBUG: Added chunk to job:", {
        jobId,
        chunkIndex: chunk.index,
        chunkContentLength: chunk.content ? chunk.content.length : 'undefined',
        totalChunks: chunks.length
      });
      
      return true;
    } catch (error) {
      console.log("ERROR: Failed to add chunk to job:", {
        error: error.message,
        stack: error.stack,
        jobId
      });
      throw error;
    }
  }

  /**
   * Store a job in Redis
   * @param {string} jobId - The job ID
   * @param {Object} data - The job data
   * @param {number} expireInSeconds - Time in seconds until expiration
   */
  async setJob(jobId, data, expireInSeconds = 24 * 60 * 60) {
    console.log("DEBUG: setJob called with:", {
      jobId,
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : 'undefined',
      expireInSeconds
    });
  
    try {
      const client = await this.connect();
      
      const jobExists = await client.exists(`job:${jobId}`);
      if (jobExists) {
        console.log("DEBUG: Job already exists, updating instead:", jobId);
        return await this.updateJob(jobId, data);
      }
      
      for (const [key, value] of Object.entries(data || {})) {
        console.log("DEBUG: Setting job field:", {
          jobId,
          key,
          valueType: typeof value,
          value: value === null ? 'null' : 
                typeof value === 'object' ? 'object' : value
        });
        
        // Skip undefined values
        if (value === undefined) {
          console.log("DEBUG: Skipping undefined value for key:", key);
          continue;
        }
        
        // Serialize objects/arrays to JSON strings
        if (value !== null && typeof value === 'object') {
          await client.hset(`job:${jobId}`, key, JSON.stringify(value));
        } else {
          await client.hset(`job:${jobId}`, key, String(value));
        }
      }
      
      await client.expire(`job:${jobId}`, expireInSeconds);
      
      console.log("DEBUG: Job stored in Redis successfully:", jobId);
      return true;
    } catch (error) {
      console.log("ERROR: Failed to store job in Redis:", {
        error: error.message,
        stack: error.stack,
        jobId
      });
      throw error;
    }
  }

  async getJobChunks(jobId) {
    try {
      const client = await this.connect();
      
      const chunksStr = await client.hget(`job:${jobId}`, 'chunks');
      if (!chunksStr) return [];
      
      try {
        return JSON.parse(chunksStr);
      } catch (e) {
        logger.error('Failed to parse chunks from Redis', { 
          jobId, error: e.message 
        });
        return [];
      }
    } catch (error) {
      logger.error('Failed to get job chunks', { error: error.message, jobId });
      throw error;
    }
  }

  /**
   * Get a job from Redis
   * @param {string} jobId - The job ID
   * @returns {Object|null} - The job data or null if not found
   */
  async getJob(jobId) {
    try {
      const client = await this.connect();
      
      const jobExists = await client.exists(`job:${jobId}`);
      if (!jobExists) {
        return null;
      }
      
      const job = await client.hgetall(`job:${jobId}`);
      
      // Parse JSON strings back to objects
      for (const key in job) {
        try {
          if (typeof job[key] === 'string' && 
              (job[key].startsWith('{') || job[key].startsWith('['))) {
            job[key] = JSON.parse(job[key]);
          }
        } catch (e) {
          // If parsing fails, leave as is
          logger.debug('Failed to parse JSON from Redis', { key, value: job[key] });
        }
      }
      
      return job;
    } catch (error) {
      logger.error('Failed to get job from Redis', { error: error.message, jobId });
      throw error;
    }
  }

  /**
   * Update a job in Redis
   * @param {string} jobId - The job ID
   * @param {Object} updates - The fields to update
   * @returns {boolean} - Whether the update was successful
   */
  async updateJob(jobId, updates) {
    console.log("DEBUG: updateJob called with:", {
      jobId,
      updatesType: typeof updates,
      updatesKeys: updates ? Object.keys(updates) : 'undefined',
      updates: updates
    });
    
    try {
      const client = await this.connect();
      
      const jobExists = await client.exists(`job:${jobId}`);
      console.log("DEBUG: Job exists check:", {
        jobId,
        exists: jobExists === 1
      });
      
      if (!jobExists) {
        console.log("WARN: Attempted to update non-existent job:", jobId);
        return false;
      }
      
      for (const [key, value] of Object.entries(updates || {})) {
        console.log("DEBUG: Updating job field:", {
          jobId,
          key,
          valueType: typeof value,
          value: value === null ? 'null' : 
                typeof value === 'object' ? 'object' : value
        });
        
        if (value === undefined) {
          console.log("DEBUG: Skipping undefined value for key:", key);
          continue;
        }
        
        // Serialize objects/arrays to JSON strings
        if (value !== null && typeof value === 'object') {
          await client.hset(`job:${jobId}`, key, JSON.stringify(value));
        } else {
          await client.hset(`job:${jobId}`, key, String(value));
        }
      }
      
      console.log("DEBUG: Job updated successfully:", jobId);
      return true;
    } catch (error) {
      console.log("ERROR: Failed to update job in Redis:", {
        error: error.message,
        stack: error.stack,
        jobId
      });
      throw error;
    }
  }

  /**
   * Check if a job exists in Redis
   * @param {string} jobId - The job ID
   * @returns {boolean} - Whether the job exists
   */
  async jobExists(jobId) {
    try {
      const client = await this.connect();
      return await client.exists(`job:${jobId}`) === 1;
    } catch (error) {
      logger.error('Failed to check if job exists in Redis', { error: error.message, jobId });
      throw error;
    }
  }

  /**
   * Delete a job from Redis
   * @param {string} jobId - The job ID
   * @returns {boolean} - Whether the deletion was successful
   */
  async deleteJob(jobId) {
    try {
      const client = await this.connect();
      const result = await client.del(`job:${jobId}`);
      logger.debug('Job deleted from Redis', { jobId, result });
      return result === 1;
    } catch (error) {
      logger.error('Failed to delete job from Redis', { error: error.message, jobId });
      throw error;
    }
  }

  /**
   * Close the Redis connection
   */
  async close() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        this.connectionPromise = null;
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', { error: error.message });
        throw error;
      }
    }
  }
}

// Create a singleton instance
const redisService = new RedisService();

export default redisService;