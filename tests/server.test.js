const request = require('supertest');
const app = require('../server'); // Assuming your server.js exports the express app

// Mock the database module
jest.mock('../database.js', () => ({
  query: jest.fn(),
}));
const db = require('../database.js');

describe('User Registration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    db.query.mockReset();
  });

  test('should register a new user successfully', async () => {
    // Mock successful database insert
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'testuser', role: 'patient' }],
    });

    const response = await request(app)
      .post('/api/register')
      .send({ username: 'testuser', password: 'password123' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Registration successful');
    expect(response.body.userId).toBe(1);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['testuser', expect.any(String), 'patient'])
    );
  });

  test('should return 400 if username or password missing', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({ username: 'testuser' }); // Missing password

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Missing username or password');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('should return 400 if username already taken', async () => {
    // Mock database throwing an error for duplicate username
    db.query.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "users_username_key"'));

    const response = await request(app)
      .post('/api/register')
      .send({ username: 'existinguser', password: 'password123' });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Username already taken');
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
