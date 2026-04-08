const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');

const createAuditLog = async (documentId, userId, action, options = {}) => {
  await AuditLog.create({
    document: documentId,
    user: userId,
    action,
    fromStatus: options.fromStatus,
    toStatus: options.toStatus,
    comment: options.comment,
  });
};

const createDocument = async (req, res) => {
  try {
    const { title, direction, type, counterparty, dueDate } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) settings = { maxUploadFiles: 10 };
    if (req.files && req.files.length > settings.maxUploadFiles) {
        return res.status(400).json({ message: `Перевищено ліміт. Максимум дозволено файлів: ${settings.maxUploadFiles}` });
    }

    const files = req.files ? req.files.map(f => ({
      originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      mimeType: f.mimetype,
      size: f.size,
      path: `/uploads/${f.filename}`
    })) : [];

    const document = await Document.create({
      title, direction, type, counterparty, dueDate,
      department: req.user.department || 'Без відділу', // Прив'язуємо документ до відділу автора
      creator: req.user._id,
      status: 'draft',
      files
    });

    await createAuditLog(document._id, req.user._id, 'create');
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error creating document', error: error.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    
    const { type, status, search, direction } = req.query;

    // Застосування фільтрів
    if (type) filter.type = type;
    if (direction) filter.direction = direction;

    // Пошук тексту (назва або контрагент)
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { counterparty: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role-based access and Status handling
    if (req.user.role === 'employee') {
      filter.creator = req.user._id;
      if (status) filter.status = status;
    } else if (req.user.role === 'signatory') {
      // Підписант бачить документи в роботі ТІЛЬКИ свого відділу
      filter.status = 'in_progress';
      filter.department = req.user.department;
    } else {
      // Для Manager та Admin
      if (status) filter.status = status;
      // Менеджер бачить документи тільки свого відділу
      if (req.user.role === 'manager') filter.department = req.user.department;
    }

    const documents = await Document.find(filter)
      .populate('creator', 'fullName')
      .populate('manager', 'fullName')
      .populate('signatory', 'fullName')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('creator', 'fullName department')
      .populate('manager', 'fullName department')
      .populate('signatory', 'fullName department');

    if (!document || document.isDeleted) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Access check
    if (req.user.role === 'employee' && document.creator._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const submitDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.creator.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Denied' });
    if (!['draft', 'rejected'].includes(doc.status)) return res.status(400).json({ message: 'Invalid status' });

    const oldStatus = doc.status;
    doc.status = 'under_review';
    await doc.save();

    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: oldStatus, toStatus: 'under_review' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const approveDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'under_review') return res.status(400).json({ message: 'Document must be under review' });

    doc.status = 'in_progress';
    doc.manager = req.user._id;
    await doc.save();

    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'under_review', toStatus: 'in_progress' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const rejectDocument = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'Comment is required to reject' });

    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'under_review') return res.status(400).json({ message: 'Document must be under review' });

    doc.status = 'rejected';
    doc.manager = req.user._id;
    await doc.save();

    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'under_review', toStatus: 'rejected', comment });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const signDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'in_progress') return res.status(400).json({ message: 'Document must be in progress first' });

    doc.status = 'completed';
    doc.signatory = req.user._id;
    await doc.save();
    
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'in_progress', toStatus: 'completed', comment: 'Signed with mock KEP / Completed' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const archiveDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'completed') return res.status(400).json({ message: 'Document must be completed first' });

    doc.status = 'archived';
    await doc.save();
    
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'completed', toStatus: 'archived' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const uploadFiles = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.creator.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Denied' });
    if (!['draft', 'rejected'].includes(doc.status)) return res.status(400).json({ message: 'Cannot attach files at this stage' });

    if (req.files) {
      let settings = await Settings.findOne();
      if (!settings) settings = { maxUploadFiles: 10 };
      if ((doc.files.length + req.files.length) > settings.maxUploadFiles) {
          return res.status(400).json({ message: `Перевищено ліміт. Дозволено додати ще максимум ${settings.maxUploadFiles - doc.files.length} файлів.` });
      }

      const newFiles = req.files.map(f => ({
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        mimeType: f.mimetype,
        size: f.size,
        path: `/uploads/${f.filename}`
      }));
      doc.files.push(...newFiles);
      await doc.save();
      await createAuditLog(doc._id, req.user._id, 'file_upload', { comment: `Uploaded ${newFiles.length} files` });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getDocumentAudit = async (req, res) => {
    try {
        const logs = await AuditLog.find({ document: req.params.id })
            .populate('user', 'fullName role')
            .sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });

        if (req.user.role === 'employee' && doc.status !== 'draft') {
            return res.status(403).json({ message: 'Only drafts can be deleted' });
        }

        doc.isDeleted = true;
        await doc.save();
        
        await createAuditLog(doc._id, req.user._id, 'delete');
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteFile = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Document not found' });

        // Перевірка прав
        if (req.user.role === 'employee' && doc.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (!['draft', 'rejected'].includes(doc.status)) {
            return res.status(400).json({ message: 'Cannot delete files at this stage' });
        }

        const fileIndex = doc.files.findIndex(f => f._id.toString() === req.params.fileId);
        if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });

        const fileName = doc.files[fileIndex].originalName;
        doc.files.splice(fileIndex, 1);
        await doc.save();
        
        await createAuditLog(doc._id, req.user._id, 'file_delete', { comment: `Видалено файл: ${fileName}` });
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
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
  uploadFiles,
  deleteFile
};
