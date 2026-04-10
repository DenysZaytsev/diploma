// api.js - Helper functions for making API requests

// Якщо фронтенд запущено через окремий сервер (наприклад, Live Server на порту 3000/5500),
// направляємо запити на бекенд (порт 5001). Інакше використовуємо відносний шлях.
const API_BASE_URL = (window.location.port === '3000' || window.location.port === '5500') ? 'http://localhost:5001/api' : '/api';

// HTML escaping to prevent XSS
const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// Helper to get token
const getToken = () => localStorage.getItem('token');
const getUser = () => JSON.parse(localStorage.getItem('user') || '{}');

// Generic Fetch Wrapper
const fetchAPI = async (endpoint, method = 'GET', body = null) => {
    const headers = {};

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        if (body instanceof FormData) {
            config.body = body; // Browser automatically sets Content-Type to multipart/form-data with boundary
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        // Перевіряємо, чи сервер повернув JSON
        const isJson = response.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await response.json() : null;

        if (!response.ok) {
            // Автоматичний логаут при недійсному токені
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }
            throw new Error(data?.message || `Помилка сервера: ${response.status} ${response.statusText}`);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Auth
const login = (email, password) => fetchAPI('/auth/login', 'POST', { email, password });
const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
};

// Check if logged in
const checkAuth = () => {
    if (!getToken() && window.location.pathname !== '/') {
        window.location.href = '/';
    }
};

// Універсальна система модальних вікон
const showModal = ({ title, message, type = 'alert', inputPlaceholder = 'Введіть текст...', onConfirm }) => {
    const existing = document.getElementById('custom-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-[100] flex items-center justify-center transition-opacity';
    
    let inputHtml = '';
    if (type === 'prompt') {
        inputHtml = `<input type="text" id="custom-modal-input" class="mt-4 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500" placeholder="${escapeHtml(inputPlaceholder)}">`;
    }
    
    let cancelBtn = type !== 'alert' 
        ? `<button id="custom-modal-cancel" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium mr-3 transition-colors">Скасувати</button>` 
        : '';
        
    overlay.innerHTML = `
        <div class="relative p-6 w-full max-w-md shadow-xl rounded-xl bg-white transform transition-all">
            <h3 class="text-lg font-bold text-gray-900 mb-2">${escapeHtml(title)}</h3>
            <p class="text-sm text-gray-600">${escapeHtml(message)}</p>
            ${inputHtml}
            <div class="mt-6 flex justify-end">
                ${cancelBtn}
                <button id="custom-modal-confirm" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors">Підтвердити</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    if (type === 'prompt') {
        document.getElementById('custom-modal-input').focus();
    }

    document.getElementById('custom-modal-confirm').addEventListener('click', () => {
        let val = true;
        if (type === 'prompt') {
            const inputVal = document.getElementById('custom-modal-input').value.trim();
            if (!inputVal) {
                document.getElementById('custom-modal-input').classList.add('border-red-500');
                return;
            }
            val = inputVal;
        }
        overlay.remove();
        if (onConfirm) onConfirm(val);
    });

    if (type !== 'alert') {
        document.getElementById('custom-modal-cancel').addEventListener('click', () => {
            overlay.remove();
        });
    }
};

const openProfileSettings = async () => {
    const profile = await fetchAPI('/auth/profile');
    
    const existing = document.getElementById('profile-settings-modal');
    if (existing) existing.remove();

    const notif = profile.notifications || { onStatusChange: true, onNewTask: true };
    const avatarSrc = profile.avatar ? `${API_BASE_URL.replace('/api', '')}${profile.avatar}` : null;

    let notifHtml = '';
    if (profile.role === 'admin') {
        notifHtml = `
            <label class="flex items-center cursor-pointer mb-3">
                <input type="checkbox" id="notifAdminAlerts" ${notif.onAdminAlerts !== false ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 mr-2 w-4 h-4">
                <span class="text-sm text-gray-700">Системні попередження та помилки</span>
            </label>
            <label class="flex items-center cursor-pointer">
                <input type="checkbox" id="notifUserEvents" ${notif.onUserEvents !== false ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 mr-2 w-4 h-4">
                <span class="text-sm text-gray-700">Дії з користувачами (створення, блокування, видалення)</span>
            </label>
        `;
    } else {
        notifHtml = `
            <label class="flex items-center cursor-pointer mb-3">
                <input type="checkbox" id="notifNewTask" ${notif.onNewTask !== false ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 mr-2 w-4 h-4">
                <span class="text-sm text-gray-700">Нові завдання (документи на погодження чи підпис)</span>
            </label>
            <label class="flex items-center cursor-pointer">
                <input type="checkbox" id="notifStatus" ${notif.onStatusChange !== false ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 mr-2 w-4 h-4">
                <span class="text-sm text-gray-700">Зміна статусу моїх документів (погоджено, відхилено)</span>
            </label>
        `;
    }

    const modalHtml = `
    <div id="profile-settings-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-[100] flex items-center justify-center">
        <div class="relative p-6 w-full max-w-md shadow-xl rounded-xl bg-white">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Налаштування профілю</h3>
            <form id="profileSettingsForm">
                <div class="mb-4 text-center">
                    <div class="w-20 h-20 mx-auto rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden mb-2 flex items-center justify-center text-xl font-bold text-indigo-700">
                        ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover">` : (profile.fullName || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <input type="file" id="avatarInput" accept="image/*" class="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 w-full mt-2">
                </div>
                
                <h4 class="font-medium text-gray-800 mb-2 border-b pb-1 mt-6">Сповіщення (Email)</h4>
                <div class="space-y-3 mb-6">
                    ${notifHtml}
                </div>

                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="document.getElementById('profile-settings-modal').remove()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium">Скасувати</button>
                    <button type="submit" id="saveProfileBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">Зберегти</button>
                </div>
            </form>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('profileSettingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        btn.disabled = true; btn.textContent = 'Збереження...';

        const formData = new FormData();
        const fileInput = document.getElementById('avatarInput');
        if (fileInput.files[0]) formData.append('avatar', fileInput.files[0]);
        
        const notifications = {
        };
        
        if (profile.role === 'admin') {
            notifications.onAdminAlerts = document.getElementById('notifAdminAlerts').checked;
            notifications.onUserEvents = document.getElementById('notifUserEvents').checked;
        } else {
            notifications.onNewTask = document.getElementById('notifNewTask').checked;
            notifications.onStatusChange = document.getElementById('notifStatus').checked;
        }
        
        formData.append('notifications', JSON.stringify(notifications));

        try {
            const updatedUser = await fetchAPI('/auth/profile', 'PATCH', formData);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.location.reload(); 
        } catch (error) {
            showModal({ title: 'Помилка', message: error.message });
            btn.disabled = false; btn.textContent = 'Зберегти';
        }
    });
};

// Ініціалізація глобального UI
document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    
    if (user) {
        // 1. Аватар користувача (фото або ініціали в кружечку)
        const initialsEls = document.querySelectorAll('#userInitials');
        initialsEls.forEach(el => {
            if (user.avatar) {
                el.innerHTML = `<img src="${API_BASE_URL.replace('/api', '')}${user.avatar}" class="w-full h-full object-cover rounded-full border border-gray-200">`;
                el.classList.remove('bg-slate-600', 'bg-indigo-800', 'text-white');
            } else {
                el.textContent = (user.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            }
        });
        
        // 2. Ім'я користувача (ПІБ текстом поруч)
        const nameEls = document.querySelectorAll('#userName');
        nameEls.forEach(el => {
            el.textContent = user.fullName || 'User';
            el.classList.remove('hidden', 'sm:block'); // Гарантуємо, що текст ПІБ не ховається на жодному екрані
        });
    }

    // 3. Логіка згортання бічного меню
    const sidebar = document.getElementById('mainSidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => sidebar.classList.toggle('-ml-64'));
        const handleResize = () => {
            if (window.innerWidth < 768) sidebar.classList.add('-ml-64');
            else sidebar.classList.remove('-ml-64');
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Перевірка при завантаженні
    }

    // 3. Глобальна обробка клавіші Escape для закриття модальних вікон
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Знаходимо всі видимі модальні вікна (мають клас fixed та inset-0, і не приховані)
            const visibleModals = Array.from(document.querySelectorAll('.fixed.inset-0')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && !el.classList.contains('hidden');
            });

            if (visibleModals.length > 0) {
                // Беремо верхнє модальне вікно
                const topmostModal = visibleModals[visibleModals.length - 1];

                // Якщо це системний Alert (без кнопки скасувати), натискаємо Підтвердити
                if (topmostModal.id === 'custom-modal-overlay' && !document.getElementById('custom-modal-cancel')) {
                    document.getElementById('custom-modal-confirm')?.click();
                    return;
                }

                // Шукаємо кнопку скасування всередині модалки і симулюємо клік
                const cancelBtn = topmostModal.querySelector('button[id*="cancel"], button[onclick^="close"], button[onclick*="remove"]');
                if (cancelBtn) {
                    cancelBtn.click();
                } else {
                    // Якщо кнопки немає - просто приховуємо або видаляємо
                    if (topmostModal.id.includes('modal') || topmostModal.id.includes('Modal')) topmostModal.remove();
                    else topmostModal.classList.add('hidden');
                }
            }
        }
    });
});

window.API = {
    login,
    logout,
    checkAuth,
    getUser,
    fetchAPI,
    API_BASE_URL,
    showModal,
    openProfileSettings,
    escapeHtml
};
