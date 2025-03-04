// Save this as test-redis.js
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Simple helper to mask sensitive parts of URL for logging
const safeRedisUrl = (url) => {
  if (!url) return 'undefined';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username ? '***' : ''}${parsed.password ? ':***@' : ''}${parsed.host}`;
  } catch (e) {
    return 'invalid-url-format';
  }
};

const testRedisConnection = async () => {
  console.log('Redis Connection Test - Starting');
  console.log('==========================================');
  
  // Get Redis URL from environment
  const redisUrl = process.env.REDIS_URL;
  console.log(`Redis URL (safe): ${safeRedisUrl(redisUrl)}`);
  
  if (!redisUrl) {
    console.error('ERROR: REDIS_URL environment variable is not set');
    process.exit(1);
  }
  
  let client;
  
  try {
    console.log('Creating Redis client...');
    client = new Redis(redisUrl, {
      connectTimeout: 10000,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        console.log(`Reconnect strategy called, attempt ${times}, delay ${delay}ms`);
        return delay;
      },
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    });
    
    console.log('Client created. Setting up event handlers...');
    
    client.on('connect', () => {
      console.log('EVENT: Connect - TCP connection established');
    });
    
    client.on('ready', () => {
      console.log('EVENT: Ready - Redis connection ready to use');
    });
    
    client.on('error', (err) => {
      console.error(`EVENT: Error - ${err.message}`);
    });
    
    client.on('close', () => {
      console.log('EVENT: Close - Connection closed');
    });
    
    client.on('reconnecting', () => {
      console.log('EVENT: Reconnecting - Attempting to reconnect');
    });
    
    console.log('Testing connection with PING...');
    const pingResult = await client.ping();
    console.log(`PING result: ${pingResult}`);
    
    // Test basic operations
    console.log('Testing SET operation...');
    await client.set('test-key', 'test-value');
    console.log('SET operation successful');
    
    console.log('Testing GET operation...');
    const value = await client.get('test-key');
    console.log(`GET result: ${value}`);
    
    console.log('Testing DEL operation...');
    await client.del('test-key');
    console.log('DEL operation successful');
    
    console.log('==========================================');
    console.log('Redis connection test completed successfully!');
    
  } catch (error) {
    console.error('Redis connection test failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    if (client) {
      console.log('Closing Redis connection...');
      await client.quit();
      console.log('Redis connection closed');
    }
    process.exit(0);
  }
};

testRedisConnection().catch(err => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});