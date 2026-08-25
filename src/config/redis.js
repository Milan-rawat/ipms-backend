const Redis = require('ioredis');
const { env } = require('./env');

let redisClient = null;

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
      if (times > 5) {
        console.error('[Redis] Max retries reached. Giving up.');
        return null;
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
 * @returns {Redis|null} Connected client or null
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

/**
 * Get the Redis client instance.
 * @returns {Redis|null}
 */
function getRedisClient() {
  return redisClient;
}

module.exports = { createRedisClient, connectRedis, disconnectRedis, getRedisClient };
