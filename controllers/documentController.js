const crypto = require('crypto');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const SystemAuditLog = require('../models/SystemAuditLog');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Delegation = require('../models/Delegation');
const { sendSystemEmail } = require('../utils/emailService');
const { extractTextFromFiles } = require('../utils/textExtractor');

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

// Створення in-app notification
const createNotification = async (recipientId, type, title, message, documentId = null) => {
    try {
        await Notification.create({ recipient: recipientId, type, title, message, documentId });
    } catch (err) {
        console.error('Notification Error:', err);
    }
};

// Перевірка делегування — знаходить активного делегата
const findActiveDelegate = async (department, role) => {
    const now = new Date();
    const delegation = await Delegation.findOne({
        department,
        role,
        isActive: true,
        dateFrom: { $lte: now },
        dateTo: { $gte: now }
    }).populate('delegate', 'email notifications fullName');
    return delegation ? delegation.delegate : null;
};

const createDocument = async (req, res) => {
  try {
    const { title, direction, type, counterparty, dueDate, tags, confidentiality } = req.body;

    let settings = await Settings.findOne();
    if (!settings) settings = { maxUploadFiles: 10 };
    if (req.files && req.files.length > settings.maxUploadFiles) {
        return res.status(400).json({ message: `Перевищено ліміт. Максимум дозволено файлів: ${settings.maxUploadFiles}` });
    }

    const files = req.files ? req.files.map(f => ({
      originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      mimeType: f.mimetype,
      size: f.size,
      path: `/uploads/${f.filename}`,
      version: 1,
      uploadedBy: req.user._id
    })) : [];

    const deptPrefixMap = {
        'Фінансовий відділ': 'FIN',
        'IT відділ': 'ITD',
        'HR відділ': 'HRD',
        'Маркетинг': 'MRK',
        'Юридичний відділ': 'LEG'
    };
    const deptPrefix = deptPrefixMap[req.user.department] || 'DOC';

    // Parse tags
    let parsedTags = [];
    if (tags) {
        parsedTags = (typeof tags === 'string' ? tags.split(',') : tags).map(t => t.trim()).filter(Boolean);
    }

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
          files,
          tags: parsedTags,
          confidentiality: confidentiality || 'internal'
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

    // Background text extraction for full-text search
    if (files.length > 0) {
        extractTextFromFiles(files).then(text => {
            if (text) Document.findByIdAndUpdate(document._id, { textContent: text }).catch(() => {});
        }).catch(() => {});
    }

    res.status(201).json(document);
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ message: 'Помилка створення документа' });
  }
};

