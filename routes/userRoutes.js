const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const SystemAuditLog = require('../models/SystemAuditLog');
const { sendSystemEmail } = require('../utils/emailService');
const { protect, authorize } = require('../middleware/authMiddleware');

// Тимчасове сховище для токенів очищення логів (для прототипу)
const clearRequests = new Map();

// Допоміжна функція для запису в аудит-лог
const logAdminAction = async (req, action, targetEmail, details) => {
    try {
        await SystemAuditLog.create({
            adminId: req.user._id,
            adminName: req.user.fullName,
            adminEmail: req.user.email,
            action,
            targetEmail,
            details
        });
    } catch (err) {
        console.error('System Audit Log Error:', err);
    }
};

// Отримати логи аудиту адміністраторів (має бути ПЕРЕД /:id маршрутами)
router.get('/system/audit', protect, authorize('admin'), async (req, res) => {
    try {
        let query = {};
        if (req.query.search) {
            const regex = new RegExp(req.query.search, 'i');
            query.$or = [
                { adminName: regex },
                { adminEmail: regex },
                { targetEmail: regex },
                { details: regex },
                { action: regex }
            ];
        }
        if (req.query.action) {
            query.action = req.query.action;
        }
        
        if (req.query.dateFrom || req.query.dateTo) {
            query.createdAt = {};
            if (req.query.dateFrom) {
                query.createdAt.$gte = new Date(req.query.dateFrom);
            }
            if (req.query.dateTo) {
                query.createdAt.$lte = new Date(new Date(req.query.dateTo).setHours(23, 59, 59, 999));
            }
        }

        const sortField = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const logs = await SystemAuditLog.find(query).sort({ [sortField]: sortOrder });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Логування входу в систему (викликається з фронтенду після успішного логіну)
router.post('/system/audit/login', protect, async (req, res) => {
    try {
        await logAdminAction(req, 'Логін', req.user.email, 'Успішний вхід у систему');
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Запит на очищення логів аудиту
router.post('/system/audit/clear-request', protect, authorize('admin'), async (req, res) => {
    try {
        const token = crypto.randomBytes(20).toString('hex');
        clearRequests.set(token, req.user.email);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const confirmUrl = `${baseUrl}/api/users/system/audit/clear-confirm/${token}`;
        
        const msg = `Ви надіслали запит на повне очищення журналу системного аудиту.<br><br>Щоб підтвердити цю дію, перейдіть за посиланням:<br><br><a href="${confirmUrl}">${confirmUrl}</a><br><br>Якщо ви не робили цей запит, просто проігноруйте цей лист.`;
        
        await sendSystemEmail(req.user.email, 'Підтвердження очищення аудиту', msg);
        
        res.status(200).json({ success: true, message: 'Запит надіслано' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Підтвердження очищення логів
router.get('/system/audit/clear-confirm/:token', async (req, res) => {
    try {
        const email = clearRequests.get(req.params.token);
        if (!email) {
            return res.status(400).send('<div style="font-family: sans-serif; text-align: center; margin-top: 50px;"><h2>Помилка</h2><p>Недійсне або застаріле посилання для підтвердження.</p></div>');
        }

        await SystemAuditLog.deleteMany({});
        clearRequests.delete(req.params.token);

        res.send('<div style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #374151;"><h2>Успіх!</h2><p>Аудит лог було повністю очищено.</p><br><br><a href="/pages/admin-audit.html" style="padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Повернутися в адмінку</a></div>');
    } catch (error) {
        res.status(500).send('<div style="text-align: center; margin-top: 50px;"><h2>Помилка сервера</h2></div>');
    }
});

// Підтвердження зміни email
router.get('/confirm-email/:token', async (req, res) => {
    try {
        const user = await User.findOne({ emailConfirmationToken: req.params.token });
        if (!user) {
            return res.status(400).send('<div style="font-family: sans-serif; text-align: center; margin-top: 50px;"><h2>Помилка</h2><p>Недійсне або застаріле посилання для підтвердження.</p></div>');
        }

        user.email = user.pendingEmail;
        user.pendingEmail = undefined;
        user.emailConfirmationToken = undefined;
        await user.save();

        res.send('<div style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #374151;"><h2>Успіх!</h2><p>Email успішно змінено. Тепер ви можете увійти в систему з новою адресою.</p><br><br><a href="/" style="padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Повернутися до входу</a></div>');
    } catch (error) {
        res.status(500).send('<div style="text-align: center; margin-top: 50px;"><h2>Помилка сервера</h2></div>');
    }
});

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
        
        await logAdminAction(req, 'Створення', email, `Створено користувача. Роль: ${role}, Відділ: ${department || 'Немає'}`);
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
        if (targetUser.isSuperAdmin) {
            delete updateData.role; // Примусово ігноруємо будь-які спроби оновити роль
        } else if (!updateData.role) {
            delete updateData.role; // Якщо прийшла порожня строка, не оновлюємо
        }

        // Якщо адміністратор змінює пароль користувачу
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.passwordHash = await bcrypt.hash(password, salt);
            await logAdminAction(req, 'Зміна пароля', targetUser.email, 'Адміністратор примусово змінив пароль користувачу');
        }
        
        // Збір деталей для аудиту
        let changes = [];
        if (updateData.fullName && updateData.fullName !== targetUser.fullName) changes.push('Ім\'я');
        
        // Перевірка зміни email
        const oldEmail = targetUser.email;
        const newEmail = updateData.email;
        const isEmailChanged = newEmail && newEmail !== oldEmail;
        if (isEmailChanged) {
            const emailExists = await User.findOne({ email: newEmail });
            if (emailExists) return res.status(400).json({ message: 'Користувач з таким email вже існує' });
            
            const token = crypto.randomBytes(20).toString('hex');
            updateData.pendingEmail = newEmail;
            updateData.emailConfirmationToken = token;
            delete updateData.email; // Email зміниться тільки після кліку по лінку
            changes.push(`Запит на зміну Email (${oldEmail} -> ${newEmail})`);
        }

        if (updateData.role && updateData.role !== targetUser.role) changes.push(`Роль (${targetUser.role} -> ${updateData.role})`);
        if (updateData.department !== undefined && updateData.department !== targetUser.department) changes.push('Відділ');
        if (updateData.isBlocked !== undefined && updateData.isBlocked !== targetUser.isBlocked) changes.push(updateData.isBlocked ? 'Заблоковано' : 'Розблоковано');
        if (password) changes.push('Змінено пароль');

        const user = await User.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        ).select('-passwordHash');
        
        if (changes.length > 0) {
            await logAdminAction(req, 'Редагування', targetUser.email, `Змінено: ${changes.join(', ')}`);
        }

        // Відправка повідомлень на пошту
        if (password) {
            await sendSystemEmail(
                isEmailChanged ? newEmail : oldEmail, 
                'Зміна пароля', 
                `Вітаємо! Ваш пароль у системі EDMS було змінено адміністратором.<br>Новий пароль: <b>${password}</b><br>Будь ласка, збережіть його в надійному місці.`
            );
        }

        if (isEmailChanged) {
            // Збираємо повну адресу сервера з запиту
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const confirmUrl = `${baseUrl}/api/users/confirm-email/${updateData.emailConfirmationToken}`;
            const msg = `Адміністратор ініціював зміну вашого email у системі EDMS.<br>Старий email: <b>${oldEmail}</b><br>Новий (очікує підтвердження): <b>${newEmail}</b><br><br>Щоб підтвердити зміну, будь ласка, перейдіть за посиланням:<br><br><a href="${confirmUrl}">${confirmUrl}</a><br><br>Якщо ви не запитували цю зміну, проігноруйте цей лист.`;
            await sendSystemEmail([oldEmail, newEmail], 'Підтвердження зміни Email', msg);
        }

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
        
        await logAdminAction(req, 'Видалення', targetUser.email, `Видалено користувача: ${targetUser.fullName}`);
        
        res.json({ message: 'Користувача успішно видалено' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;