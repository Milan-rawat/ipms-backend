const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Task = require('../src/models/task.model');
const { connectTestDB, clearTestDB, disconnectTestDB } = require('./helpers/db');

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

// --- Helpers ---

async function createUser(data = {}) {
  const userData = {
    name: data.name || 'Test User',
    email: data.email || `user${Date.now()}${Math.random().toString(36).slice(2)}@test.com`,
    password: data.password || 'password123',
  };
  const res = await request(app).post('/api/auth/register').send(userData);
  return { user: res.body.data.user, token: res.body.data.token };
}

async function createProject(token, data = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: data.name || 'Test Project', description: data.description || '' });
  return res.body.data.project;
}

async function addMember(token, projectId, email) {
  await request(app)
    .post(`/api/projects/${projectId}/members`)
    .set('Authorization', `Bearer ${token}`)
    .send({ email });
}

async function createTask(token, projectId, data = {}) {
  return request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: data.title || 'Test Task',
      description: data.description || 'A test task',
      status: data.status,
      priority: data.priority,
      assignee: data.assignee,
    });
}

// ===========================================
// CREATE TASK
// ===========================================
describe('POST /api/projects/:projectId/tasks', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');
  });

  it('should create a valid task', async () => {
    const res = await createTask(admin.token, projectId, {
      title: 'Implement login',
      description: 'Create login page',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task).toHaveProperty('_id');
    expect(res.body.data.task.title).toBe('Implement login');
    expect(res.body.data.task.description).toBe('Create login page');
    expect(res.body.data.task.status).toBe('todo');
    expect(res.body.data.task.priority).toBe('medium');
  });

  it('should allow member to create task', async () => {
    const res = await createTask(member.token, projectId, { title: 'Member task' });

    expect(res.status).toBe(201);
    expect(res.body.data.task.title).toBe('Member task');
  });

  it('should reject non-member', async () => {
    const res = await createTask(outsider.token, projectId, { title: 'Nope' });

    expect(res.status).toBe(403);
  });

  it('should set createdBy from authenticated user', async () => {
    const res = await createTask(member.token, projectId, { title: 'My task' });

    expect(res.body.data.task.createdBy._id).toBe(member.user._id);
  });

  it('should not allow client to override createdBy', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ title: 'Test', createdBy: admin.user._id });

    expect(res.status).toBe(201);
    expect(res.body.data.task.createdBy._id).toBe(member.user._id);
  });

  it('should not allow client to override project', async () => {
    const otherProject = await createProject(admin.token, { name: 'Other' });
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Test', project: otherProject._id });

    expect(res.status).toBe(201);
    // Task should belong to the route projectId, not the submitted one
    const task = await Task.findById(res.body.data.task._id);
    expect(task.project.toString()).toBe(projectId);
  });

  it('should reject missing title', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ description: 'No title' });

    expect(res.status).toBe(400);
  });

  it('should reject title shorter than 2 chars', async () => {
    const res = await createTask(admin.token, projectId, { title: 'A' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid status', async () => {
    const res = await createTask(admin.token, projectId, {
      title: 'Task',
      status: 'invalid_status',
    });

    expect(res.status).toBe(400);
  });

  it('should reject invalid priority', async () => {
    const res = await createTask(admin.token, projectId, {
      title: 'Task',
      priority: 'urgent',
    });

    expect(res.status).toBe(400);
  });

  it('should reject invalid project ID', async () => {
    const res = await request(app)
      .post('/api/projects/invalid-id/tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Task' });

    expect(res.status).toBe(400);
  });

  it('should reject assignee who is not a project member', async () => {
    const res = await createTask(admin.token, projectId, {
      title: 'Task',
      assignee: outsider.user._id,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/[Aa]ssignee.*member/);
  });

  it('should accept valid assignee who is a project member', async () => {
    const res = await createTask(admin.token, projectId, {
      title: 'Assigned task',
      assignee: member.user._id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.task.assignee._id).toBe(member.user._id);
  });
});

// ===========================================
// LIST TASKS
// ===========================================
describe('GET /api/projects/:projectId/tasks', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');

    await createTask(admin.token, projectId, { title: 'Task 1' });
    await createTask(admin.token, projectId, { title: 'Task 2' });
  });

  it('should return tasks for project member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(2);
  });

  it('should reject non-member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it('should only return tasks from the specified project', async () => {
    const otherProject = await createProject(admin.token, { name: 'Other' });
    await createTask(admin.token, otherProject._id, { title: 'Other task' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.body.data.tasks).toHaveLength(2);
    res.body.data.tasks.forEach((task) => {
      expect(task.title).not.toBe('Other task');
    });
  });

  it('should return empty array for project with no tasks', async () => {
    const emptyProject = await createProject(admin.token, { name: 'Empty' });

    const res = await request(app)
      .get(`/api/projects/${emptyProject._id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toEqual([]);
  });

  it('should reject invalid project ID', async () => {
    const res = await request(app)
      .get('/api/projects/bad-id/tasks')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(400);
  });

  it('should return tasks in deterministic order', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`);

    // Newest first
    const dates = res.body.data.tasks.map((t) => new Date(t.createdAt).getTime());
    expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
  });
});

