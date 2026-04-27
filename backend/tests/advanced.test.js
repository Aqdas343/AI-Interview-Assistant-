const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
jest.mock('../src/services/aiService');

describe('Advanced FYP Capabilities', () => {
  let token;

  beforeAll(async () => {
    // Authenticate user
    const dynamicEmail = `fyp${Date.now()}@test.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'fypuser', email: dynamicEmail, password: 'password123' });
    
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: dynamicEmail, password: 'password123' });
    
    token = loginRes.body.token;
  });

  describe('Security Hardening & Validators', () => {
    it('should block bad registration inputs', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'a', email: 'notanemail', password: '123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should enforce authentication on audio upload', async () => {
      const res = await request(app).post('/api/v1/audio/upload');
      expect(res.statusCode).toBe(401); // Unauthorized
    });
  });

  describe('Queue and Analytics API', () => {
    it('should retrieve structured performance analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/performance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('progress');
      expect(res.body.data).toHaveProperty('topics');
    });
  });
});
