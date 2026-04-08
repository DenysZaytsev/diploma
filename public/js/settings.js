document.addEventListener('DOMContentLoaded', async () => {
    window.API.checkAuth();
    const user = window.API.getUser();

    if (user.role !== 'admin') {
        window.API.showModal({ title: 'Доступ заборонено', message: 'Тільки для адміністраторів.', type: 'alert', onConfirm: () => window.location.href = '/pages/dashboard.html' });
        return;
    }

    const userNameEl = document.getElementById('userName');
    if(userNameEl) userNameEl.textContent = user.fullName || 'Admin';
    const initials = (user.fullName || 'A').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const userInitialsEl = document.getElementById('userInitials');
    if(userInitialsEl) userInitialsEl.textContent = initials;

    try {
        const settings = await window.API.fetchAPI('/settings');
        document.getElementById('maxUploadFiles').value = settings.maxUploadFiles || 10;
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
            await window.API.fetchAPI('/settings', 'PATCH', {
                maxUploadFiles: document.getElementById('maxUploadFiles').value
            });
            succDiv.classList.remove('hidden');
        } catch (error) {
            errDiv.textContent = error.message; errDiv.classList.remove('hidden');
        } finally {
            btn.disabled = false; btn.textContent = 'Зберегти налаштування';
        }
    });
});