const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getSettings)
  .patch(protect, authorize('admin'), updateSettings);

module.exports = router;