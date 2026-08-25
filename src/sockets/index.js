const { Server } = require('socket.io');
const { env } = require('../config/env');
const { verifyToken } = require('../utils/jwt');
const Project = require('../models/project.model');

/**
 * Initialize Socket.IO on the HTTP server.
 * Configures CORS, authentication middleware, and event handlers.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrl,
      methods: ['GET', 'POST'],
    },
  });

  // --- Authentication Middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('No token provided'));
    }

    try {
      const decoded = verifyToken(token);
      socket.user = { id: decoded.userId, email: decoded.email };
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      return next(new Error('Invalid token'));
    }
  });

  // --- Connection Handler ---
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id} (user: ${socket.user.email})`);

    // --- Project Join ---
    socket.on('project:join', async (data, callback) => {
      try {
        const { projectId } = data || {};

        if (!projectId || !projectId.match(/^[0-9a-fA-F]{24}$/)) {
          return ack(callback, false, 'Invalid project ID');
        }

        const project = await Project.findById(projectId);

        if (!project) {
          return ack(callback, false, 'Project not found');
        }

        if (!project.isMember(socket.user.id)) {
          return ack(callback, false, 'Not a project member');
        }

        const room = `project:${projectId}`;
        socket.join(room);
        ack(callback, true);
      } catch (error) {
        console.error(`[Socket.IO] project:join error: ${error.message}`);
        ack(callback, false, 'Server error');
      }
    });

    // --- Project Leave ---
    socket.on('project:leave', (data, callback) => {
      try {
        const { projectId } = data || {};

        if (!projectId || !projectId.match(/^[0-9a-fA-F]{24}$/)) {
          return ack(callback, false, 'Invalid project ID');
        }

        const room = `project:${projectId}`;
        socket.leave(room);
        ack(callback, true);
      } catch (error) {
        console.error(`[Socket.IO] project:leave error: ${error.message}`);
        ack(callback, false, 'Server error');
      }
    });

    // --- Disconnect ---
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('[Socket.IO] Initialized');
  return io;
}

/**
 * Send acknowledgement to client if callback provided.
 */
function ack(callback, success, message) {
  if (typeof callback === 'function') {
    callback({ success, ...(message && { message }) });
  }
}

module.exports = { initializeSocket };