// ===========================================
// GET TASK
// ===========================================
describe('GET /api/projects/:projectId/tasks/:taskId', () => {
  let admin, member, outsider, projectId, taskId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');

    const res = await createTask(admin.token, projectId, { title: 'Detail Task' });
    taskId = res.body.data.task._id;
  });

  it('should return task for project member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe('Detail Task');
  });

  it('should reject non-member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for nonexistent task', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/${fakeId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });

  it('should reject invalid task ID', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/bad-id`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(400);
  });

  it('should reject cross-project task access', async () => {
    // Create another project and try to access this task through it
    const otherProject = await createProject(admin.token, { name: 'Other' });

    const res = await request(app)
      .get(`/api/projects/${otherProject._id}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });

  it('should reject invalid project ID', async () => {
    const res = await request(app)
      .get(`/api/projects/invalid/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(400);
  });
});

// ===========================================
// UPDATE TASK
// ===========================================
describe('PUT /api/projects/:projectId/tasks/:taskId', () => {
  let admin, member, outsider, projectId, taskId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');

    const res = await createTask(admin.token, projectId, { title: 'Original' });
    taskId = res.body.data.task._id;
  });

  it('should allow member to update title', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe('Updated Title');
  });

  it('should allow member to update status', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('in_progress');
  });

  it('should allow member to update priority', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.priority).toBe('high');
  });

  it('should reject invalid status', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid priority', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ priority: 'critical' });

    expect(res.status).toBe(400);
  });

  it('should reject assignee who is not a project member', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignee: outsider.user._id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/[Aa]ssignee.*member/);
  });

  it('should accept valid assignee', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignee: member.user._id });

    expect(res.status).toBe(200);
    expect(res.body.data.task.assignee._id).toBe(member.user._id);
  });

  it('should reject non-member', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('should not allow project to be changed', async () => {
    const otherProject = await createProject(admin.token, { name: 'Other' });
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Safe', project: otherProject._id });

    expect(res.status).toBe(200);
    const task = await Task.findById(taskId);
    expect(task.project.toString()).toBe(projectId);
  });

  it('should not allow createdBy to be changed', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ title: 'Safe', createdBy: member.user._id });

    expect(res.status).toBe(200);
    const task = await Task.findById(taskId);
    expect(task.createdBy.toString()).toBe(admin.user._id);
  });

  it('should reject cross-project task update', async () => {
    const otherProject = await createProject(admin.token, { name: 'Other' });

    const res = await request(app)
      .put(`/api/projects/${otherProject._id}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Cross project' });

    expect(res.status).toBe(404);
  });

  it('should reject invalid task ID', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/bad-id`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'X' });

    expect(res.status).toBe(400);
  });
});

// ===========================================
// DELETE TASK
// ===========================================
describe('DELETE /api/projects/:projectId/tasks/:taskId', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const project = await createProject(admin.token);
    projectId = project._id;
    await addMember(admin.token, projectId, 'member@test.com');
  });

  it('should allow admin to delete any task', async () => {
    const taskRes = await createTask(member.token, projectId, { title: 'Member task' });
    const taskId = taskRes.body.data.task._id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const check = await Task.findById(taskId);
    expect(check).toBeNull();
  });

  it('should allow task creator to delete their own task', async () => {
    const taskRes = await createTask(member.token, projectId, { title: 'My task' });
    const taskId = taskRes.body.data.task._id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
  });

  it('should reject member deleting another members task', async () => {
    const taskRes = await createTask(admin.token, projectId, { title: 'Admin task' });
    const taskId = taskRes.body.data.task._id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });

  it('should reject non-member', async () => {
    const taskRes = await createTask(admin.token, projectId, { title: 'Task' });
    const taskId = taskRes.body.data.task._id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for nonexistent task', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${fakeId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });

  it('should reject invalid task ID', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/bad-id`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(400);
  });

  it('should reject cross-project task deletion', async () => {
    const taskRes = await createTask(admin.token, projectId, { title: 'Task' });
    const taskId = taskRes.body.data.task._id;

    const otherProject = await createProject(admin.token, { name: 'Other' });

    const res = await request(app)
      .delete(`/api/projects/${otherProject._id}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });
});

// ===========================================
// PROJECT DELETION CASCADE
// ===========================================
describe('Project deletion cascade', () => {
  let admin, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    const project = await createProject(admin.token, { name: 'Cascade Project' });
    projectId = project._id;

    // Create multiple tasks
    await createTask(admin.token, projectId, { title: 'Task 1' });
    await createTask(admin.token, projectId, { title: 'Task 2' });
    await createTask(admin.token, projectId, { title: 'Task 3' });
  });

  it('should delete all project tasks when project is deleted', async () => {
    // Verify tasks exist
    const before = await Task.find({ project: projectId });
    expect(before).toHaveLength(3);

    // Delete project
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);

    // Verify tasks are deleted
    const after = await Task.find({ project: projectId });
    expect(after).toHaveLength(0);
  });

  it('should not affect tasks from other projects', async () => {
    const otherProject = await createProject(admin.token, { name: 'Other' });
    await createTask(admin.token, otherProject._id, { title: 'Other task' });

    // Delete first project
    await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    // Other project's tasks remain
    const remaining = await Task.find({ project: otherProject._id });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Other task');
  });
});
