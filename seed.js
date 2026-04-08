require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Document = require('./models/Document');
const AuditLog = require('./models/AuditLog');
const DocumentType = require('./models/DocumentType');
const Department = require('./models/Department');

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
            {
                email: 'admin@edms.local',
                passwordHash,
                role: 'admin',
                fullName: 'Головний Адміністратор',
                department: 'IT відділ',
                isSuperAdmin: true, // Позначаємо як головного адміна
            },
            {
                email: 'admin2@edms.local',
                passwordHash,
                role: 'admin',
                fullName: 'Технічна Підтримка',
                department: 'IT відділ',
            },
            {
                email: 'manager@edms.local',
                passwordHash,
                role: 'manager',
                fullName: 'Іван Керівник (Фін)',
                department: 'Фінансовий відділ',
            },
            {
                email: 'manager2@edms.local',
                passwordHash,
                role: 'manager',
                fullName: 'Олена Керівник (Маркетинг)',
                department: 'Маркетинг',
            },
            {
                email: 'signatory@edms.local',
                passwordHash,
                role: 'signatory',
                fullName: 'Сергій Підписант (Фін)',
                department: 'Фінансовий відділ',
            },
            {
                email: 'signatory2@edms.local',
                passwordHash,
                role: 'signatory',
                fullName: 'Анна Директор',
                department: 'Юридичний відділ',
            },
            {
                email: 'employee@edms.local',
                passwordHash,
                role: 'employee',
                fullName: 'Петро Виконавець (Фін)',
                department: 'Фінансовий відділ',
            },
            {
                email: 'employee2@edms.local',
                passwordHash,
                role: 'employee',
                fullName: 'Марія Маркетолог',
                department: 'Маркетинг',
            },
            {
                email: 'employee3@edms.local',
                passwordHash,
                role: 'employee',
                fullName: 'Олексій Кадровик',
                department: 'HR відділ',
            },
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

        const statuses = ['draft', 'registered', 'under_review', 'in_progress', 'completed', 'rejected', 'archived'];
        const docTypes = ['contract', 'act', 'invoice', 'declaration', 'order', 'memo'];
        const directions = ['incoming', 'outgoing', 'internal'];
        const counterparties = ['ТОВ "Альфа"', 'ПрАТ "Омега"', 'ФОП Коваленко', 'Google LLC', 'ТОВ "Інновації"', 'Державна Податкова Служба'];
        const titles = ['про надання послуг', 'на закупівлю обладнання', 'щодо оренди приміщення', 'за виконані роботи', 'про нерозголошення', 'на відпустку'];

        // Отримуємо ID користувачів для розподілу документів
        const managers = createdUsers.filter(u => u.role === 'manager');
        const signatories = createdUsers.filter(u => u.role === 'signatory');
        const employees = createdUsers.filter(u => u.role === 'employee');
        
        const docs = Array.from({ length: 25 }).map((_, index) => {
            const creator = employees[index % employees.length];
            const status = statuses[index % statuses.length];
            const type = docTypes[index % docTypes.length];
            
            // Підбираємо менеджера з того ж відділу, якщо є (або першого)
            let manager = managers.find(m => m.department === creator.department) || managers[0];
            // Підбираємо підписанта з того ж відділу, якщо є (або першого)
            let signatory = signatories.find(s => s.department === creator.department) || signatories[0];

            // Для внутрішніх документів контрагент не обов'язковий
            const direction = directions[index % directions.length];
            const counterparty = direction === 'internal' ? 'Внутрішній документ' : counterparties[index % counterparties.length];

            // Дати дедлайну розкидані від минулого до майбутнього
            const daysOffset = Math.floor(Math.random() * 30) - 10; // від -10 до +20 днів
            const dueDate = new Date(new Date().getTime() + daysOffset * 24 * 60 * 60 * 1000);

            return {
                title: `${docTypesData.find(d => d.code === type).name} ${titles[index % titles.length]} №${index + 100}`,
                direction: direction,
                department: creator.department,
                type: type,
                counterparty: counterparty,
                status: status,
                creator: creator._id,
                manager: (statuses.indexOf(status) > statuses.indexOf('registered')) ? manager._id : null,
                signatory: (statuses.indexOf(status) >= statuses.indexOf('in_progress')) ? signatory._id : null,
                dueDate: dueDate,
                files: []
            };
        });

        const createdDocs = await Document.insertMany(docs);
        console.log('Documents inserted');

        // Ми пропустимо наповнення AuditLog тут, 
        // оскільки його схема також буде оновлена на Етапі 2.

        console.log('Data Seeded Successfully');
        process.exit();
    } catch (error) {
        console.error('Error seeding data', error);
        process.exit(1);
    }
};

seedData();