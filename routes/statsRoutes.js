const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const Delegation = require('../models/Delegation');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get stats for dashboard
// @route   GET /api/stats
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const now = new Date();
    const filter = { isDeleted: false };

    // Знаходимо департаменти на які є делегування
    const myDelegations = await Delegation.find({
        delegate: req.user._id,
        isActive: true,
        dateFrom: { $lte: now },
        dateTo: { $gte: now }
    });
    const delegatedDepts = myDelegations.map(d => d.department);
    const accessibleDepts = [req.user.department, ...delegatedDepts].filter(Boolean);

    if (req.user.role === 'employee') {
      filter.creator = req.user._id;
    } else if (req.user.role === 'approver') {
      filter.department = { $in: accessibleDepts };
    } else if (req.user.role === 'signatory') {
      filter.status = 'on_signing';
      filter.department = { $in: accessibleDepts };
    }

    const totalDocs = await Document.countDocuments(filter);

    // Напрямки
    const incomingDocs = await Document.countDocuments({ ...filter, direction: 'incoming' });
    const outgoingDocs = await Document.countDocuments({ ...filter, direction: 'outgoing' });
    const internalDocs = await Document.countDocuments({ ...filter, direction: 'internal' });

    // В роботі — тільки ті що реально в процесі (без підписаних/архівних)
    const inProgressDocs = await Document.countDocuments({ ...filter, status: { $in: ['on_approval', 'on_signing'] } });

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
        dueDate: { $lt: now },
        status: { $nin: ['signed', 'archived', 'draft'] }
    });

    // Analytics
    let avgApprovalTime = null;
    let rejectionRate = null;

    try {
        // Average approval time calculation (simplified check)
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
            avgApprovalTime = Math.round(approvalTimes[0].avgTime / (1000 * 60 * 60) * 10) / 10;
        }

        const totalProcessed = statusSigned + statusArchived + statusRejected;
        if (totalProcessed > 0) {
            rejectionRate = Math.round((statusRejected / totalProcessed) * 100 * 10) / 10;
        }
    } catch (e) {
        console.error('Stats aggregation error:', e);
    }

    // Feature 12 & Hardening: Privacy-aware activity feed
    let recentActivity = [];
    try {
        // Рівень доступу для стрічки активності
        let activityFilter = {};
        if (req.user.role === 'admin') {
            activityFilter = {}; // Адмін бачить все
        } else if (req.user.role === 'employee') {
            // Бачить активність лише по деж. доступним документам
            const permittedDocs = await Document.find({
                $or: [
                    { creator: req.user._id },
                    { status: { $in: ['signed', 'archived'] }, confidentiality: { $in: ['public', 'internal'] } }
                ]
            }).select('_id');
            activityFilter = { document: { $in: permittedDocs.map(d => d._id) } };
        } else {
            // Approver/Signatory бачить свій департамент + делеговані
            const permittedDocs = await Document.find({
                $or: [
                    { department: { $in: accessibleDepts } },
                    { creator: req.user._id }
                ]
            }).select('_id');
            activityFilter = { document: { $in: permittedDocs.map(d => d._id) } };
        }

        recentActivity = await AuditLog.find(activityFilter)
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
