const http = require('http');
const { env, validateEnv } = require('./src/config/env');
const { connectDB, disconnectDB } = require('./src/config/db');
const { createRedisClient, connectRedis, disconnectRedis } = require('./src/config/redis');
const { initializeSocket } = require('./src/sockets');
const socketService = require('./src/services/socket.service');
const app = require('./src/app');

// --- Validate environment at startup ---
validateEnv();

// --- Create HTTP server ---
const server = http.createServer(app);

// --- Initialize Socket.IO ---
const io = initializeSocket(server);

// Wire socket service with the io instance
socketService.setIO(io);

// --- Start server ---
async function start() {
  try {
    // Connect to MongoDB (required — exits on failure)
    await connectDB();

    // Connect to Redis (non-blocking — app works without it in single instance)
    createRedisClient();
    const redisClient = await connectRedis();

    // Attach Redis adapter to Socket.IO if Redis connected
    if (redisClient) {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const subClient = redisClient.duplicate();
      await subClient.connect();
      io.adapter(createAdapter(redisClient, subClient));
      console.log('[Socket.IO] Redis adapter attached');
    }

    // Start HTTP server
    server.listen(env.port, () => {
      console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
    });
  } catch (error) {
    console.error(`[Server] Failed to start: ${error.message}`);
    process.exit(1);
  }
}

// --- Graceful shutdown ---
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });

  // 2. Close Socket.IO
  if (io) {
    io.close();
    console.log('[Server] Socket.IO closed');
  }

  // 3. Disconnect Redis
  await disconnectRedis();

  // 4. Disconnect MongoDB
  await disconnectDB();

  console.log('[Server] Shutdown complete');
  process.exit(0);
}

// Handle termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled errors
process.on('unhandledRejection', (err) => {
  console.error(`[Server] Unhandled rejection: ${err.message}`);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error(`[Server] Uncaught exception: ${err.message}`);
  shutdown('uncaughtException');
});

start();

module.exports = { server, io };
