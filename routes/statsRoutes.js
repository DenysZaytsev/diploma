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
    } else if (req.user.role === 'approver') {
      filter.department = req.user.department;
    } else if (req.user.role === 'signatory') {
      filter.status = 'on_signing';
      filter.department = req.user.department;
    }

    const totalDocs = await Document.countDocuments(filter);
    
    // Напрямки
    const incomingDocs = await Document.countDocuments({ ...filter, direction: 'incoming' });
    const outgoingDocs = await Document.countDocuments({ ...filter, direction: 'outgoing' });
    const internalDocs = await Document.countDocuments({ ...filter, direction: 'internal' });
    
    // В роботі (усі, окрім чернеток та відхилених)
    const inProgressDocs = await Document.countDocuments({ ...filter, status: { $nin: ['draft', 'rejected'] } });

    // Деталізація за статусами
    const statusDraft = await Document.countDocuments({ ...filter, status: 'draft' });
    const statusOnApproval = await Document.countDocuments({ ...filter, status: 'on_approval' });
    const statusOnSigning = await Document.countDocuments({ ...filter, status: 'on_signing' });
    const statusSigned = await Document.countDocuments({ ...filter, status: 'signed' });
    const statusRejected = await Document.countDocuments({ ...filter, status: 'rejected' });
    const statusArchived = await Document.countDocuments({ ...filter, status: 'archived' });

    res.json({
      totalDocs,
      incomingDocs,
      outgoingDocs,
      internalDocs,
      inProgressDocs,
      statusDraft,
      statusOnApproval,
      statusOnSigning,
      statusSigned,
      statusRejected,
      statusArchived
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching stats' });
  }
});

module.exports = router;