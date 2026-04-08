// api.js - Helper functions for making API requests

const API_BASE_URL = '/api';

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
        inputHtml = `<input type="text" id="custom-modal-input" class="mt-4 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500" placeholder="${inputPlaceholder}">`;
    }
    
    let cancelBtn = type !== 'alert' 
        ? `<button id="custom-modal-cancel" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium mr-3 transition-colors">Скасувати</button>` 
        : '';
        
    overlay.innerHTML = `
        <div class="relative p-6 w-full max-w-md shadow-xl rounded-xl bg-white transform transition-all">
            <h3 class="text-lg font-bold text-gray-900 mb-2">${title}</h3>
            <p class="text-sm text-gray-600">${message}</p>
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

window.API = {
    login,
    logout,
    checkAuth,
    getUser,
    fetchAPI,
    API_BASE_URL,
    showModal
};
