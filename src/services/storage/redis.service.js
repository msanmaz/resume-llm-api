import Redis from 'ioredis';
import logger from '../../utils/logger/index.js';
import { config } from '../../config/environment.js';

const safeRedisUrl = (url) => {
  if (!url) return 'undefined';
  try {
    // Parse the URL to mask the password but show other parts
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username ? '***' : ''}${parsed.password ? ':***@' : ''}${parsed.host}`;
  } catch (e) {
    return 'invalid-url-format';
  }
};



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
  console.log(`REDIS DEBUG: connect() called, isConnected=${this.isConnected}, has connectionPromise=${!!this.connectionPromise}`);
  
  if (this.isConnected) {
    console.log('REDIS DEBUG: Already connected, returning existing client');
    return this.client;
  }

  if (this.connectionPromise) {
    console.log('REDIS DEBUG: Connection in progress, returning promise');
    return this.connectionPromise;
  }

  this.connectionPromise = new Promise(async (resolve, reject) => {
    try {
      // Log whether we're using the environment URL or default
      const redisUrlSource = config.redis.url === process.env.REDIS_URL 
        ? 'environment' 
        : 'default fallback';
      
      console.log(`REDIS DEBUG: Redis URL source: ${redisUrlSource}`);
      console.log(`REDIS DEBUG: Redis URL: ${safeRedisUrl(config.redis.url)}`);
      
      logger.info('Connecting to Redis server', { 
        url: safeRedisUrl(config.redis.url)
      });
      
      // Check if URL is valid before creating client
      if (!config.redis.url) {
        throw new Error('Redis URL is undefined or empty');
      }
      
      // Explicitly log client creation attempt
      console.log('REDIS DEBUG: Creating Redis client...');
      
      // Create client with specific TLS settings based on URL
      const usesTLS = config.redis.url.startsWith('rediss://');
      console.log(`REDIS DEBUG: TLS enabled: ${usesTLS}`);
      
      // Add debugging for reconnection strategy
      const reconnectStrategy = (times) => {
        const delay = Math.min(times * 100, 3000);
        console.log(`REDIS DEBUG: Reconnect strategy called, attempt ${times}, delay ${delay}ms`);
        return delay;
      };
      
      // Configure detailed client options
      const clientOptions = {
        retryStrategy: reconnectStrategy,
        tls: usesTLS ? {} : undefined,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        // Add connection timeout of 10 seconds
        connectTimeout: 10000,
        // If your Redis requires auth but it's not in the URL
        // password: process.env.REDIS_PASSWORD, // Uncomment if needed
      };
      
      console.log(`REDIS DEBUG: Client options: ${JSON.stringify({
        ...clientOptions,
        tls: usesTLS ? 'enabled' : 'disabled'
      })}`);
      
      // Create the Redis client
      this.client = new Redis(config.redis.url, clientOptions);
      console.log('REDIS DEBUG: Client created successfully');
      
      // Set up detailed event handlers for all states
      this.client.on('connect', () => {
        console.log('REDIS DEBUG: EVENT - Initial connection established (not ready yet)');
      });
      
      this.client.on('error', (err) => {
        console.log(`REDIS DEBUG: EVENT - Error: ${err.message}`);
        console.log(`REDIS DEBUG: Error stack: ${err.stack}`);
        logger.error('Redis client error', { 
          error: err.message,
          stack: err.stack
        });
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('REDIS DEBUG: EVENT - Reconnecting...');
        logger.info('Redis client reconnecting');
      });

      this.client.on('ready', () => {
        console.log('REDIS DEBUG: EVENT - Client ready, connection fully established');
        logger.info('Redis client ready');
        this.isConnected = true;
      });
      
      this.client.on('end', () => {
        console.log('REDIS DEBUG: EVENT - Connection ended');
        this.isConnected = false;
      });
      
      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          const timeoutError = new Error('Redis connection timeout after 10 seconds');
          console.log(`REDIS DEBUG: ${timeoutError.message}`);
          this.client.disconnect();
          reject(timeoutError);
        }
      }, 10000);
      
      // Only call connect() for newer ioredis versions that require it
      // For older versions, the connection is established automatically
      try {
        console.log('REDIS DEBUG: Attempting explicit connect()...');
        if (typeof this.client.connect === 'function') {
          await this.client.connect();
          console.log('REDIS DEBUG: Explicit connect() succeeded');
        } else {
          console.log('REDIS DEBUG: No explicit connect() method, waiting for ready event');
          // For older versions, wait for ready event
          await new Promise((readyResolve) => {
            const readyHandler = () => {
              this.client.removeListener('error', errorHandler);
              readyResolve();
            };
            
            const errorHandler = (err) => {
              this.client.removeListener('ready', readyHandler);
              reject(err);
            };
            
            this.client.once('ready', readyHandler);
            this.client.once('error', errorHandler);
          });
        }
        clearTimeout(connectionTimeout);
      } catch (connectError) {
        clearTimeout(connectionTimeout);
        console.log(`REDIS DEBUG: Connect error: ${connectError.message}`);
        console.log(`REDIS DEBUG: Connect error stack: ${connectError.stack}`);
        throw connectError;
      }
      
      // Test connection with a simple ping
      try {
        console.log('REDIS DEBUG: Testing connection with PING...');
        const pingResult = await this.client.ping();
        console.log(`REDIS DEBUG: PING result: ${pingResult}`);
      } catch (pingError) {
        console.log(`REDIS DEBUG: PING failed: ${pingError.message}`);
        throw pingError;
      }
      
      this.isConnected = true;
      console.log('REDIS DEBUG: Connection fully established and verified');
      logger.info('Connected to Redis successfully');
      resolve(this.client);
    } catch (error) {
      console.log(`REDIS DEBUG: Connection failed: ${error.message}`);
      console.log(`REDIS DEBUG: Error stack: ${error.stack}`);
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