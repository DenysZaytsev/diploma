const Settings = require('../models/Settings');
const nodemailer = require('nodemailer');

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

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body;
    const updateData = { maxUploadFiles: limit };
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser;
    if (smtpPass !== undefined) updateData.smtpPass = smtpPass;
    if (smtpFrom !== undefined) updateData.smtpFrom = smtpFrom;

    const updated = await Settings.findOneAndUpdate({}, updateData, { returnDocument: 'after', upsert: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Помилка оновлення налаштувань' });
  }
};

const testEmail = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body;
    const settings = await Settings.findOne();

    const host = smtpHost || settings?.smtpHost;
    const port = smtpPort || settings?.smtpPort || 465;
    const user = smtpUser || settings?.smtpUser;
    const pass = smtpPass || settings?.smtpPass;
    const from = smtpFrom || settings?.smtpFrom || 'EDMS System';

    if (!host || !user || !pass) {
        return res.status(400).json({ message: 'Неповні налаштування пошти для перевірки' });
    }

    const transporter = nodemailer.createTransport({
        host: host,
        port: parseInt(port),
        secure: parseInt(port) === 465,
        auth: { user: user, pass: pass },
        family: 4 // Примусово IPv4 (важливо для Render.com)
    });

    await transporter.sendMail({
        from: `"${from}" <${user}>`,
        to: req.user.email,
        subject: 'Тестове повідомлення EDMS',
        html: '<b>Налаштування пошти успішно перевірені!</b> Сервер працює коректно.'
    });

    res.json({ message: 'Тестовий лист успішно відправлено на ' + req.user.email });
  } catch (error) {
    res.status(500).json({ message: 'Помилка відправки: ' + error.message });
  }
};

module.exports = { getSettings, updateSettings, testEmail };