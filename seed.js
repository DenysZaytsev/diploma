require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Document = require('./models/Document');
const AuditLog = require('./models/AuditLog');
const DocumentType = require('./models/DocumentType');
const Department = require('./models/Department');
const Notification = require('./models/Notification');
const SavedFilter = require('./models/SavedFilter');
const Delegation = require('./models/Delegation');
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected for Seeding');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const seedData = async () => {
    await connectDB();

    try {
        // Drop all collections to clear old indexes
        const collections = ['users', 'documents', 'auditlogs', 'documenttypes', 'departments', 'notifications', 'savedfilters', 'delegations'];
        for (const col of collections) {
            try { await mongoose.connection.db.dropCollection(col); } catch (e) {}
        }
        console.log('Database cleared');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);

        // ========== DEPARTMENTS ==========
        const depsData = [
            { name: 'Фінансовий відділ', description: 'Фінансовий облік, бюджетування та звітність' },
            { name: 'IT відділ', description: 'Інформаційні технології та технічна підтримка' },
            { name: 'HR відділ', description: 'Управління персоналом та кадрова політика' },
            { name: 'Маркетинг', description: 'Маркетинг, реклама та PR' },
            { name: 'Юридичний відділ', description: 'Юридичний супровід та договірна робота' }
        ];
        await Department.insertMany(depsData);
        console.log('Departments inserted');

        // ========== USERS ==========
        const users = [
            // IT (Admins)
            { email: 'oleksandr-it@gmail.com', passwordHash, role: 'admin', fullName: 'Олександр Зайцев', department: 'IT відділ', isSuperAdmin: true },
            { email: 'support-it@gmail.com', passwordHash, role: 'admin', fullName: 'Технічна Підтримка', department: 'IT відділ' },
            // Фінансовий відділ
            { email: 'olena-finance@gmail.com', passwordHash, role: 'approver', fullName: 'Олена Григоренко', department: 'Фінансовий відділ' },
            { email: 'viktor-finance@gmail.com', passwordHash, role: 'signatory', fullName: 'Віктор Мельник', department: 'Фінансовий відділ' },
            { email: 'iryna-finance@gmail.com', passwordHash, role: 'employee', fullName: 'Ірина Сидоренко', department: 'Фінансовий відділ' },
            { email: 'anton-finance@gmail.com', passwordHash, role: 'employee', fullName: 'Антон Бондар', department: 'Фінансовий відділ' },
            // Юридичний відділ
            { email: 'dmytro-legal@gmail.com', passwordHash, role: 'approver', fullName: 'Дмитро Ткаченко', department: 'Юридичний відділ' },
            { email: 'anna-legal@gmail.com', passwordHash, role: 'signatory', fullName: 'Анна Бойко', department: 'Юридичний відділ' },
            { email: 'petro-legal@gmail.com', passwordHash, role: 'employee', fullName: 'Петро Шевченко', department: 'Юридичний відділ' },
            // Маркетинг
            { email: 'kateryna-marketing@gmail.com', passwordHash, role: 'approver', fullName: 'Катерина Романчук', department: 'Маркетинг' },
            { email: 'tetiana-marketing@gmail.com', passwordHash, role: 'employee', fullName: 'Тетяна Лисенко', department: 'Маркетинг' },
            // HR
            { email: 'maria-hr@gmail.com', passwordHash, role: 'approver', fullName: 'Марія Коваль', department: 'HR відділ' },
            { email: 'serhiy-hr@gmail.com', passwordHash, role: 'employee', fullName: 'Сергій Павленко', department: 'HR відділ' },
        ];

        const createdUsers = await User.insertMany(users);
        console.log('Users inserted');

        // ========== DOCUMENT TYPES ==========
        const docTypesData = [
            { name: 'Договір', code: 'contract', description: 'Договори з контрагентами та партнерами' },
            { name: 'Акт', code: 'act', description: 'Акти виконаних робіт та приймання-передачі' },
            { name: 'Рахунок', code: 'invoice', description: 'Рахунки-фактури та рахунки на оплату' },
            { name: 'Декларація', code: 'declaration', description: 'Податкові та митні декларації' },
            { name: 'Наказ', code: 'order', description: 'Внутрішні накази та розпорядження' },
            { name: 'Службова записка', code: 'memo', description: 'Внутрішня кореспонденція' }
        ];
        await DocumentType.insertMany(docTypesData);
        console.log('Document types inserted');

        // ========== HELPERS ==========
        const approvers = createdUsers.filter(u => u.role === 'approver');
        const signatories = createdUsers.filter(u => u.role === 'signatory');
        const employees = createdUsers.filter(u => u.role === 'employee');

        const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

        // Read real files from uploads/
        let mockFiles = [];
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));
            mockFiles = files.map(f => {
                const stats = fs.statSync(path.join(uploadsDir, f));
                const ext = path.extname(f).toLowerCase();
                let mimeType = 'application/octet-stream';
                if (ext === '.pdf') mimeType = 'application/pdf';
                else if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
                else if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (ext === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                return { originalName: f, mimeType, size: stats.size, path: `/uploads/${f}` };
            });
        }
        if (mockFiles.length === 0) console.log('Warning: uploads folder is empty. Documents will be created without files.');

        const getRandomFiles = (creatorId) => {
            if (mockFiles.length === 0) return [];
            const count = Math.floor(Math.random() * 3) + 1;
            const shuffled = [...mockFiles].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count).map(f => ({
                ...f,
                version: 1,
                uploadedBy: creatorId,
                uploadedAt: new Date()
            }));
        };

        // ========== TITLES & TAGS ==========
        const titlesDict = {
            contract: [
                'Договір оренди приміщення №45-А',
                'Договір про надання консалтингових послуг',
                'Договір постачання обладнання №12/2024',
                'Трудовий контракт (шаблон)',
                'Договір про нерозголошення (NDA)',
                'Договір про розробку ПЗ',
                'Ліцензійний договір на ПЗ Oracle',
                'Договір страхування майна офісу'
            ],
            act: [
                'Акт приймання-передачі наданих послуг за березень',
                'Акт виконаних робіт (дизайн сайту)',
                'Акт звірки взаєморозрахунків за І квартал',
                'Акт списання матеріальних цінностей',
                'Акт інвентаризації ІТ-обладнання'
            ],
            invoice: [
                'Рахунок-фактура №1024 за ліцензії',
                'Рахунок на оплату послуг маркетингу',
                'Рахунок за оренду офісу (квітень)',
                'Рахунок №55 на закупівлю серверів',
                'Рахунок на оплату хостингу AWS'
            ],
            declaration: [
                'Податкова декларація платника єдиного податку',
                'Митна декларація (імпорт)',
                'Декларація про майновий стан і доходи',
                'Звіт з ЄСВ за І квартал'
            ],
            order: [
                'Наказ про затвердження штатного розпису',
                'Наказ про надання щорічної відпустки',
                'Наказ про відрядження за кордон',
                'Наказ про преміювання за результатами року',
                'Наказ про впровадження нової CRM-системи'
            ],
            memo: [
                'Службова записка щодо закупівлі техніки',
                'Службова записка про виділення бюджету на рекламу',
                'Службова записка про перенесення відпустки',
                'Службова записка щодо ремонту офісу'
            ]
        };

        const tagsPool = {
            contract: [['оренда', 'нерухомість'], ['консалтинг', 'послуги'], ['постачання', 'обладнання'], ['HR', 'кадри'], ['NDA', 'конфіденційність'], ['IT', 'розробка'], ['ліцензія', 'ПЗ'], ['страхування']],
            act: [['послуги', 'звіт'], ['дизайн', 'веб'], ['звірка', 'фінанси'], ['списання', 'ТМЦ'], ['інвентаризація', 'IT']],
            invoice: [['ліцензія', 'оплата'], ['маркетинг', 'реклама'], ['оренда', 'офіс'], ['IT', 'сервери'], ['хостинг', 'AWS']],
            declaration: [['податки', 'звітність'], ['імпорт', 'митниця'], ['доходи', 'декларація'], ['ЄСВ', 'звітність']],
            order: [['кадри', 'штатний розпис'], ['відпустка', 'HR'], ['відрядження'], ['преміювання', 'мотивація'], ['CRM', 'IT']],
            memo: [['закупівля', 'техніка'], ['бюджет', 'маркетинг'], ['відпустка', 'HR'], ['ремонт', 'офіс']]
        };

        const confidentialityLevels = ['public', 'internal', 'confidential', 'secret'];
        const directions = ['incoming', 'outgoing', 'internal'];
        const counterparties = ['ТОВ "Нова Пошта"', 'ПрАТ "Київстар"', 'ФОП Мельник В.В.', 'EPAM Systems', 'ТОВ "Сільпо-Фуд"', 'Державна Податкова Служба', 'ТОВ "Альфа"', 'Google Ukraine LLC', 'ПрАТ "Укрпошта"', 'ТОВ "SoftServe"'];
        const docTypes = ['contract', 'act', 'invoice', 'declaration', 'order', 'memo'];

        const deptPrefixMap = {
            'Фінансовий відділ': 'FIN',
            'IT відділ': 'ITD',
            'HR відділ': 'HRD',
            'Маркетинг': 'MRK',
            'Юридичний відділ': 'LEG'
        };

        // ========== GENERATE DOCUMENTS: 10 per status PER EMPLOYEE ==========
        // Each employee gets 10 docs in every status so they see 10+ in their own view
        let auditLogsData = [];
        const now = new Date();
        const docSpecs = [];

        const allStatuses = ['draft', 'on_approval', 'on_signing', 'signed', 'rejected', 'archived'];
        const DOCS_PER_STATUS_PER_EMPLOYEE = 10;

        let globalIdx = 0;
        for (const creator of employees) {
            for (const status of allStatuses) {
                for (let s = 0; s < DOCS_PER_STATUS_PER_EMPLOYEE; s++) {
                    const type = docTypes[globalIdx % docTypes.length];
                    const titleIndex = globalIdx % titlesDict[type].length;
                    const title = titlesDict[type][titleIndex];

                    // Distribute confidentiality across all docs
                    const conf = confidentialityLevels[globalIdx % confidentialityLevels.length];

                    const direction = directions[globalIdx % 3];
                    const counterparty = direction === 'internal' ? '' : counterparties[globalIdx % counterparties.length];

                    // Tags from pool
                    const tagSet = tagsPool[type][titleIndex] || ['загальний'];

                    // Dates: spread over last 180 days
                    const createdAt = new Date(now.getTime() - (180 - (globalIdx * 0.5)) * 24 * 60 * 60 * 1000);

                    // Overdue: on_approval and on_signing docs get past due dates (half of them)
                    let dueDate;
                    if (['on_approval', 'on_signing'].includes(status) && s < 5) {
                        // Overdue: dueDate 3-20 days ago
                        dueDate = new Date(now.getTime() - (3 + Math.floor(Math.random() * 17)) * 24 * 60 * 60 * 1000);
                    } else if (status === 'draft') {
                        // Drafts: future due dates
                        dueDate = new Date(now.getTime() + (5 + Math.floor(Math.random() * 40)) * 24 * 60 * 60 * 1000);
                    } else {
                        // Normal spread
                        dueDate = new Date(createdAt.getTime() + (Math.floor(Math.random() * 35) + 5) * 24 * 60 * 60 * 1000);
                    }

                    docSpecs.push({ creator, type, title, status, conf, direction, counterparty, tags: tagSet, createdAt, dueDate });
                    globalIdx++;
                }
            }
        }

        const docIds = docSpecs.map(() => new mongoose.Types.ObjectId());

        const docsData = docSpecs.map((spec, i) => {
            const { creator, type, title, status, conf, direction, counterparty, tags, createdAt, dueDate } = spec;
            const docId = docIds[i];

            let approver = approvers.find(m => m.department === creator.department) || approvers[0];
            let signatory = signatories.find(s => s.department === creator.department) || signatories[0];

            const deptPrefix = deptPrefixMap[creator.department] || 'DOC';
            const regNumber = `${deptPrefix}-${String(100000 + i * 1337 + Math.floor(Math.random() * 1000)).slice(0, 6)}`;

            // Generate audit logs for realistic timeline
            let logDate = new Date(createdAt);
            auditLogsData.push({ document: docId, user: creator._id, action: 'create', createdAt: logDate });

            if (status !== 'draft') {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 2);
                auditLogsData.push({ document: docId, user: creator._id, action: 'file_upload', comment: 'Завантажено скан-копії', createdAt: logDate });

                logDate = new Date(logDate.getTime() + 1000 * 60 * 5);
                auditLogsData.push({ document: docId, user: creator._id, action: 'status_change', fromStatus: 'draft', toStatus: 'on_approval', createdAt: logDate });
            }

            if (['on_signing', 'signed', 'archived'].includes(status)) {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 24);
                auditLogsData.push({ document: docId, user: approver._id, action: 'status_change', fromStatus: 'on_approval', toStatus: 'on_signing', comment: 'Погоджено. Передано на підписання.', createdAt: logDate });
            }

            if (['signed', 'archived'].includes(status)) {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 5);
                auditLogsData.push({ document: docId, user: signatory._id, action: 'status_change', fromStatus: 'on_signing', toStatus: 'signed', comment: 'Накладено КЕП', createdAt: logDate });
            }

            if (status === 'archived') {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 24 * 10);
                auditLogsData.push({ document: docId, user: approver._id, action: 'status_change', fromStatus: 'signed', toStatus: 'archived', createdAt: logDate });
            }

            if (status === 'rejected') {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 4);
                const rejector = Math.random() > 0.5 ? approver : signatory;
                const fromStat = rejector.role === 'approver' ? 'on_approval' : 'on_signing';
                const comments = ['Не вистачає додатку до договору', 'Сума вказана невірно', 'Потрібно оновити реквізити контрагента', 'Помилка в датах', 'Відсутній підпис контрагента'];
                auditLogsData.push({ document: docId, user: rejector._id, action: 'status_change', fromStatus: fromStat, toStatus: 'rejected', comment: getRandomElement(comments), createdAt: logDate });
            }

            // Add some comments to recent documents
            if (i >= 10 && i < 20) {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 30);
                const commentTexts = ['Прошу перевірити реквізити', 'Чи є оригінал у паперовому вигляді?', 'Додано додаток А', 'Потрібна консультація юриста'];
                auditLogsData.push({ document: docId, user: getRandomElement([...approvers, ...employees])._id, action: 'comment', comment: getRandomElement(commentTexts), createdAt: logDate });
            }

            const statuses = ['draft', 'on_approval', 'on_signing', 'signed', 'rejected', 'archived'];

            return {
                _id: docId,
                regNumber,
                title,
                direction,
                department: creator.department,
                type,
                counterparty,
                status,
                creator: creator._id,
                approver: (statuses.indexOf(status) >= statuses.indexOf('on_approval') && status !== 'draft') ? approver._id : null,
                signatory: (statuses.indexOf(status) >= statuses.indexOf('on_signing') && !['draft', 'on_approval'].includes(status)) ? signatory._id : null,
                dueDate,
                files: getRandomFiles(creator._id),
                tags,
                confidentiality: conf,
                relatedDocuments: [],
                createdAt
            };
        });

        await Document.insertMany(docsData);
        console.log(`${docsData.length} documents inserted`);

        // ========== RELATED DOCUMENTS (bidirectional links) ==========
        const totalDocs = docsData.length;
        const relatedPairs = [
            [0, 1], [2, 3], [5, 10], [15, 20], [25, 30], [8, 9], [12, 22], [35, 40], [18, 28], [7, 14],
            [42, 50], [44, 55], [48, 60], [33, 65], [36, 70]
        ].filter(([a, b]) => a < totalDocs && b < totalDocs);
        for (const [a, b] of relatedPairs) {
            await Document.updateOne({ _id: docIds[a] }, { $addToSet: { relatedDocuments: docIds[b] } });
            await Document.updateOne({ _id: docIds[b] }, { $addToSet: { relatedDocuments: docIds[a] } });
        }
        console.log('Related documents linked');

        // ========== AUDIT LOGS ==========
        await AuditLog.insertMany(auditLogsData);
        console.log(`${auditLogsData.length} audit logs inserted`);

        // ========== NOTIFICATIONS ==========
        const notificationsData = [];

        // Notifications for employees about their doc status changes
        for (const emp of employees) {
            const empDocs = docsData.filter(d => d.creator.equals(emp._id));
            for (const doc of empDocs.slice(0, 3)) {
                if (doc.status === 'rejected') {
                    notificationsData.push({
                        recipient: emp._id,
                        type: 'status_change',
                        title: 'Документ відхилено',
                        message: `Документ "${doc.title}" було відхилено. Перегляньте коментарі.`,
                        documentId: doc._id,
                        isRead: Math.random() > 0.5,
                        createdAt: new Date(now.getTime() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000)
                    });
                }
                if (doc.status === 'signed') {
                    notificationsData.push({
                        recipient: emp._id,
                        type: 'status_change',
                        title: 'Документ підписано',
                        message: `Документ "${doc.title}" успішно підписано.`,
                        documentId: doc._id,
                        isRead: Math.random() > 0.3,
                        createdAt: new Date(now.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000)
                    });
                }
                if (doc.status === 'on_approval') {
                    notificationsData.push({
                        recipient: emp._id,
                        type: 'status_change',
                        title: 'Документ на погодженні',
                        message: `Ваш документ "${doc.title}" передано на погодження.`,
                        documentId: doc._id,
                        isRead: false,
                        createdAt: new Date(now.getTime() - Math.floor(Math.random() * 2) * 24 * 60 * 60 * 1000)
                    });
                }
            }
        }

        // Notifications for approvers about new tasks
        for (const apr of approvers) {
            const deptDocs = docsData.filter(d => d.department === apr.department && d.status === 'on_approval');
            for (const doc of deptDocs.slice(0, 3)) {
                notificationsData.push({
                    recipient: apr._id,
                    type: 'new_task',
                    title: 'Новий документ на погодження',
                    message: `Документ "${doc.title}" очікує вашого погодження.`,
                    documentId: doc._id,
                    isRead: false,
                    createdAt: new Date(now.getTime() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000)
                });
            }
        }

        // Notifications for signatories about signing tasks
        for (const sig of signatories) {
            const deptDocs = docsData.filter(d => d.department === sig.department && d.status === 'on_signing');
            for (const doc of deptDocs.slice(0, 2)) {
                notificationsData.push({
                    recipient: sig._id,
                    type: 'new_task',
                    title: 'Документ на підписання',
                    message: `Документ "${doc.title}" очікує вашого підпису.`,
                    documentId: doc._id,
                    isRead: false,
                    createdAt: new Date(now.getTime() - Math.floor(Math.random() * 2) * 24 * 60 * 60 * 1000)
                });
            }
        }

        // Deadline notifications
        const overdueDocs = docsData.filter(d => d.dueDate < now && !['draft', 'signed', 'archived'].includes(d.status));
        for (const doc of overdueDocs.slice(0, 5)) {
            const creator = employees.find(e => e._id.equals(doc.creator));
            if (creator) {
                notificationsData.push({
                    recipient: creator._id,
                    type: 'deadline',
                    title: 'Прострочений документ',
                    message: `Дедлайн документа "${doc.title}" минув ${new Date(doc.dueDate).toLocaleDateString('uk-UA')}.`,
                    documentId: doc._id,
                    isRead: false,
                    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
                });
            }
        }

        // System notification for admins
        const admins = createdUsers.filter(u => u.role === 'admin');
        for (const admin of admins) {
            notificationsData.push({
                recipient: admin._id,
                type: 'system',
                title: 'Ласкаво просимо',
                message: 'Систему Mini-EDMS успішно ініціалізовано. Перевірте налаштування SMTP.',
                isRead: false,
                createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
            });
        }

        await Notification.insertMany(notificationsData);
        console.log(`${notificationsData.length} notifications inserted`);

        // ========== SAVED FILTERS ==========
        const savedFiltersData = [];

        // For each employee: a couple of useful saved filters
        for (const emp of employees) {
            savedFiltersData.push({
                user: emp._id,
                name: 'Мої чернетки',
                filters: { search: '', type: '', status: 'draft', department: '', direction: '', deadlineBefore: '', createdFrom: '', createdTo: '', tags: [], confidentiality: '' }
            });
            savedFiltersData.push({
                user: emp._id,
                name: 'Відхилені',
                filters: { search: '', type: '', status: 'rejected', department: '', direction: '', deadlineBefore: '', createdFrom: '', createdTo: '', tags: [], confidentiality: '' }
            });
        }

        // For approvers
        for (const apr of approvers) {
            savedFiltersData.push({
                user: apr._id,
                name: 'На погодженні (мій відділ)',
                filters: { search: '', type: '', status: 'on_approval', department: apr.department, direction: '', deadlineBefore: '', createdFrom: '', createdTo: '', tags: [], confidentiality: '' }
            });
            savedFiltersData.push({
                user: apr._id,
                name: 'Конфіденційні договори',
                filters: { search: '', type: 'contract', status: '', department: '', direction: '', deadlineBefore: '', createdFrom: '', createdTo: '', tags: [], confidentiality: 'confidential' }
            });
            savedFiltersData.push({
                user: apr._id,
                name: 'Прострочені',
                filters: { search: '', type: '', status: '', department: '', direction: '', deadlineBefore: new Date().toISOString().split('T')[0], createdFrom: '', createdTo: '', tags: [], confidentiality: '' }
            });
        }

        // For signatories
        for (const sig of signatories) {
            savedFiltersData.push({
                user: sig._id,
                name: 'На підписання',
                filters: { search: '', type: '', status: 'on_signing', department: sig.department, direction: '', deadlineBefore: '', createdFrom: '', createdTo: '', tags: [], confidentiality: '' }
            });
        }

        await SavedFilter.insertMany(savedFiltersData);
        console.log(`${savedFiltersData.length} saved filters inserted`);

        // ========== DELEGATIONS ==========
        const delegationsData = [];

        // Finance approver delegates to legal approver (active now)
        const financeApprover = approvers.find(a => a.department === 'Фінансовий відділ');
        const legalApprover = approvers.find(a => a.department === 'Юридичний відділ');
        if (financeApprover && legalApprover) {
            delegationsData.push({
                delegator: financeApprover._id,
                delegate: legalApprover._id,
                department: 'Фінансовий відділ',
                role: 'approver',
                dateFrom: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
                dateTo: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
                isActive: true,
                reason: 'Щорічна відпустка'
            });
        }

        // Finance signatory delegates to legal signatory (expired)
        const financeSignatory = signatories.find(s => s.department === 'Фінансовий відділ');
        const legalSignatory = signatories.find(s => s.department === 'Юридичний відділ');
        if (financeSignatory && legalSignatory) {
            delegationsData.push({
                delegator: financeSignatory._id,
                delegate: legalSignatory._id,
                department: 'Фінансовий відділ',
                role: 'signatory',
                dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                dateTo: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
                isActive: false,
                reason: 'Відрядження'
            });
        }

        // HR approver delegates to marketing approver (future)
        const hrApprover = approvers.find(a => a.department === 'HR відділ');
        const mktApprover = approvers.find(a => a.department === 'Маркетинг');
        if (hrApprover && mktApprover) {
            delegationsData.push({
                delegator: hrApprover._id,
                delegate: mktApprover._id,
                department: 'HR відділ',
                role: 'approver',
                dateFrom: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                dateTo: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
                isActive: true,
                reason: 'Планова відпустка'
            });
        }

        if (delegationsData.length > 0) {
            await Delegation.insertMany(delegationsData);
            console.log(`${delegationsData.length} delegations inserted`);
        }

        // Delegation notifications
        if (financeApprover && legalApprover) {
            await Notification.create({
                recipient: legalApprover._id,
                type: 'delegation',
                title: 'Нове делегування',
                message: `${financeApprover.fullName} делегував вам повноваження погодження для Фінансового відділу (до ${new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('uk-UA')}).`,
                isRead: false
            });
        }

        console.log('\n=== Seed Summary ===');
        console.log(`Users: ${createdUsers.length}`);
        console.log(`Documents: ${docsData.length}`);
        for (const st of allStatuses) {
            console.log(`  - ${st}: ${docsData.filter(d => d.status === st).length}`);
        }
        console.log(`  - overdue: ${overdueDocs.length}`);
        console.log(`  - with tags: ${docsData.filter(d => d.tags.length > 0).length}`);
        console.log(`  - confidential/secret: ${docsData.filter(d => ['confidential', 'secret'].includes(d.confidentiality)).length}`);
        console.log(`  - with related: ${relatedPairs.length * 2} links`);
        console.log(`Audit logs: ${auditLogsData.length}`);
        console.log(`Notifications: ${notificationsData.length + (financeApprover && legalApprover ? 1 : 0)}`);
        console.log(`Saved filters: ${savedFiltersData.length}`);
        console.log(`Delegations: ${delegationsData.length}`);
        console.log('\nPassword for all users: password123');
        console.log('\nData Seeded Successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
