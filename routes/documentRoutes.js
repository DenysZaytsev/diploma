const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocumentById,
  submitDocument,
  approveDocument,
  rejectDocument,
  signDocument,
  archiveDocument,
  getDocumentAudit,
  deleteDocument,
  uploadFiles
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/')
  .get(protect, getDocuments)
  .post(protect, authorize('employee'), upload.array('files', 5), createDocument);

router.route('/:id')
  .get(protect, getDocumentById)
  .delete(protect, authorize('employee', 'admin'), deleteDocument);

router.post('/:id/submit', protect, authorize('employee'), submitDocument);
router.post('/:id/approve', protect, authorize('manager'), approveDocument);
router.post('/:id/reject', protect, authorize('manager'), rejectDocument);
router.post('/:id/sign', protect, authorize('signatory'), signDocument);
router.post('/:id/archive', protect, authorize('manager', 'admin'), archiveDocument);

router.post('/:id/files', protect, authorize('employee'), upload.array('files', 5), uploadFiles);

router.route('/:id/audit')
  .get(protect, getDocumentAudit);

module.exports = router;
