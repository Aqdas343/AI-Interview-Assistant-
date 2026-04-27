const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

 // Provide tests with a uniquely generated username
 const mockUser = {
   username: `uploaduser_${Date.now()}`,
   email: `upload${Date.now()}@test.com`,
   password: 'password123'
 };

describe('File Upload API', () => {
  let token;

  beforeAll(async () => {
    await db.initDb();
    db.resetDb();
    // Setup: Register and Login to get token
    await request(app).post('/api/v1/auth/register').send(mockUser);
    const res = await request(app).post('/api/v1/auth/login').send({ email: mockUser.email, password: mockUser.password });
    token = res.body.token;
  });

  it('should successfully upload a valid image file', async () => {
    const response = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('dummy image content'), 'test.png');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body.file).toHaveProperty('originalName', 'test.png');
    expect(response.body.file.mimetype).toBe('image/png');
  });

  it('should fail to upload without authentication', async () => {
    const response = await request(app)
      .post('/api/v1/upload')
      .attach('file', Buffer.from('dummy image content'), 'test.png');

    expect(response.status).toBe(401);
  });

  it('should fail to upload an invalid file type (e.g. .txt)', async () => {
    const response = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('dummy text content'), 'test.txt');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid file type');
  });
});
