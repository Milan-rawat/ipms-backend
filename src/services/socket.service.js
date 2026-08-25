/**
 * Socket event publisher service.
 * Provides a clean abstraction for emitting real-time events
 * from the service layer after successful persistence.
 *
 * The io instance is set via setIO() during server startup.
 */

let io = null;

/**
 * Set the Socket.IO server instance.
 * Called once during server initialization.
 * @param {import('socket.io').Server} ioInstance
 */
function setIO(ioInstance) {
  io = ioInstance;
}

/**
 * Get the Socket.IO server instance.
 * @returns {import('socket.io').Server|null}
 */
function getIO() {
  return io;
}

/**
 * Emit task:created event to all members in the project room.
 * @param {string} projectId
 * @param {Object} task - Populated task object
 */
function emitTaskCreated(projectId, task) {
  if (!io) return;
  io.to(`project:${projectId}`).emit('task:created', { task });
}

/**
 * Emit task:updated event to all members in the project room.
 * @param {string} projectId
 * @param {Object} task - Populated updated task object
 */
function emitTaskUpdated(projectId, task) {
  if (!io) return;
  io.to(`project:${projectId}`).emit('task:updated', { task });
}

/**
 * Emit task:deleted event to all members in the project room.
 * @param {string} projectId
 * @param {string} taskId
 */
function emitTaskDeleted(projectId, taskId) {
  if (!io) return;
  io.to(`project:${projectId}`).emit('task:deleted', { taskId, projectId });
}

/**
 * Emit member:added event to all members in the project room.
 * @param {string} projectId
 * @param {Object} user - { _id, name, email }
 */
function emitMemberAdded(projectId, user) {
  if (!io) return;
  io.to(`project:${projectId}`).emit('member:added', { user });
}

/**
 * Emit member:removed event to the project room, then
 * forcefully remove the user's sockets from the room.
 * @param {string} projectId
 * @param {string} userId
 */
async function emitMemberRemoved(projectId, userId) {
  if (!io) return;

  const room = `project:${projectId}`;

  // Notify all current room members
  io.to(room).emit('member:removed', { userId, projectId });

  // Find and remove the removed user's sockets from the room
  try {
    const sockets = await io.in(room).fetchSockets();
    for (const socket of sockets) {
      if (socket.user && socket.user.id === userId) {
        socket.leave(room);
      }
    }
  } catch (error) {
    console.error(`[Socket.IO] Error removing user sockets from room: ${error.message}`);
  }
}

module.exports = {
  setIO,
  getIO,
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskDeleted,
  emitMemberAdded,
  emitMemberRemoved,
};
