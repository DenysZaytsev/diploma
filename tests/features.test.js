const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const jwt = require('jsonwebtoken');

let mongoServer;
let userToken;
let userId;
let filterId;

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
    const user = await User.create({ email: 'user@features.com', passwordHash: 'hash', role: 'employee', fullName: 'F' });
    userId = user._id;

    // Create a mock notification for this user
    const Notification = require('../models/Notification');
    await Notification.create({ recipient: userId, type: 'system', title: 'Welcome', message: 'Hello', isRead: false });

    userToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
});

afterAll(async () => {
    require('../utils/socket').close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('System Features (Filters, Notifications, Delegations)', () => {

    // --- SAVED FILTERS ---
    it('1. Create a Saved Filter', async () => {
        const res = await request(app)
            .post('/api/saved-filters')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'My Drafts',
                filters: { status: 'draft' }
            });
        
        if (res.statusCode !== 201) console.log('Saved filter creation error:', res.body);
        expect(res.statusCode).toBe(201);
        expect(res.body.name).toBe('My Drafts');
        filterId = res.body._id;
    });

    it('2. Fetch Saved Filters', async () => {
        const res = await request(app)
            .get('/api/saved-filters')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBe(1);
    });

    it('3. Delete a Saved Filter', async () => {
        const res = await request(app)
            .delete(`/api/saved-filters/${filterId}`)
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
    });

    // --- NOTIFICATIONS ---
    it('4. Fetch missing/unread Notifications count', async () => {
        const res = await request(app)
            .get('/api/notifications/unread-count')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('5. Mark all Notifications as read', async () => {
        const res = await request(app)
            .post('/api/notifications/read-all')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        
        // Verify unread count is now 0
        const res2 = await request(app)
            .get('/api/notifications/unread-count')
            .set('Authorization', `Bearer ${userToken}`);
        expect(res2.body.count).toBe(0);
    });

    // --- DELEGATIONS ---
    it('6. Admin can create Delegation', async () => {
        const User = require('../models/User');
        const approver1 = await User.create({ email: 'app1@del.com', passwordHash: 'h', role: 'approver', department: 'Legal', fullName: 'Approver1' });
        const delegateUser = await User.create({ email: 'del@del.com', passwordHash: 'h', role: 'approver', department: 'Legal', fullName: 'Del' });
        
        const appToken = jwt.sign({ id: approver1._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        const res = await request(app)
            .post('/api/delegations')
            .set('Authorization', `Bearer ${appToken}`)
            .send({
                delegateId: delegateUser._id,
                dateFrom: new Date(),
                dateTo: new Date(new Date().getTime() + 10000000),
                reason: 'Vacation'
            });

        if (res.statusCode !== 201) console.log('Delegation route error:', res.body);
        expect(res.statusCode).toBe(201);
        expect(res.body.role).toBe('approver');
    });
});
