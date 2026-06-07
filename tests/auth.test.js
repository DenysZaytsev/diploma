const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');

let mongoServer;

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Authentication Flow', () => {
    let token;

    it('1. Register a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                fullName: 'Test User',
                department: 'IT'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('email', 'test@example.com');
        token = res.body.token;
    });

    it('2. Login with correct credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        token = res.body.token; // Update token just in case
    });

    it('3. Login with incorrect password should fail', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'wrongpassword'
            });

        expect(res.statusCode).toBe(401);
        expect(res.body).toHaveProperty('message', 'Invalid email or password');
    });

    it('4. Attempt to access profile without token should fail', async () => {
        const res = await request(app).get('/api/auth/profile');
        expect(res.statusCode).toBe(401);
    });

    it('5. Access profile with token should return user info', async () => {
        const res = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('email', 'test@example.com');
    });

    it('6. Blocked user cannot access protected routes', async () => {
        // Block the user directly in DB
        await User.updateOne({ email: 'test@example.com' }, { isBlocked: true });

        const res = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(403);
    });

    it('7. Real-time Session Invalidation: Blocked user rejected mid-session', async () => {
        // 1. Unblock user first
        await User.updateOne({ email: 'test@example.com' }, { isBlocked: false });
        
        // 2. Access profile (Success)
        const res1 = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);
        expect(res1.statusCode).toBe(200);

        // 3. Admin blocks user
        await User.updateOne({ email: 'test@example.com' }, { isBlocked: true });

        // 4. Access profile again with SAME token (Fail)
        const res2 = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res2.statusCode).toBe(403);
        expect(res2.body.message).toMatch(/заблоковано/);
    });
});
