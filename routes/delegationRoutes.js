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
router.post('/', protect, authorize('approver', 'signatory', 'employee'), async (req, res) => {
    try {
        const { delegateId, dateFrom, dateTo, reason } = req.body;

        if (!delegateId || !dateFrom || !dateTo) {
            return res.status(400).json({ message: 'Вкажіть делегата та дати' });
        }

        const fromDate = new Date(dateFrom + 'T00:00:00');
        const toDate = new Date(dateTo + 'T23:59:59');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (fromDate < today) {
            return res.status(400).json({ message: 'Дата початку не може бути в минулому' });
        }

        if (toDate < fromDate) {
            return res.status(400).json({ message: 'Дата закінчення не може бути раніше дати початку' });
        }

        const delegate = await User.findById(delegateId);
        if (!delegate) return res.status(404).json({ message: 'Делегата не знайдено' });

        if (delegate.role !== req.user.role) {
            return res.status(400).json({ message: 'Делегувати повноваження можна лише користувачу з аналогічною роллю' });
        }

        if (req.user.role === 'employee' && delegate.department !== req.user.department) {
            return res.status(400).json({ message: 'Працівники можуть делегувати обов\'язки лише колегам зі свого відділу' });
        }

        // Перевірка на циклічне делегування: чи не делегував цей користувач вже повноваження поточному юзеру
        const activeIncomingDelegation = await Delegation.findOne({
            delegator: delegateId,
            delegate: req.user._id,
            isActive: true,
            $or: [
                { dateFrom: { $lte: toDate }, dateTo: { $gte: fromDate } }
            ]
        });

        if (activeIncomingDelegation) {
            return res.status(400).json({ 
                message: `Неможливо делегувати права користувачу ${delegate.fullName}, оскільки він уже делегував вам свої повноваження на цей період.` 
            });
        }

        const delegation = await Delegation.create({
            delegator: req.user._id,
            delegate: delegateId,
            department: req.user.role === 'employee' ? req.user.department : delegate.department,
            role: req.user.role,
            dateFrom: new Date(dateFrom),
            dateTo: new Date(dateTo),
            reason
        });

        // Сповіщення делегату
        let roleName = 'колеги';
        if (req.user.role === 'approver') roleName = 'погоджувача';
        if (req.user.role === 'signatory') roleName = 'підписанта';
        if (req.user.role === 'employee') roleName = 'працівника відділу';

        // Сповіщення делегату якщо налаштування активовано
        if (delegate.notifications?.onDelegation !== false) {
            await Notification.create({
                recipient: delegateId,
                type: 'delegation',
                title: 'Нове делегування',
                message: `${req.user.fullName} делегував вам повноваження ${roleName} з ${new Date(dateFrom).toLocaleDateString('uk-UA')} по ${new Date(dateTo).toLocaleDateString('uk-UA')}`
            });
        }

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
