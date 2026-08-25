const Redis = require('ioredis');
const { env } = require('./env');

let redisClient = null;
let redisAvailable = false;

/**
 * Create and connect Redis client.
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
        // Stop retrying — server works without Redis in single-instance mode
        return null;
      }
      return Math.min(times * 500, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    redisAvailable = true;
    console.log('[Redis] Connected');
  });

  redisClient.on('error', (err) => {
    // Only log meaningful errors (not empty messages from connection refusal)
    if (err.message && !redisAvailable) return; // Suppress repetitive connection refused during startup
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
 * Connect Redis client.
 * Non-blocking — the app can start without Redis (single instance still works).
 * @returns {Redis|null} Connected client or null
 */
async function connectRedis() {
  if (!redisClient) return null;

  try {
    await redisClient.connect();
    return redisClient;
  } catch {
    console.warn('[Redis] Not available — real-time events limited to single instance');
    // Disconnect cleanly to stop retry attempts
    try {
      redisClient.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup
    }
    redisClient = null;
    return null;
  }
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
