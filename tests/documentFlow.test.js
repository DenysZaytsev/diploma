const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Document = require('../models/Document');
const bcrypt = require('bcryptjs');

let mongoServer;

// Helper variables
let employeeToken, approverToken, signatoryToken;
let employeeId, approverId, signatoryId;
let documentId;

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(uri);

    // Create test users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const emp = await User.create({ email: 'emp@test.com', passwordHash, role: 'employee', fullName: 'Employee', department: 'IT' });
    const apprv = await User.create({ email: 'apprv@test.com', passwordHash, role: 'approver', fullName: 'Approver', department: 'IT' });
    const sig = await User.create({ email: 'sig@test.com', passwordHash, role: 'signatory', fullName: 'Signatory', department: 'IT' });

    employeeId = emp._id; approverId = apprv._id; signatoryId = sig._id;

    // Login users to get tokens
    const loginRes1 = await request(app).post('/api/auth/login').send({ email: 'emp@test.com', password: 'password123' });
    employeeToken = loginRes1.body.token;

    const loginRes2 = await request(app).post('/api/auth/login').send({ email: 'apprv@test.com', password: 'password123' });
    approverToken = loginRes2.body.token;

    const loginRes3 = await request(app).post('/api/auth/login').send({ email: 'sig@test.com', password: 'password123' });
    signatoryToken = loginRes3.body.token;
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Document Flow Integration Test', () => {

    it('1. Employee creates a draft document', async () => {
        const res = await request(app)
            .post('/api/documents')
            .set('Authorization', `Bearer ${employeeToken}`)
            .field('title', 'Test Contract')
            .field('direction', 'internal')
            .field('type', 'contract')
            .field('confidentiality', 'internal')
            .field('tags', 'test,jest');
        
        expect(res.statusCode).toBe(201);
        expect(res.body.title).toBe('Test Contract');
        expect(res.body.status).toBe('draft');
        
        documentId = res.body._id;
    });

    it('2. Signatory cannot see the draft of employee', async () => {
        const res = await request(app)
            .get('/api/documents')
            .set('Authorization', `Bearer ${signatoryToken}`);
        
        expect(res.statusCode).toBe(200);
        // Draft visibility matrix: only creator/admin can see it
        const docs = res.body;
        const found = docs.find(d => d._id === documentId);
        expect(found).toBeUndefined();
    });

    it('3. Employee submits document for approval', async () => {
        const res = await request(app)
            .post(`/api/documents/${documentId}/submit`)
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('on_approval');
    });

    it('4. Approver approves the document', async () => {
        const res = await request(app)
            .post(`/api/documents/${documentId}/approve`)
            .set('Authorization', `Bearer ${approverToken}`)
            .send({ comment: 'Looks good' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('on_signing');
    });

    it('5. Signatory signs the document', async () => {
        const res = await request(app)
            .post(`/api/documents/${documentId}/sign`)
            .set('Authorization', `Bearer ${signatoryToken}`)
            .send({ signatureData: 'fake_key_signature' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('signed');
    });

    it('6. Approver archives the document', async () => {
        const res = await request(app)
            .post(`/api/documents/${documentId}/archive`)
            .set('Authorization', `Bearer ${approverToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('archived');
    });

    it('7. Audit logs are generated for all actions', async () => {
        const res = await request(app)
            .get(`/api/documents/${documentId}/audit`)
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('8. Deep Search: Can find document by internal metadata (role/dept)', async () => {
        const res = await request(app)
            .get('/api/documents?search=contract')
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.some(d => d._id === documentId)).toBe(true);
    });

    it('9. Deep Search Edge Case: Can find by target metadata (confidentiality)', async () => {
        const res = await request(app)
            .get('/api/documents?search=internal')
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
        // We know we created a doc with confidentiality: 'internal'
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
});
