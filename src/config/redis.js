const Redis = require('ioredis');
const { env } = require('./env');

let redisClient = null;

/**
 * Create and connect Redis client.
 * Used exclusively as Socket.IO pub/sub adapter.
 */
function createRedisClient() {
  if (env.isTest) {
    // Skip Redis in test environment
    console.log('[Redis] Skipped in test environment');
    return null;
  }

  redisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        console.error('[Redis] Max retries reached. Giving up.');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected');
  });

  redisClient.on('error', (err) => {
    console.error(`[Redis] Error: ${err.message}`);
  });

  return redisClient;
}

/**
 * Connect Redis client.
 * Non-blocking — the app can start without Redis (single instance still works).
 */
async function connectRedis() {
  if (!redisClient) return null;

  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error(`[Redis] Connection failed: ${error.message}`);
    console.warn('[Redis] Continuing without Redis — real-time events limited to single instance');
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
  } catch (error) {
    console.error(`[Redis] Disconnect error: ${error.message}`);
  }
}

function getRedisClient() {
  return redisClient;
}

module.exports = { createRedisClient, connectRedis, disconnectRedis, getRedisClient };
