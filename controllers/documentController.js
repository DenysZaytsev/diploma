const crypto = require('crypto');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const SystemAuditLog = require('../models/SystemAuditLog');
const User = require('../models/User');
const { sendSystemEmail } = require('../utils/emailService');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const logSystemAction = async (user, action, targetEmail, details) => {
    try {
        await SystemAuditLog.create({
            adminId: user._id,
            adminName: user.fullName,
            adminEmail: user.email,
            action,
            targetEmail,
            details
        });
    } catch (err) {
        console.error('System Audit Log Error:', err);
    }
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

    const deptPrefixMap = {
        'Фінансовий відділ': 'FIN',
        'IT відділ': 'ITD',
        'HR відділ': 'HRD',
        'Маркетинг': 'MRK',
        'Юридичний відділ': 'LEG'
    };
    const deptPrefix = deptPrefixMap[req.user.department] || 'DOC';

    let document;
    for (let attempt = 0; attempt < 5; attempt++) {
      const regNumber = `${deptPrefix}-${crypto.randomInt(100000, 999999)}`;
      try {
        document = await Document.create({
          title, direction, type, counterparty, dueDate,
          regNumber,
          department: req.user.department || 'Без відділу',
          creator: req.user._id,
          status: 'draft',
          files
        });
        break;
      } catch (err) {
        if (err.code === 11000 && attempt < 4) continue;
        throw err;
      }
    }

    if (!document) {
      return res.status(500).json({ message: 'Не вдалося згенерувати унікальний реєстраційний номер' });
    }

    await createAuditLog(document._id, req.user._id, 'create');
    res.status(201).json(document);
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ message: 'Помилка створення документа' });
  }
};

