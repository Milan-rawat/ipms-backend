const Redis = require('ioredis');
const { env } = require('./env');

let redisClient = null;
let redisAvailable = false;

/**
 * Create Redis client.
 * Used as the pub client for Socket.IO Redis adapter.
 */
function createRedisClient() {
  if (env.isTest) {
    console.log('[Redis] Skipped in test environment');
    return null;
  }

  redisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 500, 2000);
    },
  });

  redisClient.on('ready', () => {
    redisAvailable = true;
    console.log('[Redis] Connected');
  });

  redisClient.on('error', (err) => {
    if (!redisAvailable && err.message) {
      // Suppress repetitive errors during initial connection failure
      return;
    }
    if (err.message) {
      console.error(`[Redis] Error: ${err.message}`);
    }
  });

  redisClient.on('close', () => {
    redisAvailable = false;
  });

  return redisClient;
}

/**
 * Wait for Redis to be ready.
 * Non-blocking — app starts without Redis if connection fails.
 * @returns {Redis|null} Connected client or null
 */
async function connectRedis() {
  if (!redisClient) return null;

  // Wait up to 5 seconds for the connection
  return new Promise((resolve) => {
    if (redisClient.status === 'ready') {
      resolve(redisClient);
      return;
    }

    const timeout = setTimeout(() => {
      if (!redisAvailable) {
        console.warn('[Redis] Not available — real-time events limited to single instance');
        resolve(null);
      }
    }, 5000);

    redisClient.once('ready', () => {
      clearTimeout(timeout);
      resolve(redisClient);
    });

    redisClient.once('error', () => {
      clearTimeout(timeout);
      console.warn('[Redis] Not available — real-time events limited to single instance');
      resolve(null);
    });
  });
}

/**
 * Disconnect Redis gracefully.
 */
async function disconnectRedis() {
  if (!redisClient) return;

  try {
    await redisClient.quit();
    console.log('[Redis] Disconnected');
  } catch {
    // Ignore errors during shutdown
  }
}

/**
 * Get the Redis client instance.
 * @returns {Redis|null}
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Check if Redis is currently available.
 * @returns {boolean}
 */
function isRedisAvailable() {
  return redisAvailable;
}

module.exports = { createRedisClient, connectRedis, disconnectRedis, getRedisClient, isRedisAvailable };
