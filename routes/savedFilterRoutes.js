const express = require('express');
const router = express.Router();
const SavedFilter = require('../models/SavedFilter');
const { protect } = require('../middleware/authMiddleware');

// Отримати збережені фільтри
router.get('/', protect, async (req, res) => {
    try {
        const filters = await SavedFilter.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(filters);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Створити збережений фільтр
router.post('/', protect, async (req, res) => {
    try {
        const { name, filters } = req.body;
        if (!name) return res.status(400).json({ message: 'Назва фільтра обов\'язкова' });

        const count = await SavedFilter.countDocuments({ user: req.user._id });
        if (count >= 20) return res.status(400).json({ message: 'Максимум 20 збережених фільтрів' });

        const filter = await SavedFilter.create({ user: req.user._id, name, filters });
        res.status(201).json(filter);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

// Видалити збережений фільтр
router.delete('/:id', protect, async (req, res) => {
    try {
        const filter = await SavedFilter.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!filter) return res.status(404).json({ message: 'Не знайдено' });
        res.json({ message: 'Фільтр видалено' });
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

module.exports = router;
