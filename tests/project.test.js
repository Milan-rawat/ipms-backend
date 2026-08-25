const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/project.model');
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
    email: data.email || `user${Date.now()}@test.com`,
    password: data.password || 'password123',
  };
  const res = await request(app).post('/api/auth/register').send(userData);
  return { user: res.body.data.user, token: res.body.data.token };
}

async function createProjectAs(token, data = {}) {
  return request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: data.name || 'Test Project',
      description: data.description || 'A test project',
    });
}

// ===========================================
// CREATE PROJECT
// ===========================================
describe('POST /api/projects', () => {
  let admin;

  beforeEach(async () => {
    admin = await createUser({ name: 'Admin', email: 'admin@test.com' });
  });

  it('should create a project and return it', async () => {
    const res = await createProjectAs(admin.token, {
      name: 'My Project',
      description: 'Description here',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project).toHaveProperty('_id');
    expect(res.body.data.project.name).toBe('My Project');
    expect(res.body.data.project.description).toBe('Description here');
  });

  it('should set authenticated user as owner', async () => {
    const res = await createProjectAs(admin.token);

    expect(res.body.data.project.owner._id).toBe(admin.user._id);
  });

  it('should add owner as admin member', async () => {
    const res = await createProjectAs(admin.token);
    const members = res.body.data.project.members;

    expect(members).toHaveLength(1);
    expect(members[0].user._id).toBe(admin.user._id);
    expect(members[0].role).toBe('admin');
  });

  it('should reject missing name', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ description: 'No name' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject name shorter than 2 characters', async () => {
    const res = await createProjectAs(admin.token, { name: 'A' });

    expect(res.status).toBe(400);
  });

  it('should reject name longer than 100 characters', async () => {
    const res = await createProjectAs(admin.token, { name: 'X'.repeat(101) });

    expect(res.status).toBe(400);
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Project' });

    expect(res.status).toBe(401);
  });

  it('should not allow client to set arbitrary owner', async () => {
    const other = await createUser({ email: 'other@test.com' });
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Project', owner: other.user._id });

    // Owner should be admin, not the submitted value
    expect(res.status).toBe(201);
    expect(res.body.data.project.owner._id).toBe(admin.user._id);
  });
});

// ===========================================
// LIST PROJECTS
// ===========================================
describe('GET /api/projects', () => {
  let user1, user2;

  beforeEach(async () => {
    user1 = await createUser({ email: 'user1@test.com' });
    user2 = await createUser({ email: 'user2@test.com' });
  });

  it('should return projects where user is a member', async () => {
    await createProjectAs(user1.token, { name: 'Project A' });
    await createProjectAs(user1.token, { name: 'Project B' });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${user1.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(2);
  });

  it('should not return projects of other users', async () => {
    await createProjectAs(user1.token, { name: 'User1 Project' });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(0);
  });

  it('should return empty array when user has no projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${user1.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toEqual([]);
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(401);
  });
});

// ===========================================
// GET PROJECT
// ===========================================
describe('GET /api/projects/:id', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const res = await createProjectAs(admin.token, { name: 'Shared Project' });
    projectId = res.body.data.project._id;

    // Add member
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });
  });

  it('should return project for a member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.project.name).toBe('Shared Project');
  });

  it('should return project for admin', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
  });

  it('should reject non-member with 403', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for nonexistent project', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/projects/${fakeId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });

  it('should reject invalid ObjectId', async () => {
    const res = await request(app)
      .get('/api/projects/invalid-id')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(400);
  });
});

// ===========================================
// UPDATE PROJECT
// ===========================================
describe('PUT /api/projects/:id', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const res = await createProjectAs(admin.token, { name: 'Original' });
    projectId = res.body.data.project._id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });
  });

  it('should allow admin to update name', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.project.name).toBe('Updated Name');
  });

  it('should allow admin to update description', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ description: 'New description' });

    expect(res.status).toBe(200);
    expect(res.body.data.project.description).toBe('New description');
  });

  it('should reject member update with 403', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('should reject non-member update with 403', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('should not allow owner to be changed via update', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Safe', owner: member.user._id });

    expect(res.status).toBe(200);
    expect(res.body.data.project.owner._id).toBe(admin.user._id);
  });

  it('should not allow members to be changed via update', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Safe', members: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.project.members.length).toBeGreaterThan(0);
  });
});

// ===========================================
// DELETE PROJECT
// ===========================================
describe('DELETE /api/projects/:id', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const res = await createProjectAs(admin.token, { name: 'To Delete' });
    projectId = res.body.data.project._id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });
  });

  it('should allow admin to delete project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify project is gone
    const check = await Project.findById(projectId);
    expect(check).toBeNull();
  });

  it('should reject member delete with 403', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });

  it('should reject non-member delete with 403', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for nonexistent project', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/projects/${fakeId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });
});

// ===========================================
// ADD MEMBER
// ===========================================
describe('POST /api/projects/:id/members', () => {
  let admin, member, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    // Create outsider so they exist in DB (referenced by email in tests)
    await createUser({ email: 'outsider@test.com' });

    const res = await createProjectAs(admin.token, { name: 'Team Project' });
    projectId = res.body.data.project._id;
  });

  it('should allow admin to add an existing user', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.project.members).toHaveLength(2);
  });

  it('should add user with member role (not admin)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });

    const addedMember = res.body.data.project.members.find(
      (m) => m.user.email === 'member@test.com',
    );
    expect(addedMember.role).toBe('member');
  });

  it('should return 404 for nonexistent email', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(404);
  });

  it('should return 409 for duplicate member', async () => {
    // Add member first
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });

    // Try adding again
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });

    expect(res.status).toBe(409);
  });

  it('should reject non-admin adding member with 403', async () => {
    // Add member first
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });

    // Member tries to add outsider
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ email: 'outsider@test.com' });

    expect(res.status).toBe(403);
  });

  it('should reject invalid email format', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('should reject missing email', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ===========================================
// REMOVE MEMBER
// ===========================================
describe('DELETE /api/projects/:id/members/:userId', () => {
  let admin, member, outsider, projectId;

  beforeEach(async () => {
    admin = await createUser({ email: 'admin@test.com' });
    member = await createUser({ email: 'member@test.com' });
    outsider = await createUser({ email: 'outsider@test.com' });

    const res = await createProjectAs(admin.token, { name: 'Team Project' });
    projectId = res.body.data.project._id;

    // Add member
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'member@test.com' });
  });

  it('should allow admin to remove a member', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${member.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.project.members).toHaveLength(1);
    expect(res.body.data.project.members[0].user._id).toBe(admin.user._id);
  });

  it('should not allow removing the project owner', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${admin.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/[Oo]wner/);
  });

  it('should reject non-admin removing member with 403', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${member.user._id}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-member userId', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${outsider.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });

  it('should reject non-member of project with 403', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${member.user._id}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });
});
