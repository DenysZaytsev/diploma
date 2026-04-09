const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getUserProfile, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/login', loginUser);
router.post('/register', registerUser);
router.get('/profile', protect, getUserProfile);
router.patch('/profile', protect, upload.single('avatar'), updateProfile);

module.exports = router;
