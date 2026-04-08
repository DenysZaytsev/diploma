const Settings = require('../models/Settings');

const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({ maxUploadFiles: 10 });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Помилка завантаження налаштувань' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { maxUploadFiles } = req.body;
    let limit = Math.min(30, Math.max(1, parseInt(maxUploadFiles) || 10));

    const updated = await Settings.findOneAndUpdate({}, { maxUploadFiles: limit }, { new: true, upsert: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Помилка оновлення налаштувань' });
  }
};

module.exports = { getSettings, updateSettings };