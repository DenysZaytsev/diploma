const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const jwt = require('jsonwebtoken');

let mongoServer;
let adminToken, employeeToken;
let departmentId, docTypeId;

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);

    const User = require('../models/User');
    const admin = await User.create({ email: 'admin@dict.com', passwordHash: 'hash', role: 'admin', fullName: 'A' });
    const emp = await User.create({ email: 'emp@dict.com', passwordHash: 'hash', role: 'employee', fullName: 'E' });

    adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    employeeToken = jwt.sign({ id: emp._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Dictionaries (Departments & Document Types)', () => {

    // --- DEPARTMENTS ---
    it('1. Admin can create a Department', async () => {
        const res = await request(app)
            .post('/api/departments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Legal', description: 'Legal Dept' });
        
        expect(res.statusCode).toBe(201);
        expect(res.body.name).toBe('Legal');
        departmentId = res.body._id;
    });

    it('2. Employee cannot create a Department', async () => {
        const res = await request(app)
            .post('/api/departments')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({ name: 'HR' });
        
        expect(res.statusCode).toBe(403);
    });

    it('3. Anyone logged in can fetch Departments', async () => {
        const res = await request(app)
            .get('/api/departments')
            .set('Authorization', `Bearer ${employeeToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
    });

    // --- DOCUMENT TYPES ---
    it('4. Admin can create a Document Type', async () => {
        const res = await request(app)
            .post('/api/document-types')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Contract', code: 'contract' });
        
        expect(res.statusCode).toBe(201);
        expect(typeof res.body.code).toBe('string');
        docTypeId = res.body._id;
    });

    it('6. Admin can delete a Document Type', async () => {
        const res = await request(app)
            .delete(`/api/document-types/${docTypeId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        if (res.statusCode !== 200) console.log(res.body);
        expect(res.statusCode).toBe(200);
    });
});
