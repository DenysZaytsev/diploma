const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
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

    // В роботі
    const inProgressDocs = await Document.countDocuments({ ...filter, status: { $nin: ['draft', 'rejected'] } });

    // Деталізація за статусами
    const statusDraft = await Document.countDocuments({ ...filter, status: 'draft' });
    const statusOnApproval = await Document.countDocuments({ ...filter, status: 'on_approval' });
    const statusOnSigning = await Document.countDocuments({ ...filter, status: 'on_signing' });
    const statusSigned = await Document.countDocuments({ ...filter, status: 'signed' });
    const statusRejected = await Document.countDocuments({ ...filter, status: 'rejected' });
    const statusArchived = await Document.countDocuments({ ...filter, status: 'archived' });

    // Feature 5: Overdue count
    const overdueDocs = await Document.countDocuments({
        ...filter,
        dueDate: { $lt: new Date() },
        status: { $nin: ['signed', 'archived', 'draft'] }
    });

    // Feature 12: Average approval time (in hours) — from on_approval to on_signing
    let avgApprovalTime = null;
    let rejectionRate = null;

    try {
        const approvalTimes = await AuditLog.aggregate([
            { $match: { action: 'status_change', toStatus: 'on_signing' } },
            { $lookup: {
                from: 'auditlogs',
                let: { docId: '$document' },
                pipeline: [
                    { $match: { $expr: { $and: [
                        { $eq: ['$document', '$$docId'] },
                        { $eq: ['$action', 'status_change'] },
                        { $eq: ['$toStatus', 'on_approval'] }
                    ]}}}
                ],
                as: 'submitLog'
            }},
            { $unwind: { path: '$submitLog', preserveNullAndEmptyArrays: false } },
            { $project: {
                timeDiff: { $subtract: ['$createdAt', '$submitLog.createdAt'] }
            }},
            { $group: { _id: null, avgTime: { $avg: '$timeDiff' } } }
        ]);
        if (approvalTimes.length > 0) {
            avgApprovalTime = Math.round(approvalTimes[0].avgTime / (1000 * 60 * 60) * 10) / 10; // hours
        }

        // Rejection rate
        const totalProcessed = statusSigned + statusArchived + statusRejected;
        if (totalProcessed > 0) {
            rejectionRate = Math.round((statusRejected / totalProcessed) * 100 * 10) / 10;
        }
    } catch (e) {
        console.error('Stats aggregation error:', e);
    }

    // Feature 12: Recent activity feed (last 10 actions)
    let recentActivity = [];
    try {
        recentActivity = await AuditLog.find({})
            .populate('user', 'fullName')
            .populate('document', 'regNumber title')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
    } catch (e) {
        console.error('Activity feed error:', e);
    }

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
      statusArchived,
      overdueDocs,
      avgApprovalTime,
      rejectionRate,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching stats' });
  }
});

module.exports = router;
