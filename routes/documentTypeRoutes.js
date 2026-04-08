const express = require('express');
const router = express.Router();
const { getDocumentTypes, createDocumentType, deleteDocumentType, updateDocumentType } = require('../controllers/documentTypeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getDocumentTypes)
  .post(protect, authorize('admin'), createDocumentType);

router.route('/:id')
  .patch(protect, authorize('admin'), updateDocumentType)
  .delete(protect, authorize('admin'), deleteDocumentType);

module.exports = router;