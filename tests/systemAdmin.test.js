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
let employeeId;

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_key';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoose.connect(uri);

    const User = require('../models/User');
    const SystemAuditLog = require('../models/SystemAuditLog');

    const Settings = require('../models/Settings');

    const emp = await User.create({ email: 'emp@admin.com', passwordHash: 'h', role: 'employee', fullName: 'Emp' });
    const adm = await User.create({ email: 'adm@admin.com', passwordHash: 'h', role: 'admin', fullName: 'Admin' });
    
    await Settings.create({ maxUploadFiles: 20, smtpHost: 'smtp.fake.com', smtpUser: 'user', smtpPass: 'pass' });
    
    employeeId = emp._id;
    employeeToken = jwt.sign({ id: emp._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    adminToken = jwt.sign({ id: adm._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    await SystemAuditLog.create({
        adminId: adm._id, adminName: 'Admin', adminEmail: 'adm@admin.com', action: 'Логін', targetEmail: 'adm@admin.com', details: 'Test'
    });
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('System and Admin Security', () => {

    it('1. Admin can fetch System Audit Logs', async () => {
        const res = await request(app)
            .get('/api/users/system/audit')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body[0].action).toBe('Логін');
    });

    it('2. Admin can request to clear Audit Logs (Generates Token / Email)', async () => {
        const res = await request(app)
            .post('/api/users/system/audit/clear-request')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/Запит надіслано/);
        
        // Assert that Nodemailer was called to send the confirmation link
        expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('3. Email Change Process (Generates Pending Token)', async () => {
        // Admin updates employee's email
        const res = await request(app)
            .patch(`/api/users/${employeeId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'newemail@admin.com' });
        
        expect(res.statusCode).toBe(200);
        
        // The email does NOT change immediately
        expect(res.body.email).toBe('emp@admin.com');
        
        // Let's manually fetch the user to check tokens
        const User = require('../models/User');
        const user = await User.findById(employeeId);
        expect(user.pendingEmail).toBe('newemail@admin.com');
        expect(user.emailConfirmationToken).toBeDefined();

        // Simulate confirming the email via GET request
        const resConfirm = await request(app)
            .get(`/api/users/confirm-email/${user.emailConfirmationToken}`);
        
        expect(resConfirm.statusCode).toBe(200);
        
        // Verify it changed
        const finalUser = await User.findById(employeeId);
        expect(finalUser.email).toBe('newemail@admin.com');
    });
});
