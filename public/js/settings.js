document.addEventListener('DOMContentLoaded', async () => {
    window.API.checkAuth();
    const user = window.API.getUser();

    if (user.role !== 'admin') {
        window.API.showModal({ title: 'Доступ заборонено', message: 'Тільки для адміністраторів.', type: 'alert', onConfirm: () => window.location.href = '/pages/dashboard.html' });
        return;
    }

    const userNameEl = document.getElementById('userName');
    if(userNameEl) userNameEl.textContent = user.fullName || 'Admin';

    try {
        const settings = await window.API.fetchAPI('/settings');
        document.getElementById('maxUploadFiles').value = settings.maxUploadFiles || 10;
            if(settings.smtpHost) document.getElementById('smtpHost').value = settings.smtpHost;
            if(settings.smtpPort) document.getElementById('smtpPort').value = settings.smtpPort;
            if(settings.smtpUser) document.getElementById('smtpUser').value = settings.smtpUser;
            if(settings.smtpPass) document.getElementById('smtpPass').value = settings.smtpPass;
            if(settings.smtpFrom) document.getElementById('smtpFrom').value = settings.smtpFrom;
    } catch (e) {
        console.error("Не вдалося завантажити налаштування");
    }

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveSettingsBtn');
        const errDiv = document.getElementById('settingsFormError');
        const succDiv = document.getElementById('settingsFormSuccess');
        btn.disabled = true; btn.textContent = 'Збереження...';
        errDiv.classList.add('hidden'); succDiv.classList.add('hidden');

        try {
            const data = { maxUploadFiles: document.getElementById('maxUploadFiles').value };
            const host = document.getElementById('smtpHost').value; if(host) data.smtpHost = host;
            const port = document.getElementById('smtpPort').value; if(port) data.smtpPort = port;
            const user = document.getElementById('smtpUser').value; if(user) data.smtpUser = user;
            const pass = document.getElementById('smtpPass').value; if(pass) data.smtpPass = pass;
            const from = document.getElementById('smtpFrom').value; if(from) data.smtpFrom = from;

            await window.API.fetchAPI('/settings', 'PATCH', data);
            succDiv.classList.remove('hidden');
        } catch (error) {
            errDiv.textContent = error.message; errDiv.classList.remove('hidden');
        } finally {
            btn.disabled = false; btn.textContent = 'Зберегти налаштування';
        }
    });

    document.getElementById('testEmailBtn').addEventListener('click', async () => {
        const btn = document.getElementById('testEmailBtn');
        const originalText = btn.textContent;
        btn.disabled = true; btn.textContent = 'Перевірка...';
        try {
            const data = {};
            const host = document.getElementById('smtpHost').value; if(host) data.smtpHost = host;
            const port = document.getElementById('smtpPort').value; if(port) data.smtpPort = port;
            const user = document.getElementById('smtpUser').value; if(user) data.smtpUser = user;
            const pass = document.getElementById('smtpPass').value; if(pass) data.smtpPass = pass;
            const from = document.getElementById('smtpFrom').value; if(from) data.smtpFrom = from;
            
            const res = await window.API.fetchAPI('/settings/test-email', 'POST', data);
            window.API.showModal({ title: 'Успіх', message: res.message });
        } catch (error) {
            window.API.showModal({ title: 'Помилка', message: error.message });
        } finally {
            btn.disabled = false; btn.textContent = originalText;
        }
    });
});