const getDocuments = async (req, res) => {
  try {
    const filter = { isDeleted: false };

    const { type, status, search, direction, department, deadlineBefore, createdFrom, createdTo, tags, confidentiality } = req.query;

    if (type) filter.type = type;
    if (direction) filter.direction = direction;
    if (department) filter.department = department;
    if (confidentiality) filter.confidentiality = confidentiality;

    if (deadlineBefore) filter.dueDate = { $lte: new Date(deadlineBefore) };

    if (createdFrom || createdTo) {
        filter.createdAt = {};
        if (createdFrom) filter.createdAt.$gte = new Date(createdFrom);
        if (createdTo) filter.createdAt.$lte = new Date(new Date(createdTo).setHours(23, 59, 59, 999));
    }

    // Tags filter
    if (tags) {
        const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tagList.length > 0) filter.tags = { $in: tagList };
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      const matchingUsers = await User.find({ fullName: { $regex: safeSearch, $options: 'i' } }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      filter.$or = [
        { regNumber: { $regex: safeSearch, $options: 'i' } },
        { title: { $regex: safeSearch, $options: 'i' } },
        { counterparty: { $regex: safeSearch, $options: 'i' } },
        { tags: { $regex: safeSearch, $options: 'i' } },
        { textContent: { $regex: safeSearch, $options: 'i' } },
        { creator: { $in: userIds } },
        { approver: { $in: userIds } },
        { signatory: { $in: userIds } }
      ];
    }

    // Role-based access
    if (req.user.role === 'employee') {
      filter.creator = req.user._id;
      if (status) filter.status = status;
    } else {
      if (status) filter.status = status;
      // Confidentiality filter: non-admins can only see 'secret' docs from their department
      if (req.user.role !== 'admin') {
          if (!filter.$and) filter.$and = [];
          filter.$and.push({
              $or: [
                  { confidentiality: { $ne: 'secret' } },
                  { department: req.user.department }
              ]
          });
      }
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
      .populate('signatory', 'fullName department')
      .populate('relatedDocuments', 'title regNumber status')
      .populate('files.uploadedBy', 'fullName')
      .populate('fileVersions.uploadedBy', 'fullName');

    if (!document || document.isDeleted) {
      return res.status(404).json({ message: 'Document not found' });
    }

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
    const { title, counterparty, dueDate, tags, confidentiality } = req.body;
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
    if (tags !== undefined) {
        const newTags = (typeof tags === 'string' ? tags.split(',') : (tags || [])).map(t => t.trim()).filter(Boolean);
        doc.tags = newTags;
        changes.push('Теги');
    }
    if (confidentiality && confidentiality !== doc.confidentiality) {
        doc.confidentiality = confidentiality;
        changes.push('Конфіденційність');
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

    if (req.user.role === 'employee' && doc.creator.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
    if (['approver', 'signatory'].includes(req.user.role) && req.user.department !== doc.department) return res.status(403).json({ message: 'Access denied' });

    await createAuditLog(doc._id, req.user._id, 'comment', { comment });

    // Notify creator about comment (if not self)
    if (doc.creator.toString() !== req.user._id.toString()) {
        await createNotification(doc.creator, 'comment', 'Новий коментар', `${req.user.fullName} додав коментар до документа ${doc.regNumber}`, doc._id);
    }

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

    const approvers = await User.find({ role: 'approver', department: doc.department }).select('email notifications fullName _id');

    // Check for active delegate
    const activeDelegate = await findActiveDelegate(doc.department, 'approver');

    const recipients = [...approvers];
    if (activeDelegate && !approvers.find(a => a._id.toString() === activeDelegate._id.toString())) {
        recipients.push(activeDelegate);
    }

    const emails = recipients.filter(a => a.notifications?.onNewTask !== false).map(a => a.email);
    if (emails.length > 0) {
        await sendSystemEmail(emails, 'Новий документ на погодження', `Документ <b>${doc.title}</b> (${doc.regNumber}) очікує на ваше погодження у системі EDMS.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }

    // In-app notifications
    for (const r of recipients) {
        await createNotification(r._id, 'new_task', 'Новий документ на погодження', `Документ ${doc.regNumber} (${doc.title}) очікує на ваше погодження`, doc._id);
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

    // Check department access (own department + active delegation)
    if (req.user.role === 'approver' && doc.department !== req.user.department) {
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'approver',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        });
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете погоджувати документи лише свого відділу' });
        }
    }

    doc.status = 'on_signing';
    doc.approver = req.user._id;
    await doc.save();

    await logSystemAction(req.user, 'Призначення документа', 'Підписант', `Документ ${doc.regNumber} (${doc.title}) погоджено та передано на підписання`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'on_approval', toStatus: 'on_signing', comment: 'Погоджено. Автоматично передано на підписання.' });

    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    const signatories = await User.find({ role: 'signatory', department: doc.department }).select('email notifications fullName _id');
    const activeDelegate = await findActiveDelegate(doc.department, 'signatory');
    const recipients = [...signatories];
    if (activeDelegate && !signatories.find(s => s._id.toString() === activeDelegate._id.toString())) {
        recipients.push(activeDelegate);
    }

    const emails = recipients.filter(s => s.notifications?.onNewTask !== false).map(s => s.email);
    if (emails.length > 0) {
        await sendSystemEmail(emails, 'Документ очікує на підпис', `Документ <b>${doc.title}</b> (${doc.regNumber}) було погоджено керівником і тепер очікує на ваш електронний підпис.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }

    for (const r of recipients) {
        await createNotification(r._id, 'new_task', 'Документ очікує на підпис', `Документ ${doc.regNumber} (${doc.title}) очікує на ваш підпис`, doc._id);
    }

    // Notify creator
    await createNotification(doc.creator, 'status_change', 'Документ погоджено', `Ваш документ ${doc.regNumber} було погоджено та передано на підписання`, doc._id);

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
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'approver',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        });
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете відхиляти документи лише свого відділу' });
        }
    }

    const oldStatus = doc.status;
    doc.status = 'rejected';

    if (oldStatus === 'on_approval') doc.approver = req.user._id;
    if (oldStatus === 'on_signing') doc.signatory = req.user._id;

    await doc.save();

    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications fullName _id');
    const targetEmail = docWithPopulated.creator ? docWithPopulated.creator.email : 'Ініціатор';

    await logSystemAction(req.user, 'Призначення документа', targetEmail, `Документ ${doc.regNumber} (${doc.title}) відхилено та повернуто ініціатору`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: oldStatus, toStatus: 'rejected', comment });

    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.creator.email, 'Документ відхилено', `Документ <b>${doc.title}</b> (${doc.regNumber}) було відхилено.<br><br><b>Причина:</b> ${comment}<br><br>Будь ласка, виправте зауваження та відправте документ повторно.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }

    // In-app notification
    if (docWithPopulated.creator) {
        await createNotification(docWithPopulated.creator._id, 'status_change', 'Документ відхилено', `Документ ${doc.regNumber} відхилено. Причина: ${comment}`, doc._id);
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
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'signatory',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        });
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете підписувати документи лише свого відділу' });
        }
    }

    doc.status = 'signed';
    doc.signatory = req.user._id;
    await doc.save();

    await logSystemAction(req.user, 'Призначення документа', 'Архів / Система', `Документ ${doc.regNumber} (${doc.title}) успішно підписано КЕП`);
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'on_signing', toStatus: 'signed', comment: 'Накладено КЕП' });

    const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;

    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications fullName _id').populate('approver', 'email notifications fullName _id');
    if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.creator.email, 'Документ успішно підписано', `Ваш документ <b>${doc.title}</b> (${doc.regNumber}) було успішно підписано.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }
    if (docWithPopulated.approver && docWithPopulated.approver.email && docWithPopulated.approver.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.approver.email, 'Документ успішно підписано', `Документ <b>${doc.title}</b> (${doc.regNumber}), який ви погодили, було успішно підписано КЕП. Тепер ви можете перемістити його до архіву.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }

    // In-app notifications
    if (docWithPopulated.creator) {
        await createNotification(docWithPopulated.creator._id, 'status_change', 'Документ підписано', `Ваш документ ${doc.regNumber} успішно підписано КЕП`, doc._id);
    }
    if (docWithPopulated.approver) {
        await createNotification(docWithPopulated.approver._id, 'status_change', 'Документ підписано', `Документ ${doc.regNumber}, який ви погодили, підписано`, doc._id);
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
    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications _id');

    if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
        await sendSystemEmail(docWithPopulated.creator.email, 'Документ переміщено в архів', `Життєвий цикл документа <b>${doc.title}</b> (${doc.regNumber}) успішно завершено. Документ переміщено в архів.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
    }

    if (docWithPopulated.creator) {
        await createNotification(docWithPopulated.creator._id, 'status_change', 'Документ в архіві', `Документ ${doc.regNumber} переміщено в архів`, doc._id);
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
        path: `/uploads/${f.filename}`,
        version: 1,
        uploadedBy: req.user._id
      }));
      doc.files.push(...newFiles);
      await doc.save();
      await createAuditLog(doc._id, req.user._id, 'file_upload', { comment: `Uploaded ${newFiles.length} files` });

      // Background text extraction
      extractTextFromFiles(newFiles).then(text => {
          if (text) {
              Document.findById(doc._id).select('+textContent').then(d => {
                  d.textContent = (d.textContent || '') + '\n\n' + text;
                  d.save().catch(() => {});
              }).catch(() => {});
          }
      }).catch(() => {});
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Feature 1: Replace file with new version
const replaceFile = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
        if (doc.creator.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Denied' });
        if (!['draft', 'rejected'].includes(doc.status)) return res.status(400).json({ message: 'Cannot replace files at this stage' });

        const fileIndex = doc.files.findIndex(f => f._id.toString() === req.params.fileId);
        if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
        if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No file provided' });

        const oldFile = doc.files[fileIndex];
        const newVersion = (oldFile.version || 1) + 1;

        // Move old file to version history
        doc.fileVersions.push({
            fileId: oldFile._id,
            originalName: oldFile.originalName,
            mimeType: oldFile.mimeType,
            size: oldFile.size,
            path: oldFile.path,
            version: oldFile.version || 1,
            uploadedAt: oldFile.uploadedAt,
            uploadedBy: oldFile.uploadedBy,
            replacedAt: new Date()
        });

        // Replace with new file
        const f = req.files[0];
        doc.files[fileIndex] = {
            _id: oldFile._id,
            originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
            mimeType: f.mimetype,
            size: f.size,
            path: `/uploads/${f.filename}`,
            version: newVersion,
            uploadedBy: req.user._id,
            uploadedAt: new Date()
        };

        await doc.save();
        await createAuditLog(doc._id, req.user._id, 'file_upload', { comment: `Замінено файл "${oldFile.originalName}" (v${oldFile.version || 1} → v${newVersion})` });

        res.json(doc);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Feature 6: Link/unlink related documents
const linkRelatedDocument = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });

        const { relatedId } = req.body;
        if (!relatedId) return res.status(400).json({ message: 'relatedId required' });

        const related = await Document.findById(relatedId);
        if (!related || related.isDeleted) return res.status(404).json({ message: 'Related document not found' });

        // Add bidirectional link
        if (!doc.relatedDocuments.includes(relatedId)) {
            doc.relatedDocuments.push(relatedId);
            await doc.save();
        }
        if (!related.relatedDocuments.includes(doc._id)) {
            related.relatedDocuments.push(doc._id);
            await related.save();
        }

        await createAuditLog(doc._id, req.user._id, 'update', { comment: `Пов'язано з документом ${related.regNumber}` });

        res.json(doc);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const unlinkRelatedDocument = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });

        const relatedId = req.params.relatedId;
        doc.relatedDocuments = doc.relatedDocuments.filter(id => id.toString() !== relatedId);
        await doc.save();

        // Remove reverse link
        const related = await Document.findById(relatedId);
        if (related) {
            related.relatedDocuments = related.relatedDocuments.filter(id => id.toString() !== doc._id.toString());
            await related.save();
        }

        res.json(doc);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Feature 13: Bulk operations
