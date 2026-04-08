const Department = require('../models/Department');
const User = require('../models/User');
const Document = require('../models/Document');

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({}).sort({ name: 1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Помилка завантаження відділів' });
  }
};

// @desc    Створити новий відділ
// @route   POST /api/departments
// @access  Private/Admin
const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const exists = await Department.findOne({ name });
    if (exists) return res.status(400).json({ message: 'Відділ з такою назвою вже існує' });
    
    const dept = await Department.create({ name, description });
    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ message: 'Помилка створення відділу' });
  }
};

// @desc    Видалити відділ
// @route   DELETE /api/departments/:id
// @access  Private/Admin
const deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Не знайдено' });

    const linkedUsers = await User.find({ department: dept.name }).select('fullName email');
    
    if (linkedUsers.length > 0) {
        const usersListHtml = `<div class="max-h-40 overflow-y-auto mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-left shadow-inner"><ul class="list-disc pl-5 space-y-1">` + 
            linkedUsers.map(u => `<li><span class="font-medium text-gray-800">${u.fullName}</span> <span class="text-gray-500">(${u.email})</span></li>`).join('') + 
            `</ul></div>`;
            
        return res.status(400).json({ message: `Неможливо видалити відділ, доки до нього привʼязані користувачі (${linkedUsers.length} чол.). ${usersListHtml}` });
    }

    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Відділ успішно видалено' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка видалення відділу' });
  }
};

// @desc    Оновити відділ
// @route   PATCH /api/departments/:id
// @access  Private/Admin
const updateDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ message: 'Не знайдено' });

    if (name && name !== dept.name) {
        // Оновлюємо назву відділу у всіх пов'язаних користувачів та документах
        await User.updateMany({ department: dept.name }, { department: name });
        await Document.updateMany({ department: dept.name }, { department: name });
    }

    const updated = await Department.findByIdAndUpdate(req.params.id, { name, description }, { new: true, runValidators: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Помилка оновлення відділу' });
  }
};

module.exports = { getDepartments, createDepartment, deleteDepartment, updateDepartment };