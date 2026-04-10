const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

// Отримати сповіщення поточного користувача
router.get('/', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit);
        res.json(notifications);
    } catch (error) {
        console.error('Notification fetch error:', error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Кількість непрочитаних
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Позначити одне сповіщення як прочитане
router.patch('/:id/read', protect, async (req, res) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { isRead: true },
            { new: true }
        );
        if (!notif) return res.status(404).json({ message: 'Не знайдено' });
        res.json(notif);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Позначити всі як прочитані
router.post('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'Всі сповіщення позначено як прочитані' });
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

module.exports = router;
