const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/user.model');
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

// --- Helper ---
const validUser = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'password123',
};

async function registerUser(data = validUser) {
  return request(app).post('/api/auth/register').send(data);
}

async function loginUser(data = { email: validUser.email, password: validUser.password }) {
  return request(app).post('/api/auth/login').send(data);
}

// ===========================================
// REGISTRATION TESTS
// ===========================================
describe('POST /api/auth/register', () => {
  it('should register a valid user and return token', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user).toHaveProperty('name', validUser.name);
    expect(res.body.data.user).toHaveProperty('email', validUser.email);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
  });

  it('should hash the password (not store plaintext)', async () => {
    await registerUser();
    const user = await User.findOne({ email: validUser.email }).select('+password');

    expect(user.password).not.toBe(validUser.password);
    expect(user.password).toMatch(/^\$2[aby]?\$/); // bcrypt hash pattern
  });

  it('should never return password in response', async () => {
    const res = await registerUser();

    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('should normalize email to lowercase', async () => {
    const res = await registerUser({
      ...validUser,
      email: 'JOHN@EXAMPLE.COM',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('john@example.com');
  });

  it('should reject missing name', async () => {
    const res = await registerUser({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/[Vv]alidation/);
  });

  it('should reject name shorter than 2 characters', async () => {
    const res = await registerUser({ ...validUser, name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject name longer than 50 characters', async () => {
    const res = await registerUser({ ...validUser, name: 'A'.repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid email', async () => {
    const res = await registerUser({ ...validUser, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing email', async () => {
    const res = await registerUser({ name: validUser.name, password: validUser.password });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing password', async () => {
    const res = await registerUser({ name: validUser.name, email: validUser.email });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject password shorter than 6 characters', async () => {
    const res = await registerUser({ ...validUser, password: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject duplicate email', async () => {
    await registerUser();
    const res = await registerUser();

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/[Ee]mail already registered/);
  });
});

// ===========================================
// LOGIN TESTS
// ===========================================
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('should login with valid credentials and return token', async () => {
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user).toHaveProperty('name', validUser.name);
    expect(res.body.data.user).toHaveProperty('email', validUser.email);
    expect(res.body.data).toHaveProperty('token');
  });

  it('should return JWT with expected minimal claims', async () => {
    const res = await loginUser();
    const decoded = jwt.decode(res.body.data.token);

    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('email', validUser.email);
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
    // Should NOT contain password or other sensitive data
    expect(decoded).not.toHaveProperty('password');
    expect(decoded).not.toHaveProperty('name');
  });

  it('should never return password hash in login response', async () => {
    const res = await loginUser();

    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('should reject wrong password with generic message', async () => {
    const res = await loginUser({ email: validUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should reject nonexistent email with same generic message', async () => {
    const res = await loginUser({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should reject missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid email format', async () => {
    const res = await loginUser({ email: 'not-valid', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================
// GET /api/auth/me TESTS
// ===========================================
describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await registerUser();
    token = res.body.data.token;
  });

  it('should return current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user).toHaveProperty('name', validUser.name);
    expect(res.body.data.user).toHaveProperty('email', validUser.email);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'NotBearer token123');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/[Ii]nvalid token/);
  });

  it('should reject expired token', async () => {
    // Create a token that expired 1 hour ago
    const expiredToken = jwt.sign(
      { userId: 'someid', email: 'test@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' },
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/[Tt]oken expired/);
  });

  it('should not return password field', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.user).not.toHaveProperty('password');
  });
});

// ===========================================
// LOGOUT TESTS
// ===========================================
describe('POST /api/auth/logout', () => {
  let token;

  beforeEach(async () => {
    const res = await registerUser();
    token = res.body.data.token;
  });

  it('should return success for authenticated logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject unauthenticated logout', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should NOT invalidate the token server-side (architecture decision)', async () => {
    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    // Token should still work (no server-side revocation)
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
