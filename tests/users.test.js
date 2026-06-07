const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');

let mongoServer;
let adminToken, employeeToken;
let employeeId;

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);

    // Initial setup
    const admin = new User({ email: 'admin@test.com', passwordHash: 'hash', role: 'admin', fullName: 'Admin' });
    await admin.save();
    
    const emp = new User({ email: 'emp@test.com', passwordHash: 'hash', role: 'employee', fullName: 'Employee' });
    await emp.save();
    employeeId = emp._id;

    // Login (we can mock token generation or use the full login route if we set proper passwords)
    // Since we saved raw hashes, let's just generate JWT manually to save time
    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    employeeToken = jwt.sign({ id: emp._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('User Management (Admin)', () => {

    it('1. Admin can fetch all users', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('2. Employee cannot fetch all users (403 Forbidden)', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${employeeToken}`);

        expect(res.statusCode).toBe(403);
    });

    it('3. Admin can create a new user directly', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                email: 'newuser@test.com',
                password: 'password123',
                fullName: 'New User',
                role: 'approver',
                department: 'HR'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.email).toBe('newuser@test.com');
    });

    it('4. Admin can block a user', async () => {
        const res = await request(app)
            .patch(`/api/users/${employeeId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ isBlocked: true });

        expect(res.statusCode).toBe(200);
        expect(res.body.isBlocked).toBe(true);
    });

    it('5. Admin cannot delete a Super Admin', async () => {
        const superAdmin = new User({ email: 'super@test.com', passwordHash: 'hash', role: 'admin', isSuperAdmin: true, fullName: 'Super Admin' });
        await superAdmin.save();

        const res = await request(app)
            .delete(`/api/users/${superAdmin._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(400);
    });

});
