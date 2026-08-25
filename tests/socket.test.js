const http = require('http');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { initializeSocket } = require('../src/sockets');
const socketService = require('../src/services/socket.service');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

let httpServer, io, port;

beforeAll(async () => {
  await connectTestDB();

  // Create HTTP server with Socket.IO for testing
  httpServer = http.createServer(app);
  io = initializeSocket(httpServer);
  socketService.setIO(io);

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      port = httpServer.address().port;
      resolve();
    });
  });
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  socketService.setIO(null);
  io.close();
  httpServer.close();
  await disconnectTestDB();
});

// --- Helpers ---

function connectSocket(token) {
  return Client(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
}

function waitForEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForConnect(socket, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connect timeout')), timeout);
    socket.on('connect', () => { clearTimeout(timer); resolve(); });
    socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
}

async function createUser(data = {}) {
  const userData = {
    name: data.name || 'Test User',
    email: data.email || `user${Date.now()}${Math.random().toString(36).slice(2)}@test.com`,
    password: data.password || 'password123',
  };
  const res = await request(app).post('/api/auth/register').send(userData);
  return { user: res.body.data.user, token: res.body.data.token };
}

async function createProject(token, name = 'Test Project') {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  return res.body.data.project;
}

async function addMember(token, projectId, email) {
  await request(app)
    .post(`/api/projects/${projectId}/members`)
    .set('Authorization', `Bearer ${token}`)
    .send({ email });
}

// ===========================================
// SOCKET AUTHENTICATION
// ===========================================
describe('Socket.IO Authentication', () => {
  it('should connect with valid JWT', async () => {
    const { token } = await createUser({ email: 'auth1@test.com' });
    const socket = connectSocket(token);

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('should reject connection without token', async () => {
    const socket = connectSocket(undefined);

    await expect(waitForConnect(socket)).rejects.toThrow();
    socket.disconnect();
  });

  it('should reject connection with invalid token', async () => {
    const socket = connectSocket('invalid.token.here');

    await expect(waitForConnect(socket)).rejects.toThrow();
    socket.disconnect();
  });

  it('should reject connection with expired token', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { userId: 'someid', email: 'test@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' },
    );
    const socket = connectSocket(expiredToken);

    await expect(waitForConnect(socket)).rejects.toThrow();
    socket.disconnect();
  });
});

// ===========================================
// PROJECT ROOM JOIN/LEAVE
// ===========================================
describe('Socket.IO Project Rooms', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');
  });

  it('should allow authenticated member to join project room', async () => {
    const socket = connectSocket(member.token);
    await waitForConnect(socket);

    const result = await new Promise((resolve) => {
      socket.emit('project:join', { projectId }, resolve);
    });

    expect(result.success).toBe(true);
    socket.disconnect();
  });

  it('should reject non-member from joining project room', async () => {
    const socket = connectSocket(outsider.token);
    await waitForConnect(socket);

    const result = await new Promise((resolve) => {
      socket.emit('project:join', { projectId }, resolve);
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/[Nn]ot a project member/);
    socket.disconnect();
  });

  it('should reject invalid project ID', async () => {
    const socket = connectSocket(admin.token);
    await waitForConnect(socket);

    const result = await new Promise((resolve) => {
      socket.emit('project:join', { projectId: 'bad-id' }, resolve);
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/[Ii]nvalid/);
    socket.disconnect();
  });

  it('should reject nonexistent project', async () => {
    const socket = connectSocket(admin.token);
    await waitForConnect(socket);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const result = await new Promise((resolve) => {
      socket.emit('project:join', { projectId: fakeId }, resolve);
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/[Nn]ot found/);
    socket.disconnect();
  });

  it('should allow member to leave project room', async () => {
    const socket = connectSocket(member.token);
    await waitForConnect(socket);

    await new Promise((resolve) => {
      socket.emit('project:join', { projectId }, resolve);
    });

    const result = await new Promise((resolve) => {
      socket.emit('project:leave', { projectId }, resolve);
    });

    expect(result.success).toBe(true);
    socket.disconnect();
  });
});

// ===========================================
// TASK EVENTS
// ===========================================
describe('Socket.IO Task Events', () => {
  let admin, member, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');
  });

  describe('task:created', () => {
    it('should emit to project room when task is created', async () => {
      // Member B joins the project room
      const socketB = connectSocket(member.token);
      await waitForConnect(socketB);
      await new Promise((resolve) => {
        socketB.emit('project:join', { projectId }, resolve);
      });

      // Listen for event
      const eventPromise = waitForEvent(socketB, 'task:created');

      // Admin creates a task via REST
      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ title: 'New Task' });

      // Member B should receive the event
      const data = await eventPromise;
      expect(data.task).toHaveProperty('_id');
      expect(data.task.title).toBe('New Task');

      socketB.disconnect();
    });
  });

  describe('task:updated', () => {
    it('should emit to project room when task is updated', async () => {
      // Create a task first
      const taskRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ title: 'Original' });
      const taskId = taskRes.body.data.task._id;

      // Member B joins
      const socketB = connectSocket(member.token);
      await waitForConnect(socketB);
      await new Promise((resolve) => {
        socketB.emit('project:join', { projectId }, resolve);
      });

      // Listen for event
      const eventPromise = waitForEvent(socketB, 'task:updated');

      // Admin updates task via REST
      await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'in_progress' });

      // Member B receives update
      const data = await eventPromise;
      expect(data.task._id).toBe(taskId);
      expect(data.task.status).toBe('in_progress');

      socketB.disconnect();
    });
  });

  describe('task:deleted', () => {
    it('should emit to project room when task is deleted', async () => {
      // Create a task
      const taskRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ title: 'To Delete' });
      const taskId = taskRes.body.data.task._id;

      // Member B joins
      const socketB = connectSocket(member.token);
      await waitForConnect(socketB);
      await new Promise((resolve) => {
        socketB.emit('project:join', { projectId }, resolve);
      });

      // Listen for event
      const eventPromise = waitForEvent(socketB, 'task:deleted');

      // Admin deletes task
      await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${admin.token}`);

      // Member B receives deletion
      const data = await eventPromise;
      expect(data.taskId).toBe(taskId);
      expect(data.projectId).toBe(projectId);

      socketB.disconnect();
    });
  });
});

// ===========================================
// CROSS-PROJECT EVENT ISOLATION
// ===========================================
describe('Socket.IO Cross-Project Isolation', () => {
  it('should not send events to users in different project rooms', async () => {
    const userA = await createUser({ email: 'usera@test.com' });
    const userB = await createUser({ email: 'userb@test.com' });

    // Create two separate projects
    const projectA = await createProject(userA.token, 'Project A');
    const projectB = await createProject(userB.token, 'Project B');

    // User A joins Project A room
    const socketA = connectSocket(userA.token);
    await waitForConnect(socketA);
    await new Promise((resolve) => {
      socketA.emit('project:join', { projectId: projectA._id }, resolve);
    });

    // User B joins Project B room
    const socketB = connectSocket(userB.token);
    await waitForConnect(socketB);
    await new Promise((resolve) => {
      socketB.emit('project:join', { projectId: projectB._id }, resolve);
    });

    // Track events received by User B
    let receivedByB = false;
    socketB.on('task:created', () => { receivedByB = true; });

    // User A creates a task in Project A
    await request(app)
      .post(`/api/projects/${projectA._id}/tasks`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ title: 'Project A Task' });

    // Wait briefly for any potential event propagation
    await new Promise((resolve) => setTimeout(resolve, 200));

    // User B should NOT have received the event
    expect(receivedByB).toBe(false);

    socketA.disconnect();
    socketB.disconnect();
  });
});

// ===========================================
// RECONNECTION BEHAVIOR
// ===========================================
describe('Socket.IO Reconnection', () => {
  it('should re-authenticate and allow room rejoin after reconnect', async () => {
    const { token } = await createUser({ email: 'reconnect@test.com' });
    const project = await createProject(token, 'Reconnect Project');

    // First connection
    const socket = connectSocket(token);
    await waitForConnect(socket);

    const joinResult = await new Promise((resolve) => {
      socket.emit('project:join', { projectId: project._id }, resolve);
    });
    expect(joinResult.success).toBe(true);

    // Disconnect
    socket.disconnect();

    // Reconnect (new socket simulates reconnection)
    const socket2 = connectSocket(token);
    await waitForConnect(socket2);

    // Re-join room (server re-checks authorization)
    const rejoinResult = await new Promise((resolve) => {
      socket2.emit('project:join', { projectId: project._id }, resolve);
    });
    expect(rejoinResult.success).toBe(true);

    socket2.disconnect();
  });
});
