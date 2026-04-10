const express = require('express');
const router = express.Router();
const Delegation = require('../models/Delegation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/authMiddleware');

// Отримати делегування (свої або де я делегат)
router.get('/', protect, async (req, res) => {
    try {
        const delegations = await Delegation.find({
            $or: [{ delegator: req.user._id }, { delegate: req.user._id }]
        })
        .populate('delegator', 'fullName email department')
        .populate('delegate', 'fullName email department')
        .sort({ createdAt: -1 });
        res.json(delegations);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Створити делегування
router.post('/', protect, authorize('approver', 'signatory'), async (req, res) => {
    try {
        const { delegateId, dateFrom, dateTo, reason } = req.body;

        if (!delegateId || !dateFrom || !dateTo) {
            return res.status(400).json({ message: 'Вкажіть делегата та дати' });
        }

        if (new Date(dateTo) <= new Date(dateFrom)) {
            return res.status(400).json({ message: 'Дата закінчення має бути після дати початку' });
        }

        const delegate = await User.findById(delegateId);
        if (!delegate) return res.status(404).json({ message: 'Делегата не знайдено' });

        if (delegate.department !== req.user.department) {
            return res.status(400).json({ message: 'Делегат повинен бути з вашого відділу' });
        }

        const delegation = await Delegation.create({
            delegator: req.user._id,
            delegate: delegateId,
            department: req.user.department,
            role: req.user.role,
            dateFrom: new Date(dateFrom),
            dateTo: new Date(dateTo),
            reason
        });

        // Сповіщення делегату
        await Notification.create({
            recipient: delegateId,
            type: 'delegation',
            title: 'Нове делегування',
            message: `${req.user.fullName} делегував вам повноваження ${req.user.role === 'approver' ? 'погоджувача' : 'підписанта'} з ${new Date(dateFrom).toLocaleDateString('uk-UA')} по ${new Date(dateTo).toLocaleDateString('uk-UA')}`
        });

        const populated = await Delegation.findById(delegation._id)
            .populate('delegator', 'fullName email department')
            .populate('delegate', 'fullName email department');

        res.status(201).json(populated);
    } catch (error) {
        console.error('Delegation error:', error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Скасувати делегування
router.delete('/:id', protect, async (req, res) => {
    try {
        const delegation = await Delegation.findById(req.params.id);
        if (!delegation) return res.status(404).json({ message: 'Не знайдено' });

        if (delegation.delegator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Немає доступу' });
        }

        delegation.isActive = false;
        await delegation.save();

        res.json({ message: 'Делегування скасовано' });
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

module.exports = router;
