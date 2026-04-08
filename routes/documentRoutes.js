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
  uploadFiles,
  getDocumentAudit,
  deleteDocument,
  deleteFile
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Створення документа (дозволяємо масив файлів, ліміт 30)
router.route('/')
  .get(protect, getDocuments)
  .post(protect, authorize('employee'), upload.array('files', 30), createDocument);

router.route('/:id')
  .get(protect, getDocumentById)
  .delete(protect, deleteDocument);

// Робота з файлами
router.post('/:id/files', protect, upload.array('files', 30), uploadFiles);
router.delete('/:id/files/:fileId', protect, deleteFile);

// Переходи статусів
router.post('/:id/submit', protect, authorize('employee'), submitDocument);
router.post('/:id/approve', protect, authorize('manager'), approveDocument);
router.post('/:id/reject', protect, authorize('manager'), rejectDocument);
router.post('/:id/sign', protect, authorize('signatory'), signDocument);
router.post('/:id/archive', protect, archiveDocument);

// Audit Trail
router.get('/:id/audit', protect, getDocumentAudit);

module.exports = router;