const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Отримати список всіх користувачів (лише адмін, згідно з документацією)
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const filter = {};
        if (req.query.role) {
            filter.role = req.query.role;
        }
        if (req.query.department) {
            filter.department = req.query.department;
        }
        const users = await User.find(filter).select('-passwordHash');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Створити нового користувача (лише адмін)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { email, password, role, fullName, department } = req.body;
        
        if (!email || !password || !role || !fullName) {
            return res.status(400).json({ message: 'Будь ласка, заповніть всі обовʼязкові поля' });
        }
        // Заборона звичайним адмінам створювати користувачів з роллю "admin"
        if (role === 'admin' && !req.user.isSuperAdmin) {
            return res.status(403).json({ message: 'Тільки Головний адміністратор може створювати інших адміністраторів' });
        }
        
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'Користувач з таким email вже існує' });
        
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const user = await User.create({ email, passwordHash, role, fullName, department });
        res.status(201).json({ _id: user._id, email: user.email, fullName: user.fullName });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Оновити користувача
router.patch('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        // Відкидаємо passwordHash та isSuperAdmin, щоб їх неможливо було передати напряму
        const { password, passwordHash, isSuperAdmin, ...updateData } = req.body;
        
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ message: 'Користувача не знайдено' });

        // Захист: Звичайний адмін не може редагувати Головного адміна або інших адмінів (крім себе)
        if (!req.user.isSuperAdmin) {
            if (targetUser.isSuperAdmin) {
                return res.status(403).json({ message: 'Ви не можете редагувати Головного адміністратора' });
            }
            // Звичайний адмін не може редагувати інших адмінів (крім себе)
            if (targetUser.role === 'admin' && req.user._id.toString() !== targetUser._id.toString()) {
                return res.status(403).json({ message: 'Ви не можете редагувати інших адміністраторів' });
            }
        }
        // Головний адмін може редагувати себе (окрім ролі)
        // Головний адмін може редагувати інших адмінів

        // Захист: Головного адміна неможливо заблокувати
        if (targetUser.isSuperAdmin && updateData.isBlocked === true) {
            return res.status(400).json({ message: 'Головного адміністратора неможливо заблокувати' }); // Навіть SuperAdmin не може заблокувати себе
        } else if (targetUser.role === 'admin' && updateData.isBlocked === true && !req.user.isSuperAdmin) {
            return res.status(403).json({ message: 'Тільки Головний адміністратор може блокувати інших адміністраторів' });
        }

        // Ніхто не може змінити роль Головного адміністратора (навіть він сам) - це фіксована роль
        if (targetUser.isSuperAdmin && updateData.role && updateData.role !== targetUser.role) {
            return res.status(400).json({ message: 'Роль Головного адміністратора не може бути змінена' });
        }

        // Якщо адміністратор змінює пароль користувачу
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.passwordHash = await bcrypt.hash(password, salt);
        }
        
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        ).select('-passwordHash');
        
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Видалити користувача
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        // Підтримка різних форматів ID з middleware
        if (req.params.id === req.user._id?.toString() || req.params.id === req.user.id) {
            return res.status(400).json({ message: 'Ви не можете видалити власний акаунт' });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ message: 'Користувача не знайдено' });
        
        // Захист: Звичайний адмін не може видалити Головного адміна або інших адмінів (крім себе)
        if (targetUser.isSuperAdmin) { // Навіть SuperAdmin не може видалити себе, це вже перевірено вище
            return res.status(400).json({ message: 'Головного адміністратора неможливо видалити' }); 
        } 
        if (targetUser.role === 'admin' && !req.user.isSuperAdmin && req.user._id.toString() !== targetUser._id.toString()) {
            return res.status(403).json({ message: 'Тільки Головний адміністратор може видаляти інших адміністраторів' });
        }
        
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
        
        res.json({ message: 'Користувача успішно видалено' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;