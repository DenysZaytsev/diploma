const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { loginUser, registerUser, getUserProfile, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 15,
    message: { message: 'Забагато спроб. Спробуйте через 15 хвилин.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/login', authLimiter, loginUser);
router.post('/register', authLimiter, registerUser);
router.get('/profile', protect, getUserProfile);
router.patch('/profile', protect, upload.single('avatar'), updateProfile);

module.exports = router;
