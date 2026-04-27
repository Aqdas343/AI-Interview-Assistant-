 const request = require('supertest');
 const app = require('../src/app');
 const db = require('../src/db');

// Provide tests with a uniquely generated username so they don't collide with existing DB state
 const mockUser = {
   username: `testuser_${Date.now()}`,
   email: `test${Date.now()}@test.com`,
   password: 'password123'
 };

 describe('Authentication API Endpoints', () => {
   beforeAll(async () => {
     await db.initDb();
     db.resetDb();
   });

   describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new valid user returning 201', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(mockUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('userId');
    });

    it('should fail with 400 when validation rules are broken (short password)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'short', email: 'valid@email.com', password: '123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0].msg).toBe('Password must be at least 6 characters long');
    });

    it('should fail with 409 if email is already taken', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(mockUser); // sending the exact same user again

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', 'Email already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should retrieve a valid JWT token when hitting login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: mockUser.password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('should fail with 401 when given an incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
  });

  describe('GET /api/v1/protected', () => {
    let token;

    beforeAll(async () => {
      // Setup: fetch valid token
      const res = await request(app).post('/api/v1/auth/login').send({ email: mockUser.email, password: mockUser.password });
      token = res.body.token;
    });

    it('should successfully access route with valid Bearer token', async () => {
      const response = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'You have accessed a protected route!');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject access with 401 if no token provided', async () => {
      const response = await request(app).get('/api/v1/protected');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Access denied. No token provided.');
    });
  });
});
