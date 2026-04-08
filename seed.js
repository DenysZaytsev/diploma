require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Document = require('./models/Document');
const AuditLog = require('./models/AuditLog');
const DocumentType = require('./models/DocumentType');
const Department = require('./models/Department');
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
        // Використовуємо drop() замість deleteMany(), щоб видалити старі індекси (наприклад, regNumber)
        try { await User.collection.drop(); } catch (e) {}
        try { await Document.collection.drop(); } catch (e) {}
        try { await AuditLog.collection.drop(); } catch (e) {}
        try { await DocumentType.collection.drop(); } catch (e) {}
        try { await Department.collection.drop(); } catch (e) {}

        console.log('Database cleared');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);

        const depsData = [
            { name: 'Фінансовий відділ' }, { name: 'IT відділ' }, { name: 'HR відділ' }, { name: 'Маркетинг' }, { name: 'Юридичний відділ' }
        ];
        await Department.insertMany(depsData);
        console.log('Departments inserted');
        
        const users = [
            // IT Відділ (Адміни)
            {
                email: 'oleksandr-it@gmail.com',
                passwordHash,
                role: 'admin',
                fullName: 'Головний Адміністратор',
                department: 'IT відділ',
                isSuperAdmin: true, // Позначаємо як головного адміна
            },
            {
                email: 'support-it@gmail.com',
                passwordHash,
                role: 'admin',
                fullName: 'Технічна Підтримка',
                department: 'IT відділ',
            },
            // Фінансовий відділ
            {
                email: 'olena-finance@gmail.com',
                passwordHash,
                role: 'approver',
                fullName: 'Олена Григоренко',
                department: 'Фінансовий відділ',
            },
            {
                email: 'viktor-finance@gmail.com',
                passwordHash,
                role: 'signatory',
                fullName: 'Віктор Мельник',
                department: 'Фінансовий відділ',
            },
            {
                email: 'iryna-finance@gmail.com',
                passwordHash,
                role: 'employee',
                fullName: 'Ірина Сидоренко',
                department: 'Фінансовий відділ',
            },
            // Юридичний відділ
            {
                email: 'dmytro-legal@gmail.com',
                passwordHash,
                role: 'approver',
                fullName: 'Дмитро Ткаченко',
                department: 'Юридичний відділ',
            },
            {
                email: 'anna-legal@gmail.com',
                passwordHash,
                role: 'signatory',
                fullName: 'Анна Бойко',
                department: 'Юридичний відділ',
            },
            {
                email: 'petro-legal@gmail.com',
                passwordHash,
                role: 'employee',
                fullName: 'Петро Шевченко',
                department: 'Юридичний відділ',
            },
            // Маркетинг
            {
                email: 'kateryna-marketing@gmail.com',
                passwordHash,
                role: 'approver',
                fullName: 'Катерина Романчук',
                department: 'Маркетинг',
            },
            {
                email: 'tetiana-marketing@gmail.com',
                passwordHash,
                role: 'employee',
                fullName: 'Тетяна Лисенко',
                department: 'Маркетинг',
            },
            // HR відділ
            {
                email: 'maria-hr@gmail.com',
                passwordHash,
                role: 'approver',
                fullName: 'Марія Коваль',
                department: 'HR відділ',
            },
            {
                email: 'serhiy-hr@gmail.com',
                passwordHash,
                role: 'employee',
                fullName: 'Сергій Павленко',
                department: 'HR відділ',
            }
        ];

        const createdUsers = await User.insertMany(users);
        console.log('Users inserted');

        // Create default document types
        const docTypesData = [
            { name: 'Договір', code: 'contract' },
            { name: 'Акт', code: 'act' },
            { name: 'Рахунок', code: 'invoice' },
            { name: 'Декларація', code: 'declaration' },
            { name: 'Наказ', code: 'order' },
            { name: 'Службова записка', code: 'memo' }
        ];
        await DocumentType.insertMany(docTypesData);
        console.log('Document types inserted');

        const titlesDict = {
            contract: ['Договір оренди приміщення №45-А', 'Договір про надання консалтингових послуг', 'Договір постачання обладнання №12/2023', 'Трудовий контракт (шаблон)', 'Договір про нерозголошення (NDA)', 'Договір про розробку ПЗ'],
            act: ['Акт приймання-передачі наданих послуг за березень', 'Акт виконаних робіт (дизайн сайту)', 'Акт звірки взаєморозрахунків за І квартал', 'Акт списання матеріальних цінностей'],
            invoice: ['Рахунок-фактура №1024 за ліцензії', 'Рахунок на оплату послуг маркетингу', 'Рахунок за оренду офісу (квітень)', 'Рахунок №55 на закупівлю серверів'],
            declaration: ['Податкова декларація платника єдиного податку', 'Митна декларація (імпорт)', 'Декларація про майновий стан і доходи'],
            order: ['Наказ про затвердження штатного розпису', 'Наказ про надання щорічної відпустки', 'Наказ про відрядження за кордон', 'Наказ про преміювання за результатами року'],
            memo: ['Службова записка щодо закупівлі техніки', 'Службова записка про виділення бюджету на рекламу', 'Службова записка про перенесення відпустки']
        };

        // Динамічне читання реальних файлів з папки uploads
        let mockFiles = [];
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.')); // Ігноруємо приховані файли
            mockFiles = files.map(f => {
                const stats = fs.statSync(path.join(uploadsDir, f));
                const ext = path.extname(f).toLowerCase();
                let mimeType = 'application/octet-stream';
                if (ext === '.pdf') mimeType = 'application/pdf';
                else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                else if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (ext === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

                return {
                    originalName: f,
                    mimeType,
                    size: stats.size,
                    path: `/uploads/${f}`
                };
            });
        }
        
        if (mockFiles.length === 0) console.log('⚠️ Папка uploads порожня. Документи будуть згенеровані без файлів.');

        const statuses = ['draft', 'on_approval', 'on_signing', 'signed', 'rejected', 'archived'];
        const docTypes = ['contract', 'act', 'invoice', 'declaration', 'order', 'memo'];
        const directions = ['incoming', 'outgoing', 'internal'];
        const counterparties = ['ТОВ "Нова Пошта"', 'ПрАТ "Київстар"', 'ФОП Мельник В.В.', 'EPAM Systems', 'ТОВ "Сільпо-Фуд"', 'Державна Податкова Служба', 'ТОВ "Альфа"'];
        
        const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const getRandomFiles = () => {
            if (mockFiles.length === 0) return [];
            const count = Math.floor(Math.random() * 3) + 1; // від 1 до 3 файлів
            // Беремо унікальні файли, щоб не було дублів в одному документі
            const shuffled = [...mockFiles].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        };

        // Отримуємо ID користувачів для розподілу документів
        const approvers = createdUsers.filter(u => u.role === 'approver');
        const signatories = createdUsers.filter(u => u.role === 'signatory');
        const employees = createdUsers.filter(u => u.role === 'employee');
        
        let auditLogsData = [];
        
        const docsData = Array.from({ length: 40 }).map((_, index) => {
            const creator = getRandomElement(employees);
            
            // Забезпечуємо різноманітність статусів
            let status;
            const rand = Math.random();
            if (rand < 0.15) status = 'draft';
            else if (rand < 0.3) status = 'on_approval';
            else if (rand < 0.45) status = 'on_signing';
            else if (rand < 0.75) status = 'signed';
            else if (rand < 0.9) status = 'archived';
            else status = 'rejected';

            const type = getRandomElement(docTypes);
            
            // Підбираємо погоджувача з того ж відділу, якщо є (або першого)
            let approver = approvers.find(m => m.department === creator.department) || approvers[0];
            // Підбираємо підписанта з того ж відділу, якщо є (або першого)
            let signatory = signatories.find(s => s.department === creator.department) || signatories[0];

            const direction = getRandomElement(directions);
            const counterparty = direction === 'internal' ? '' : getRandomElement(counterparties);

            const title = getRandomElement(titlesDict[type]);
            
            // Розкидаємо дати створення на останні 60 днів
            const createdAt = randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date());
            const dueDate = new Date(createdAt.getTime() + (Math.floor(Math.random() * 20) + 5) * 24 * 60 * 60 * 1000); // Дедлайн +5..25 днів від створення

            // Імітація об'єкту ID Mongoose для прив'язки аудит логів
            const docId = new mongoose.Types.ObjectId();

            // Генерація історії (Audit Logs) для створення реалістичного таймлайну
            let logDate = new Date(createdAt);
            auditLogsData.push({ document: docId, user: creator._id, action: 'create', createdAt: logDate });
            
            if (status !== 'draft') {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 2); // +2 години
                auditLogsData.push({ document: docId, user: creator._id, action: 'file_upload', comment: 'Завантажено скан-копії', createdAt: logDate });
                
                logDate = new Date(logDate.getTime() + 1000 * 60 * 5); // +5 хв
                auditLogsData.push({ document: docId, user: creator._id, action: 'status_change', fromStatus: 'draft', toStatus: 'on_approval', createdAt: logDate });
            }

            if (['on_signing', 'signed', 'archived'].includes(status)) {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 24); // +1 день
                auditLogsData.push({ document: docId, user: approver._id, action: 'status_change', fromStatus: 'on_approval', toStatus: 'on_signing', comment: 'Погоджено. Автоматично передано на підписання.', createdAt: logDate });
            }

            if (['signed', 'archived'].includes(status)) {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 5); // +5 годин
                auditLogsData.push({ document: docId, user: signatory._id, action: 'status_change', fromStatus: 'on_signing', toStatus: 'signed', comment: 'Накладено КЕП', createdAt: logDate });
            }

            if (status === 'archived') {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 24 * 10); // +10 днів
                auditLogsData.push({ document: docId, user: approver._id, action: 'status_change', fromStatus: 'signed', toStatus: 'archived', createdAt: logDate });
            }

            if (status === 'rejected') {
                logDate = new Date(logDate.getTime() + 1000 * 60 * 60 * 4); // +4 години
                const rejector = Math.random() > 0.5 ? approver : signatory;
                const fromStat = rejector === approver ? 'on_approval' : 'on_signing';
                const comments = ['Не вистачає додатку до договору', 'Сума вказана невірно', 'Потрібно оновити реквізити контрагента', 'Помилка в датах'];
                auditLogsData.push({ document: docId, user: rejector._id, action: 'status_change', fromStatus: fromStat, toStatus: 'rejected', comment: getRandomElement(comments), createdAt: logDate });
            }

            const deptPrefixMap = {
                'Фінансовий відділ': 'FIN',
                'IT відділ': 'ITD',
                'HR відділ': 'HRD',
                'Маркетинг': 'MRK',
                'Юридичний відділ': 'LEG'
            };
            const deptPrefix = deptPrefixMap[creator.department] || 'DOC';
            const regNumber = `${deptPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;

            return {
                _id: docId,
                regNumber: regNumber,
                title: title,
                direction: direction,
                department: creator.department,
                type: type,
                counterparty: counterparty,
                status: status,
                creator: creator._id,
                approver: (statuses.indexOf(status) >= statuses.indexOf('on_approval')) ? approver._id : null,
                signatory: (statuses.indexOf(status) >= statuses.indexOf('on_signing')) ? signatory._id : null,
                dueDate: dueDate,
                files: getRandomFiles(),
                createdAt: createdAt
            };
        });

        await Document.insertMany(docsData);
        console.log('Documents inserted');

        await AuditLog.insertMany(auditLogsData);
        console.log('Audit Logs generated and inserted');

        console.log('Data Seeded Successfully');
        process.exit();
    } catch (error) {
        console.error('Error seeding data', error);
        process.exit(1);
    }
};

seedData();