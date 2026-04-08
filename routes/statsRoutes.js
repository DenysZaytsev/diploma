const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get stats for dashboard
// @route   GET /api/stats
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const filter = { isDeleted: false };
    
    if (req.user.role === 'employee') {
      filter.creator = req.user._id;
    } else if (req.user.role === 'signatory') {
      filter.status = 'on_signing';
    }

    const totalDocs = await Document.countDocuments(filter);
    
    // Напрямки
    const incomingDocs = await Document.countDocuments({ ...filter, direction: 'incoming' });
    const outgoingDocs = await Document.countDocuments({ ...filter, direction: 'outgoing' });
    
    // Status breakdowns
    const inProgressDocs = await Document.countDocuments({ ...filter, status: 'on_signing' });
    const underReviewDocs = await Document.countDocuments({ ...filter, status: 'on_approval' });

    res.json({
      totalDocs,
      incomingDocs,
      outgoingDocs,
      inProgressDocs,
      underReviewDocs
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching stats' });
  }
});

module.exports = router;