const getDocuments = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    
    const { type, status, search, direction, department, deadlineBefore, createdFrom, createdTo } = req.query;

    // Застосування фільтрів
    if (type) filter.type = type;
    if (direction) filter.direction = direction;
    if (department) filter.department = department; // Користувачі з відповідними правами можуть фільтрувати по іншим відділам

    if (deadlineBefore) filter.dueDate = { $lte: new Date(deadlineBefore) };

    if (createdFrom || createdTo) {
        filter.createdAt = {};
        if (createdFrom) filter.createdAt.$gte = new Date(createdFrom);
        if (createdTo) filter.createdAt.$lte = new Date(new Date(createdTo).setHours(23, 59, 59, 999));
    }

    // Пошук тексту (Назва, Контрагент, ID, Відповідальна особа)
    if (search) {
      const safeSearch = escapeRegex(search);
      const matchingUsers = await User.find({ fullName: { $regex: safeSearch, $options: 'i' } }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      filter.$or = [
        { regNumber: { $regex: safeSearch, $options: 'i' } },
        { title: { $regex: safeSearch, $options: 'i' } },
        { counterparty: { $regex: safeSearch, $options: 'i' } },
        { creator: { $in: userIds } },
        { approver: { $in: userIds } },
        { signatory: { $in: userIds } }
      ];
    }
    
    // Role-based access and Status handling
    if (req.user.role === 'employee') {
      filter.creator = req.user._id;
      if (status) filter.status = status;
    } else {
      // Для Approver, Signatory та Admin
      if (status) filter.status = status;
      // Вони бачать документи всіх відділів (прозорий реєстр). Фільтрація по відділу працює через req.query.department.
    }

    const documents = await Document.find(filter)
      .populate('creator', 'fullName')
      .populate('approver', 'fullName')
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
      .populate('approver', 'fullName department')
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

const updateDocument = async (req, res) => {
  try {
    const { title, counterparty, dueDate } = req.body;
    const doc = await Document.findById(req.params.id);
    
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.creator.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Denied' });
    if (!['draft', 'rejected'].includes(doc.status)) return res.status(400).json({ message: 'Документ можна редагувати лише в статусі чернетки або коли його відхилено' });

    let changes = [];
    if (title && title !== doc.title) { changes.push('Назва'); doc.title = title; }
    if (counterparty !== undefined && counterparty !== doc.counterparty) { changes.push('Контрагент'); doc.counterparty = counterparty; }
    if (dueDate !== undefined) {
        const newDate = dueDate ? new Date(dueDate) : null;
        const oldDate = doc.dueDate ? new Date(doc.dueDate) : null;
        if (newDate?.getTime() !== oldDate?.getTime()) {
            changes.push('Дедлайн');
            doc.dueDate = newDate;
        }
    }

    await doc.save();
    if (changes.length > 0) {
        await createAuditLog(doc._id, req.user._id, 'update', { comment: `Оновлено поля: ${changes.join(', ')}` });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'Коментар не може бути порожнім' });
    
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    
    // Перевірка доступу (користувач повинен мати право переглядати цей документ)
    if (req.user.role === 'employee' && doc.creator.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
    if (['approver', 'signatory'].includes(req.user.role) && req.user.department !== doc.department) return res.status(403).json({ message: 'Access denied' });

    await createAuditLog(doc._id, req.user._id, 'comment', { comment });
    res.json({ message: 'Коментар додано' });
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
    doc.status = 'on_approval';
    await doc.save();

    await logSystemAction(req.user, 'Призначення документа', 'Керівник відділу', `Документ ${doc.regNumber} (${doc.title}) відправлено на погодження`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: oldStatus, toStatus: 'on_approval' });
    
    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    const approvers = await User.find({ role: 'approver', department: doc.department }).select('email notifications');
    const emails = approvers.filter(a => a.notifications?.onNewTask !== false).map(a => a.email);
    if (emails.length > 0) {
        await sendSystemEmail(emails, 'Новий документ на погодження', `Документ <b>${doc.title}</b> (${doc.regNumber}) очікує на ваше погодження у системі EDMS.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const approveDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'on_approval') return res.status(400).json({ message: 'Document must be on approval' });
    if (req.user.role === 'approver' && doc.department !== req.user.department) {
        return res.status(403).json({ message: 'Ви можете погоджувати документи лише свого відділу' });
    }

    // Автоматичний перехід approved -> on_signing
    doc.status = 'on_signing';
    doc.approver = req.user._id;
    await doc.save();

    await logSystemAction(req.user, 'Призначення документа', 'Підписант', `Документ ${doc.regNumber} (${doc.title}) погоджено та передано на підписання`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'on_approval', toStatus: 'on_signing', comment: 'Погоджено. Автоматично передано на підписання.' });
    
    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    const signatories = await User.find({ role: 'signatory', department: doc.department }).select('email notifications');
    const emails = signatories.filter(s => s.notifications?.onNewTask !== false).map(s => s.email);
    if (emails.length > 0) {
        await sendSystemEmail(emails, 'Документ очікує на підпис', `Документ <b>${doc.title}</b> (${doc.regNumber}) було погоджено керівником і тепер очікує на ваш електронний підпис.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    
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
    if (!['on_approval', 'on_signing'].includes(doc.status)) return res.status(400).json({ message: 'Document must be on approval or on signing' });
    if (req.user.role === 'approver' && doc.department !== req.user.department) {
        return res.status(403).json({ message: 'Ви можете відхиляти документи лише свого відділу' });
    }

    const oldStatus = doc.status;
    doc.status = 'rejected';

    if (oldStatus === 'on_approval') doc.approver = req.user._id;
    if (oldStatus === 'on_signing') doc.signatory = req.user._id;

    await doc.save();

    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications');
    const targetEmail = docWithPopulated.creator ? docWithPopulated.creator.email : 'Ініціатор';

    await logSystemAction(req.user, 'Призначення документа', targetEmail, `Документ ${doc.regNumber} (${doc.title}) відхилено та повернуто ініціатору`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: oldStatus, toStatus: 'rejected', comment });
    
    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    // Сповіщаємо тільки ініціатора, якому потрібно виправити документ
    if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.creator.email, 'Документ відхилено', `Документ <b>${doc.title}</b> (${doc.regNumber}) було відхилено.<br><br><b>Причина:</b> ${comment}<br><br>Будь ласка, виправте зауваження та відправте документ повторно.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const signDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'on_signing') return res.status(400).json({ message: 'Document must be on signing first' });
    if (req.user.role === 'signatory' && doc.department !== req.user.department) {
        return res.status(403).json({ message: 'Ви можете підписувати документи лише свого відділу' });
    }

    doc.status = 'signed';
    doc.signatory = req.user._id;
    await doc.save();
    
    await logSystemAction(req.user, 'Призначення документа', 'Архів / Система', `Документ ${doc.regNumber} (${doc.title}) успішно підписано КЕП`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'on_signing', toStatus: 'signed', comment: 'Накладено КЕП' });
    
    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications').populate('approver', 'email notifications');
    if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.creator.email, 'Документ успішно підписано', `Ваш документ <b>${doc.title}</b> (${doc.regNumber}) було успішно підписано.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    if (docWithPopulated.approver && docWithPopulated.approver.email && docWithPopulated.approver.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.approver.email, 'Документ успішно підписано', `Документ <b>${doc.title}</b> (${doc.regNumber}), який ви погодили, було успішно підписано КЕП. Тепер ви можете перемістити його до архіву.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const archiveDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'signed') return res.status(400).json({ message: 'Document must be signed first' });

    doc.status = 'archived';
    await doc.save();
    
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'signed', toStatus: 'archived' });
    
    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;
    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications');
    
    if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.creator.email, 'Документ переміщено в архів', `Життєвий цикл документа <b>${doc.title}</b> (${doc.regNumber}) успішно завершено. Документ переміщено в архів.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    
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
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });

        if (req.user.role === 'employee' && doc.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

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
  updateDocument,
  addComment,
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
