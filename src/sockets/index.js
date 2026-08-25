/**
 * Socket.IO initialization and configuration.
 * Business logic (rooms, events) will be added in Phase 2E.
 */

/**
 * Initialize Socket.IO on the HTTP server.
 * Sets up CORS, adapter, and connection handling.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initializeSocket(httpServer) {
  const { Server } = require('socket.io');
  const { env } = require('../config/env');

  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrl,
      methods: ['GET', 'POST'],
    },
  });

  // Redis adapter will be attached here in Phase 2E
  // Socket auth middleware will be added in Phase 2E
  // Event handlers will be registered in Phase 2E

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('[Socket.IO] Initialized');
  return io;
}

module.exports = { initializeSocket };
