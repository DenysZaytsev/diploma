const path = require('path');
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
const { sendToUser } = require('../utils/socket');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createAuditLog = async (documentId, userId, action, options = {}) => {
  let comment = options.comment;
  try {
    const doc = await Document.findById(documentId).select('creator department status');
    if (doc) {
      const creatorId = doc.creator ? doc.creator.toString() : null;
      if (creatorId && creatorId !== userId.toString()) {
        const now = new Date();
        const delegation = await Delegation.findOne({
          delegator: creatorId,
          delegate: userId,
          isActive: true,
          dateFrom: { $lte: now },
          dateTo: { $gte: now }
        }).populate('delegator', 'fullName');
        if (delegation && delegation.delegator) {
          const suffix = ` (за делегуванням від ${delegation.delegator.fullName})`;
          if (!comment) {
            comment = suffix.trim();
          } else if (!comment.includes(suffix)) {
            comment += suffix;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in createAuditLog delegation append:', err);
  }

  await AuditLog.create({
    document: documentId,
    user: userId,
    action,
    fromStatus: options.fromStatus,
    toStatus: options.toStatus,
    comment,
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
        const notif = await Notification.create({ recipient: recipientId, type, title, message, documentId });
        
        // Emit real-time socket event
        sendToUser(recipientId, 'notification', {
            _id: notif._id,
            type,
            title,
            message,
            documentId,
            createdAt: notif.createdAt,
            isRead: false
        });
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

// Перевіряє, чи має користувач право редагувати чернетку (як автор або як активний делегат автора)
const checkDraftEditAccess = async (document, user) => {
    const creatorId = document.creator._id ? document.creator._id.toString() : document.creator.toString();
    if (creatorId === user._id.toString()) {
        return true;
    }
    
    // Перевіряємо, чи є користувач активним делегатом автора (обидва мають бути employee з одного відділу)
    if (user.role === 'employee') {
        const now = new Date();
        const delegation = await Delegation.findOne({
            delegator: creatorId,
            delegate: user._id,
            role: 'employee',
            isActive: true,
            dateFrom: { $lte: now },
            dateTo: { $gte: now }
        });
        if (delegation) {
            return true;
        }
    }
    return false;
};

const createDocument = async (req, res) => {
  try {
    const { title, direction, type, counterparty, dueDate, tags, confidentiality, approverId, signatoryId, description } = req.body;

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
        parsedTags = (Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',') : [tags])).map(t => String(t).trim()).filter(Boolean);
    }

    let document;
    for (let attempt = 0; attempt < 5; attempt++) {
      const regNumber = `${deptPrefix}-${crypto.randomInt(100000, 999999)}`;
      try {
        document = await Document.create({
          title, direction, type, counterparty, dueDate,
          regNumber,
          description: description || '',
          department: req.user.department || 'Без відділу',
          creator: req.user._id,
          approver: approverId || null,
          signatory: signatoryId || null,
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
    const { type, status, search, direction, department, deadlineBefore, createdFrom, createdTo, tags, confidentiality, overdue, myDocs, ownDocs, delegatedDocs, inProgress, isDeleted } = req.query;

    const filter = { isDeleted: isDeleted === 'true' };

    // Синхронізація статистики: якщо myDocs=true, показуємо лише документи поточного юзера або делеговані йому
    // Винесемо логіку в ролеві фільтри нижче для точної відповідності

    if (type) filter.type = type;
    if (direction) filter.direction = direction;
    if (department) filter.department = department;
    if (confidentiality) filter.confidentiality = confidentiality;

    if (deadlineBefore) filter.dueDate = { $lte: new Date(deadlineBefore) };

    // "В роботі": статуси в процесі (без підписаних/архівних/чернеток/відхилених)
    if (inProgress === 'true') {
        filter.status = { $in: ['on_approval', 'on_signing'] };
    }

    // Прострочені: є дедлайн, він у минулому, і документ ще в роботі
    if (overdue === 'true') {
        filter.dueDate = { $lt: new Date(), $ne: null };
        if (!filter.$and) filter.$and = [];
        filter.$and.push({ status: { $nin: ['draft', 'signed', 'archived'] } });
    }

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

      // Знаходимо всі AuditLog з коментарями, які відповідають пошуковому запиту
      const matchingAuditLogs = await AuditLog.find({
        action: 'comment',
        comment: { $regex: safeSearch, $options: 'i' }
      }).select('document');
      const docIdsFromComments = matchingAuditLogs.map(log => log.document);

      const searchConditions = {
        $or: [
          { _id: { $in: docIdsFromComments } },
          { regNumber: { $regex: safeSearch, $options: 'i' } },
          { title: { $regex: safeSearch, $options: 'i' } },
          { counterparty: { $regex: safeSearch, $options: 'i' } },
          { tags: { $regex: safeSearch, $options: 'i' } },
          { department: { $regex: safeSearch, $options: 'i' } },
          { type: { $regex: safeSearch, $options: 'i' } },
          { confidentiality: { $regex: safeSearch, $options: 'i' } },
          { textContent: { $regex: safeSearch, $options: 'i' } },
          { creator: { $in: userIds } },
          { approver: { $in: userIds } },
          { signatory: { $in: userIds } }
        ]
      };
      if (!filter.$and) filter.$and = [];
      filter.$and.push(searchConditions);
    }

    // Role-based access
    const now = new Date();
    const myDelegations = await Delegation.find({
        delegate: req.user._id,
        isActive: true,
        dateFrom: { $lte: now },
        dateTo: { $gte: now }
    });
    const delegatedDepts = myDelegations.map(d => d.department);
    const accessibleDepts = [req.user.department, ...delegatedDepts].filter(Boolean);

    if (req.user.role === 'employee') {
      // Find active delegators for the current user
      const activeDelegations = await Delegation.find({
        delegate: req.user._id,
        role: 'employee',
        isActive: true,
        dateFrom: { $lte: now },
        dateTo: { $gte: now }
      });
      const delegatorIds = activeDelegations.map(d => d.delegator);

      let targetCreators = [];
      if (ownDocs === 'true' && delegatedDocs === 'true') {
        targetCreators = [req.user._id, ...delegatorIds];
      } else if (ownDocs === 'true') {
        targetCreators = [req.user._id];
      } else if (delegatedDocs === 'true') {
        targetCreators = delegatorIds;
      } else {
        targetCreators = [req.user._id, ...delegatorIds]; // default fallback
      }

      if (myDocs === 'true' || ownDocs === 'true' || delegatedDocs === 'true') {
        // Dashboard drill-down / explicit ownership filtering
        filter.creator = { $in: targetCreators };
        if (status) {
            filter.status = status;
        }
      } else {
        // Normal registry: show own/delegated docs + signed/archived public docs from others
        const accessConditions = {
          $or: [
              { creator: { $in: [req.user._id, ...delegatorIds] } },
              { department: req.user.department, status: { $in: ['signed', 'archived'] }, confidentiality: { $in: ['public', 'internal'] } }
          ]
        };
        if (!filter.$and) filter.$and = [];
        filter.$and.push(accessConditions);
        if (status) {
            filter.status = status;
        }
      }
    } else {
      if (myDocs === 'true' || ownDocs === 'true' || delegatedDocs === 'true') {
        // Dashboard drill-down for non-employee roles
        if (req.user.role === 'signatory') {
          filter.status = status || 'on_signing';
          filter.department = { $in: accessibleDepts };
        } else if (req.user.role === 'approver') {
          if (status) filter.status = status;
          filter.department = { $in: accessibleDepts };
        } else if (req.user.role === 'admin') {
          if (status) filter.status = status;
        }
      } else {
        if (status) filter.status = status;
      }

      // Privacy and Confidentiality filter: hide drafts of others, and hide secret ops outside dept
      if (req.user.role !== 'admin') {
          if (!filter.$and) filter.$and = [];
          
          filter.$and.push({
              $or: [
                  { creator: req.user._id },
                  { status: { $ne: 'draft' } }
              ]
          });

          filter.$and.push({
              $or: [
                  { confidentiality: { $ne: 'secret' } },
                  { department: { $in: accessibleDepts } }
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

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const creatorId = document.creator._id ? document.creator._id.toString() : document.creator.toString();

    if (req.user.role === 'employee') {
        const isCreator = creatorId === req.user._id.toString();
        // Employee can view their own documents, **and** signed/archived documents that are marked
        // as public or internal (i.e., not secret). Delegated access is also respected.
        const isPublic = ['signed', 'archived'].includes(document.status) && ['public', 'internal'].includes(document.confidentiality);
        const hasDelegatedEdit = await checkDraftEditAccess(document, req.user);
        if (!isCreator && !isPublic && !hasDelegatedEdit) {
            return res.status(403).json({ message: 'Access denied' });
        }
    }

    if (req.user.role !== 'admin' && document.status === 'draft') {
        const hasDelegatedEdit = await checkDraftEditAccess(document, req.user);
        if (creatorId !== req.user._id.toString() && !hasDelegatedEdit) {
             return res.status(403).json({ message: 'Access denied to this draft' });
        }
    }
    
    if (req.user.role !== 'admin' && document.confidentiality === 'secret' && document.department !== req.user.department) {
         // Якщо це секретний документ іншого відділу, але є активне делегування від автора — дозволяємо перегляд
         const hasDelegatedEdit = await checkDraftEditAccess(document, req.user);
         if (!hasDelegatedEdit) {
             return res.status(403).json({ message: 'Access denied due to confidentiality' });
         }
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateDocument = async (req, res) => {
  try {
    const { title, description, counterparty, dueDate, tags, confidentiality } = req.body;
    const doc = await Document.findById(req.params.id);

    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    
    // Оптимістичне блокування (Optimistic Locking)
    if (req.body.updatedAt && doc.updatedAt) {
        const clientDate = new Date(req.body.updatedAt);
        const serverDate = new Date(doc.updatedAt);
        // Допускаємо похибку в 1 секунду для уникнення проблем з парсингом
        if (clientDate.getTime() + 1000 < serverDate.getTime()) {
            return res.status(409).json({ 
                message: 'Конфлікт редагування: Документ було змінено іншим користувачем. Оновіть сторінку, щоб побачити актуальну версію.' 
            });
        }
    }

    const hasAccess = await checkDraftEditAccess(doc, req.user);
    if (!hasAccess) return res.status(403).json({ message: 'Denied' });
    
    if (!['draft', 'rejected'].includes(doc.status)) return res.status(400).json({ message: 'Документ можна редагувати лише в статусі чернетки або коли його відхилено' });

    let changes = [];
    if (title && title !== doc.title) { changes.push('Назва'); doc.title = title; }
    if (description !== undefined && description !== doc.description) { changes.push('Опис'); doc.description = description; }
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
        const newTags = (Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',') : [tags])).map(t => String(t).trim()).filter(Boolean);
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

    if (req.user.role === 'employee') {
        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (!hasAccess) return res.status(403).json({ message: 'Access denied' });
    }
    if (['approver', 'signatory'].includes(req.user.role) && req.user.department !== doc.department) {
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: req.user.role,
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        });
        if (!delegation) {
            return res.status(403).json({ message: 'Access denied' });
        }
    }

    await createAuditLog(doc._id, req.user._id, 'comment', { comment });

    // Збираємо список усіх учасників документа для сповіщення
    const participants = new Set();
    participants.add(doc.creator.toString());

    if (doc.approver) {
        participants.add(doc.approver.toString());
    } else if (['on_approval', 'on_signing', 'signed', 'rejected', 'archived'].includes(doc.status)) {
        const approvers = await User.find({ role: 'approver', department: doc.department }).select('_id');
        approvers.forEach(a => participants.add(a._id.toString()));
        const activeApprDelegate = await findActiveDelegate(doc.department, 'approver');
        if (activeApprDelegate) participants.add(activeApprDelegate._id.toString());
    }

    if (doc.signatory) {
        participants.add(doc.signatory.toString());
    } else if (['on_signing', 'signed', 'archived'].includes(doc.status)) {
        const signatories = await User.find({ role: 'signatory', department: doc.department }).select('_id');
        signatories.forEach(s => participants.add(s._id.toString()));
        const activeSignDelegate = await findActiveDelegate(doc.department, 'signatory');
        if (activeSignDelegate) participants.add(activeSignDelegate._id.toString());
    }

    participants.delete(req.user._id.toString());

    for (const pId of participants) {
        const pUser = await User.findById(pId).select('notifications email');
        if (pUser && pUser.notifications?.onComment !== false) {
            await createNotification(
                pUser._id, 
                'comment', 
                'Новий коментар', 
                `${req.user.fullName} додав коментар до документа ${doc.regNumber}`, 
                doc._id
            );
        }
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
    
    const hasAccess = await checkDraftEditAccess(doc, req.user);
    if (!hasAccess) return res.status(403).json({ message: 'Denied' });
    
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
    if (req.user.role === 'admin') return res.status(403).json({ message: 'Адміністратори не можуть здійснювати погодження або підписання документів' });
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'on_approval') return res.status(400).json({ message: 'Document must be on approval' });

    let isDelegated = false;
    let delegatorName = '';
    // Check department access (own department + active delegation)
    if (req.user.role === 'approver' && doc.department !== req.user.department) {
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'approver',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        }).populate('delegator', 'fullName');
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете погоджувати документи лише свого відділу' });
        }
        isDelegated = true;
        delegatorName = delegation.delegator ? delegation.delegator.fullName : 'керівника';
    }

    doc.status = 'on_signing';
    doc.approver = req.user._id;
    await doc.save();

    await logSystemAction(req.user, 'Призначення документа', 'Підписант', `Документ ${doc.regNumber} (${doc.title}) погоджено та передано на підписання`);
    
    let auditComment = 'Погоджено. Автоматично передано на підписання.';
    if (isDelegated) {
        auditComment += ` (за делегуванням від ${delegatorName})`;
    }
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'on_approval', toStatus: 'on_signing', comment: auditComment });

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
    if (req.user.role === 'admin') return res.status(403).json({ message: 'Адміністратори не можуть здійснювати погодження або підписання документів' });
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'Comment is required to reject' });

    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (!['on_approval', 'on_signing'].includes(doc.status)) return res.status(400).json({ message: 'Document must be on approval or on signing' });
    
    let isDelegated = false;
    let delegatorName = '';

    if (req.user.role === 'approver' && doc.department !== req.user.department) {
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'approver',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        }).populate('delegator', 'fullName');
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете відхиляти документи лише свого відділу' });
        }
        isDelegated = true;
        delegatorName = delegation.delegator ? delegation.delegator.fullName : 'керівника';
    }
    if (req.user.role === 'signatory' && doc.department !== req.user.department) {
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'signatory',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        }).populate('delegator', 'fullName');
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете відхиляти документи лише свого відділу' });
        }
        isDelegated = true;
        delegatorName = delegation.delegator ? delegation.delegator.fullName : 'підписанта';
    }

    const oldStatus = doc.status;
    doc.status = 'rejected';

    if (oldStatus === 'on_approval') doc.approver = req.user._id;
    if (oldStatus === 'on_signing') doc.signatory = req.user._id;

    await doc.save();

    const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications fullName _id');
    const targetEmail = docWithPopulated.creator ? docWithPopulated.creator.email : 'Ініціатор';

    await logSystemAction(req.user, 'Призначення документа', targetEmail, `Документ ${doc.regNumber} (${doc.title}) відхилено та повернуто ініціатору`);
    
    let auditComment = comment;
    if (isDelegated) {
        auditComment += ` (за делегуванням від ${delegatorName})`;
    }
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: oldStatus, toStatus: 'rejected', comment: auditComment });

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
    if (req.user.role === 'admin') return res.status(403).json({ message: 'Адміністратори не можуть здійснювати погодження або підписання документів' });
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'on_signing') return res.status(400).json({ message: 'Document must be on signing first' });
    
    let isDelegated = false;
    let delegatorName = '';

    if (req.user.role === 'signatory' && doc.department !== req.user.department) {
        const delegation = await Delegation.findOne({
            delegate: req.user._id, department: doc.department, role: 'signatory',
            isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
        }).populate('delegator', 'fullName');
        if (!delegation) {
            return res.status(403).json({ message: 'Ви можете підписувати документи лише свого відділу' });
        }
        isDelegated = true;
        delegatorName = delegation.delegator ? delegation.delegator.fullName : 'підписанта';
    }

    doc.status = 'signed';
    doc.signatory = req.user._id;
    await doc.save();

    await logSystemAction(req.user, 'Призначення документа', 'Архів / Система', `Документ ${doc.regNumber} (${doc.title}) успішно підписано КЕП`);
    
    let auditComment = 'Накладено КЕП';
    if (isDelegated) {
        auditComment += ` (за делегуванням від ${delegatorName})`;
    }
    await createAuditLog(doc._id, req.user._id, 'status_change', { fromStatus: 'on_signing', toStatus: 'signed', comment: auditComment });

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
    
    const hasAccess = await checkDraftEditAccess(doc, req.user);
    if (!hasAccess) return res.status(403).json({ message: 'Denied' });
    
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
        
        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (!hasAccess) return res.status(403).json({ message: 'Denied' });
        
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

        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (!hasAccess && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Denied' });
        }

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
        await createAuditLog(related._id, req.user._id, 'update', { comment: `Пов'язано з документом ${doc.regNumber}` });

        res.json(doc);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const unlinkRelatedDocument = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });

        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (!hasAccess && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Denied' });
        }

        const relatedId = req.params.relatedId;
        doc.relatedDocuments = doc.relatedDocuments.filter(id => id.toString() !== relatedId);
        await doc.save();

        // Remove reverse link
        const related = await Document.findById(relatedId);
        if (related) {
            related.relatedDocuments = related.relatedDocuments.filter(id => id.toString() !== doc._id.toString());
            await related.save();
        }

        await createAuditLog(doc._id, req.user._id, 'update', { comment: `Скасовано зв'язок з документом ${related ? related.regNumber : relatedId}` });
        if (related) {
            await createAuditLog(related._id, req.user._id, 'update', { comment: `Скасовано зв'язок з документом ${doc.regNumber}` });
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
                        const hasSubmitAccess = await checkDraftEditAccess(doc, req.user);
                        if (!hasSubmitAccess || !['draft', 'rejected'].includes(doc.status)) {
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

                    case 'approve':
                        if (req.user.role !== 'approver') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Тільки керівники можуть погоджувати документи' });
                            continue;
                        }
                        if (doc.status !== 'on_approval') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Документ має бути на погодженні' });
                            continue;
                        }

                        let isApproveDelegated = false;
                        let approveDelegatorName = '';
                        if (doc.department !== req.user.department) {
                            const delegation = await Delegation.findOne({
                                delegate: req.user._id, department: doc.department, role: 'approver',
                                isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
                            }).populate('delegator', 'fullName');
                            if (!delegation) {
                                results.failed++;
                                results.errors.push({ id: docId, error: 'Ви можете погоджувати документи лише свого відділу' });
                                continue;
                            }
                            isApproveDelegated = true;
                            approveDelegatorName = delegation.delegator ? delegation.delegator.fullName : 'керівника';
                        }

                        doc.status = 'on_signing';
                        doc.approver = req.user._id;
                        await doc.save();

                        await logSystemAction(req.user, 'Призначення документа', 'Підписант', `Документ ${doc.regNumber} (${doc.title}) погоджено та передано на підписання масово з реєстру`);

                        let approveAuditComment = 'Погоджено масово з реєстру.';
                        if (isApproveDelegated) {
                            approveAuditComment += ` (за делегуванням від ${approveDelegatorName})`;
                        }
                        await createAuditLog(doc._id, req.user._id, 'status_change', { 
                            fromStatus: 'on_approval', 
                            toStatus: 'on_signing', 
                            comment: approveAuditComment 
                        });

                        // Notifications / emails
                        try {
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
                        } catch (notifErr) {
                            console.error('Failed to send notifications in bulk approve:', notifErr);
                        }

                        results.success++;
                        break;

                    case 'sign':
                        if (req.user.role !== 'signatory') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Тільки підписанти можуть підписувати документи' });
                            continue;
                        }
                        if (doc.status !== 'on_signing') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Документ має бути на підписанні' });
                            continue;
                        }

                        let isSignDelegated = false;
                        let signDelegatorName = '';
                        if (doc.department !== req.user.department) {
                            const delegation = await Delegation.findOne({
                                delegate: req.user._id, department: doc.department, role: 'signatory',
                                isActive: true, dateFrom: { $lte: new Date() }, dateTo: { $gte: new Date() }
                            }).populate('delegator', 'fullName');
                            if (!delegation) {
                                results.failed++;
                                results.errors.push({ id: docId, error: 'Ви можете підписувати документи лише свого відділу' });
                                continue;
                            }
                            isSignDelegated = true;
                            signDelegatorName = delegation.delegator ? delegation.delegator.fullName : 'підписанта';
                        }

                        doc.status = 'signed';
                        doc.signatory = req.user._id;
                        await doc.save();

                        await logSystemAction(req.user, 'Призначення документа', 'Архів / Система', `Документ ${doc.regNumber} (${doc.title}) успішно підписано КЕП масово з реєстру`);

                        let signAuditComment = 'Накладено КЕП масово з реєстру.';
                        if (isSignDelegated) {
                            signAuditComment += ` (за делегуванням від ${signDelegatorName})`;
                        }
                        await createAuditLog(doc._id, req.user._id, 'status_change', { 
                            fromStatus: 'on_signing', 
                            toStatus: 'signed', 
                            comment: signAuditComment 
                        });

                        // Notifications / emails
                        try {
                            const docUrl = `${req.protocol}://${req.get('host')}/pages/document.html?id=${doc._id}`;
                            const docWithPopulated = await Document.findById(doc._id).populate('creator', 'email notifications fullName _id').populate('approver', 'email notifications fullName _id');
                            
                            if (docWithPopulated.creator && docWithPopulated.creator.email && docWithPopulated.creator.notifications?.onStatusChange !== false) {
                                await sendSystemEmail(docWithPopulated.creator.email, 'Документ успішно підписано', `Ваш документ <b>${doc.title}</b> (${doc.regNumber}) було успешно підписано.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
                            }
                            if (docWithPopulated.approver && docWithPopulated.approver.email && docWithPopulated.approver.notifications?.onStatusChange !== false) {
                                await sendSystemEmail(docWithPopulated.approver.email, 'Документ успішно підписано', `Документ <b>${doc.title}</b> (${doc.regNumber}), який ви погодили, було успішно підписано КЕП. Тепер ви можете перемістити його до архіву.<br><br><a href="${docUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Переглянути документ</a>`);
                            }

                            if (docWithPopulated.creator) {
                                await createNotification(docWithPopulated.creator._id, 'status_change', 'Документ підписано', `Ваш документ ${doc.regNumber} успішно підписано КЕП`, doc._id);
                            }
                            if (docWithPopulated.approver) {
                                await createNotification(docWithPopulated.approver._id, 'status_change', 'Документ підписано', `Документ ${doc.regNumber} (${doc.title}), який ви погодили, було підписано КЕП`, doc._id);
                            }
                        } catch (notifErr) {
                            console.error('Failed to send notifications in bulk sign:', notifErr);
                        }

                        results.success++;
                        break;

                    case 'delete':
                        const hasDeleteAccess = await checkDraftEditAccess(doc, req.user);
                        if (!hasDeleteAccess && req.user.role !== 'admin') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Access denied' });
                            continue;
                        }
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

                    case 'restore':
                        if (req.user.role !== 'admin' && doc.creator.toString() !== req.user._id.toString()) {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Access denied' });
                            continue;
                        }
                        doc.isDeleted = false;
                        await doc.save();
                        await createAuditLog(doc._id, req.user._id, 'update', { comment: 'Відновлено з кошика' });
                        results.success++;
                        break;

                    case 'hardDelete':
                        if (req.user.role !== 'admin') {
                            results.failed++;
                            results.errors.push({ id: docId, error: 'Тільки адміністратор може остаточно видаляти документи' });
                            continue;
                        }
                        const fs = require('fs');
                        if (doc.files) {
                            for (const file of doc.files) {
                                const filePath = path.join(__dirname, '..', file.path);
                                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                            }
                        }
                        if (doc.fileVersions) {
                            for (const fv of doc.fileVersions) {
                                const filePath = path.join(__dirname, '..', fv.path);
                                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                            }
                        }
                        await Document.deleteOne({ _id: doc._id });
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
        if (!doc) return res.status(404).json({ message: 'Not found' });

        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (req.user.role === 'employee' && !hasAccess) {
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

        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (!hasAccess && req.user.role !== 'admin') return res.status(403).json({ message: 'Denied' });

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

        const hasAccess = await checkDraftEditAccess(doc, req.user);
        if (!hasAccess && req.user.role !== 'admin') {
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

const downloadFile = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('creator', '_id department');
            
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
        
        // RDAC: Admins and SuperAdmins cannot download or view document content
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Адміністраторам заборонено скачувати або переглядати вміст документів згідно з політикою RDAC' });
        }

        if (req.user.role === 'employee') {
            const isCreator = doc.creator._id.toString() === req.user._id.toString();
            const isPublic = ['signed', 'archived'].includes(doc.status) && ['public', 'internal'].includes(doc.confidentiality);
            if (!isCreator && !isPublic) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }
        
        if (req.user.role !== 'admin' && doc.status === 'draft') {
            if (doc.creator._id.toString() !== req.user._id.toString()) {
                 return res.status(403).json({ message: 'Access denied' });
            }
        }
        
        if (req.user.role !== 'admin' && doc.confidentiality === 'secret' && doc.department !== req.user.department) {
             return res.status(403).json({ message: 'Access denied' });
        }

        const filename = req.params.filename;
        const filePath = path.join(__dirname, '../uploads', filename);
        
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const viewOfficeFile = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('creator', '_id department');
            
        if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
        
        // RDAC: Admins and SuperAdmins cannot download or view document content
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Адміністраторам заборонено скачувати або переглядати вміст документів згідно з політикою RDAC' });
        }

        if (req.user.role === 'employee') {
            const isCreator = doc.creator._id.toString() === req.user._id.toString();
            const isPublic = ['signed', 'archived'].includes(doc.status) && ['public', 'internal'].includes(doc.confidentiality);
            if (!isCreator && !isPublic) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }
        
        if (req.user.role !== 'admin' && doc.status === 'draft') {
            if (doc.creator._id.toString() !== req.user._id.toString()) {
                 return res.status(403).json({ message: 'Access denied' });
            }
        }
        
        if (req.user.role !== 'admin' && doc.confidentiality === 'secret' && doc.department !== req.user.department) {
             return res.status(403).json({ message: 'Access denied' });
        }

        const fs = require('fs');
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '../uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        const ext = path.extname(filename).toLowerCase();
        if (ext === '.docx') {
            const mammoth = require('mammoth');
            const result = await mammoth.convertToHtml({ path: filePath });
            
            const styledHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            line-height: 1.6;
                            color: #1e293b;
                            padding: 24px;
                            max-width: 800px;
                            margin: 0 auto;
                            background: white;
                        }
                        p { margin-bottom: 1.25em; }
                        h1, h2, h3, h4, h5, h6 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 700; }
                        table { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; }
                        table, th, td { border: 1px solid #cbd5e1; }
                        th, td { padding: 8px 12px; text-align: left; }
                        th { background-color: #f8fafc; }
                    </style>
                </head>
                <body>
                    <div class="office-preview-container">
                        ${result.value}
                    </div>
                </body>
                </html>
            `;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(styledHtml);
        } else if (ext === '.doc') {
            const docExtractor = require('../utils/textExtractor');
            const rawText = await docExtractor.extractTextFromFile(path.relative(path.join(__dirname, '..'), filePath));
            if (rawText) {
                const paragraphsHtml = rawText
                    .split('\n')
                    .map(p => p.trim() ? `<p>${p.trim()}</p>` : '')
                    .join('');
                
                const styledHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                                line-height: 1.6;
                                color: #1e293b;
                                padding: 24px;
                                max-width: 800px;
                                margin: 0 auto;
                                background: white;
                            }
                            p { margin-bottom: 1.25em; }
                        </style>
                    </head>
                    <body>
                        <div class="office-preview-container">
                            ${paragraphsHtml}
                        </div>
                    </body>
                    </html>
                `;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.send(styledHtml);
            }
            return res.status(400).json({ message: 'Помилка видобування вмісту з файлу .doc' });
        }

        res.status(400).json({ message: 'Формат файлу не підтримується для онлайн перегляду' });
    } catch (error) {
        console.error('Office view error:', error);
        res.status(500).json({ message: 'Помилка сервера при обробці документа' });
    }
};

const restoreDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || !doc.isDeleted) return res.status(404).json({ message: 'Document not found or not deleted' });
    
    // Only creator or admin can restore
    if (req.user.role !== 'admin' && doc.creator._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
    }

    doc.isDeleted = false;
    await doc.save();
    await createAuditLog(doc._id, req.user._id, 'update', { comment: 'Відновлено з кошика' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const hardDeleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || !doc.isDeleted) return res.status(404).json({ message: 'Document not found or not deleted' });

    // Only admin can hard delete
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Тільки адміністратор може остаточно видаляти документи' });
    }

    // Unlink files
    const fs = require('fs');
    if (doc.files) {
        for (const file of doc.files) {
            const filePath = path.join(__dirname, '..', file.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }
    if (doc.fileVersions) {
        for (const fv of doc.fileVersions) {
            const filePath = path.join(__dirname, '..', fv.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }

    await Document.deleteOne({ _id: doc._id });
    res.json({ message: 'Document permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  downloadFile,
  viewOfficeFile,
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
  bulkAction,
  restoreDocument,
  hardDeleteDocument
};
