const request = require('supertest');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue(true)
    })
}));
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const jwt = require('jsonwebtoken');

let mongoServer;
let adminToken, employeeToken;

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
    const admin = await User.create({ email: 'a@stats.com', passwordHash: 'h', role: 'admin', fullName: 'A' });
    const emp = await User.create({ email: 'e@stats.com', passwordHash: 'h', role: 'employee', fullName: 'E' });

    adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    employeeToken = jwt.sign({ id: emp._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Dashboard Stats & System Settings', () => {

    it('1. User can fetch their dashboard stats', async () => {
        const res = await request(app)
            .get('/api/stats')
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('statusDraft');
        expect(res.body).toHaveProperty('statusOnApproval');
        expect(res.body).toHaveProperty('recentActivity');
    });

    it('2. Admin can fetch global dashboard stats', async () => {
        const res = await request(app)
            .get('/api/stats')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('totalDocs');
    });

    it('3. Anyone logged in can fetch safe public system settings', async () => {
        const res = await request(app)
            .get('/api/settings')
            .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('maxUploadFiles');
        expect(res.body).not.toHaveProperty('smtpPassword'); // Secret settings should not leak
    });

    it('4. Admin can update system settings', async () => {
        const res = await request(app)
            .patch('/api/settings')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ maxUploadFiles: 15 });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.maxUploadFiles).toBe(15);
    });

    it('5. Employee cannot update system settings', async () => {
        const res = await request(app)
            .patch('/api/settings')
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({ maxUploadFiles: 20 });
        
        expect(res.statusCode).toBe(403);
    });

    it('6. Test Email fails without complete SMTP settings', async () => {
        const res = await request(app)
            .post('/api/settings/test-email')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
        
        if (res.statusCode !== 400) console.log('Test email 400 error output:', res.body);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Неповні налаштування/);
    });

    it('7. Admin can update SMTP settings and trigger test email', async () => {
        await request(app)
            .patch('/api/settings')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ smtpHost: 'smtp.test.com', smtpUser: 'test', smtpPass: 'pass' });

        const res = await request(app)
            .post('/api/settings/test-email')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        if (res.statusCode !== 200) console.log('Test email 200 error output:', res.body);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/Тестовий лист успішно відправлено/);
        
        expect(nodemailer.createTransport).toHaveBeenCalled();
    });
});