const bulkAction = async (req, res) => {
    try {
        const { documentIds, action } = req.body;
        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({ message: 'documentIds array required' });
        }
        if (documentIds.length > 50) {
            return res.status(400).json({ message: 'Максимум 50 документів за раз' });
        }

        const results = { success: 0, failed: 0, errors: [] };

        for (const docId of documentIds) {
            try {
                const doc = await Document.findById(docId);
                if (!doc || doc.isDeleted) {
                    results.failed++;
                    results.errors.push({ id: docId, error: 'Not found' });
                    continue;
                }

                switch (action) {
                    case 'submit':
                        if (doc.creator.toString() !== req.user._id.toString() || !['draft', 'rejected'].includes(doc.status)) {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Invalid state or access' });
                            continue;
                        }
                        const oldStatus = doc.status;
                        doc.status = 'on_approval';
                        await doc.save();
                        await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: oldStatus, toStatus: 'on_approval' });
                        results.success++;
                        break;

                    case 'delete':
                        if (req.user.role === 'employee' && doc.status !== 'draft') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Only drafts can be deleted' });
                            continue;
                        }
                        doc.isDeleted = true;
                        await doc.save();
                        await createAuditLog(doc._id, req.user._id, 'delete');
                        results.success++;
                        break;

                    default:
                        return res.status(400).json({ message: `Unknown action: ${action}` });
                }
            } catch (err) {
                results.failed++;
                results.errors.push({ id: docId, error: err.message });
            }
        }

        res.json(results);
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
  deleteFile,
  replaceFile,
  linkRelatedDocument,
  unlinkRelatedDocument,
  bulkAction
};
