const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

const sendSystemEmail = async (to, subject, html) => {
    try {
        const settings = await Settings.findOne();
        if (!settings || !settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
            console.log('Поштові налаштування не задані. Пропуск відправки листа.');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort || 465,
            secure: parseInt(settings.smtpPort) === 465,
            auth: { user: settings.smtpUser, pass: settings.smtpPass }
        });

        const from = `"${settings.smtpFrom || 'EDMS System'}" <${settings.smtpUser}>`;
        
        // Підтримка масиву адрес для одночасної відправки декільком людям
        const toAddresses = Array.isArray(to) ? to.join(', ') : to;

        await transporter.sendMail({ from, to: toAddresses, subject, html });
        console.log(`Email успішно відправлено на: ${toAddresses}`);
    } catch (error) {
        console.error('Помилка відправки листа:', error.message);
    }
};

module.exports = { sendSystemEmail };