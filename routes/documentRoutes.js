const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  addComment,
  submitDocument,
  approveDocument,
  rejectDocument,
  signDocument,
  archiveDocument,
  uploadFiles,
  getDocumentAudit,
  deleteDocument,
  deleteFile,
  replaceFile,
  linkRelatedDocument,
  unlinkRelatedDocument,
  bulkAction
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Створення документа (дозволяємо масив файлів, ліміт 30)
router.route('/')
  .get(protect, getDocuments)
  .post(protect, authorize('employee'), upload.array('files', 30), createDocument);

// Масові операції (Feature 13)
router.post('/bulk', protect, bulkAction);

router.route('/:id')
  .get(protect, getDocumentById)
  .patch(protect, authorize('employee'), updateDocument)
  .delete(protect, authorize('employee', 'admin'), deleteDocument);

// Робота з файлами
router.post('/:id/files', protect, upload.array('files', 30), uploadFiles);
router.delete('/:id/files/:fileId', protect, deleteFile);
// Feature 1: Replace file (versioning)
router.put('/:id/files/:fileId', protect, upload.array('files', 1), replaceFile);

// Feature 6: Related documents
router.post('/:id/related', protect, linkRelatedDocument);
router.delete('/:id/related/:relatedId', protect, unlinkRelatedDocument);

// Переходи статусів
router.post('/:id/submit', protect, authorize('employee'), submitDocument);
router.post('/:id/approve', protect, authorize('approver'), approveDocument);
router.post('/:id/reject', protect, authorize('approver', 'signatory'), rejectDocument);
router.post('/:id/sign', protect, authorize('signatory'), signDocument);
router.post('/:id/archive', protect, authorize('approver'), archiveDocument);

// Коментарі
router.post('/:id/comments', protect, addComment);

// Audit Trail
router.get('/:id/audit', protect, getDocumentAudit);

module.exports = router;
