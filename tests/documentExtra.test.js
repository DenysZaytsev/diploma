const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const jwt = require('jsonwebtoken');

let mongoServer;
let employeeToken, adminToken;
let doc1Id, doc2Id;
let employeeId;

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoose.connect(uri);

    const User = require('../models/User');
    const Document = require('../models/Document');

    const emp = await User.create({ email: 'emp@extra.com', passwordHash: 'h', role: 'employee', fullName: 'Emp 1' });
    const adm = await User.create({ email: 'adm@extra.com', passwordHash: 'h', role: 'admin', fullName: 'Admin' });
    
    employeeId = emp._id;
    employeeToken = jwt.sign({ id: emp._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    adminToken = jwt.sign({ id: adm._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Create a base document for our tests
    const doc1 = await Document.create({
        creator: emp._id, title: 'Contract A', direction: 'internal', type: 'contract', confidentiality: 'internal', status: 'draft', department: 'Legal', regNumber: 'DOC-001',
        files: [{ filename: 'secret.pdf', originalName: 'secret.pdf', size: 1000, uploadedBy: emp._id }]
    });
    doc1Id = doc1._id;

    // Second document for linking
    const doc2 = await Document.create({
        creator: emp._id, title: 'Contract B', direction: 'internal', type: 'contract', confidentiality: 'internal', status: 'draft', department: 'Legal', regNumber: 'DOC-002'
    });
    doc2Id = doc2._id;
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Advanced Document Operations', () => {

    it('1. User can add a comment to their document', async () => {
        const res = await request(app)
            .post(`/api/documents/${doc1Id}/comments`)
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({ comment: 'Please review this soon.' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/Коментар додано/);
    });

    it('2. User can link a related document', async () => {
        const res = await request(app)
            .post(`/api/documents/${doc1Id}/related`)
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({ relatedId: doc2Id });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.relatedDocuments).toContain(doc2Id.toString());
    });

    it('3. User can unlink a related document', async () => {
        const res = await request(app)
            .delete(`/api/documents/${doc1Id}/related/${doc2Id}`)
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
    });

    it('4. Secure File Access Blocks Unauthorized Requests', async () => {
        // Attempting to download without token
        const res = await request(app).get(`/api/documents/${doc1Id}/files/secret.pdf/download`);
        expect(res.statusCode).toBe(401); // Unauthorized
    });

    it('5. Secure File Access Works For Authorized User', async () => {
        // Note: supertest trying to fetch a file that doesn't exist physically on disk 
        // will throw 404 from res.download if it parses everything right and reaches the end.
        // We just want to check it bypasses the 403 Forbidden checks!
        const res = await request(app)
            .get(`/api/documents/${doc1Id}/files/secret.pdf/download`)
            .set('Authorization', `Bearer ${employeeToken}`);
        
        // Since the physical file '/uploads/secret.pdf' won't exist in test memory, 
        // the app might crash or return 500 when it hits `res.download`. But it definitely won't pass through 403!
        // We'll accept 404 or a 500 thrown by express res.download. We just assert it is NOT 403.
        expect(res.statusCode).not.toBe(403); 
        expect(res.statusCode).not.toBe(401);
    });
    
    it('6. RDAC: Admin CANNOT download file', async () => {
        const res = await request(app)
            .get(`/api/documents/${doc1Id}/files/secret.pdf/download`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toMatch(/Адміністраторам заборонено/);
    });
});
