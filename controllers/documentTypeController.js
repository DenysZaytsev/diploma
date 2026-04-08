const DocumentType = require('../models/DocumentType');
const Document = require('../models/Document'); // Для перевірки активних документів

// @desc    Отримати всі типи документів
// @route   GET /api/document-types
// @access  Private
const getDocumentTypes = async (req, res) => {
  try {
    const types = await DocumentType.find({}).sort({ name: 1 });
    res.json(types);
  } catch (error) {
    res.status(500).json({ message: 'Помилка завантаження довідника' });
  }
};

// @desc    Створити новий тип документа
// @route   POST /api/document-types
// @access  Private/Admin
const createDocumentType = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Автоматична генерація унікального коду
    const code = 'type_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    const documentType = await DocumentType.create({ name, code, description });
    res.status(201).json(documentType);
  } catch (error) {
    res.status(500).json({ message: 'Помилка створення типу документа' });
  }
};

// @desc    Видалити тип документа
// @route   DELETE /api/document-types/:id
// @access  Private/Admin
const deleteDocumentType = async (req, res) => {
  try {
    const docType = await DocumentType.findById(req.params.id);
    if (!docType) return res.status(404).json({ message: 'Не знайдено' });

    // Перевірка наявності неархівних документів
    const activeDocsCount = await Document.countDocuments({ type: docType.code, status: { $ne: 'archived' } });
    if (activeDocsCount > 0) {
      return res.status(400).json({ message: `Неможливо видалити: існує ${activeDocsCount} активних документів цього типу.` });
    }

    const documentType = await DocumentType.findByIdAndDelete(req.params.id);
    if (!documentType) return res.status(404).json({ message: 'Не знайдено' });
    
    res.json({ message: 'Тип документа успішно видалено' });
  } catch (error) {
    res.status(500).json({ message: 'Помилка видалення типу документа' });
  }
};

// @desc    Оновити тип документа
// @route   PATCH /api/document-types/:id
// @access  Private/Admin
const updateDocumentType = async (req, res) => {
  try {
    const { name, description } = req.body;
    const updated = await DocumentType.findByIdAndUpdate(req.params.id, { name, description }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Не знайдено' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Помилка оновлення типу документа' });
  }
};

module.exports = { getDocumentTypes, createDocumentType, deleteDocumentType, updateDocumentType };