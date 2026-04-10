let globalLogsList = [];
let currentPage = 1;
const itemsPerPage = 15;

document.addEventListener('DOMContentLoaded', async () => {
    window.API.checkAuth();
    const user = window.API.getUser();

    if (user.role !== 'admin') {
        window.location.href = '/pages/dashboard.html';
        return;
    }

    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        currentPage = 1;
        fetchLogs();
    });
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('actionFilter').value = '';
        document.getElementById('sortFilter').value = 'desc';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        currentPage = 1;
        fetchLogs();
    });
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') { currentPage = 1; fetchLogs(); }
    });
    
    // Експорт та Очищення
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('clearLogsRequestBtn')?.addEventListener('click', requestClearLogs);

    await fetchLogs();
});

async function fetchLogs() {
    const tbody = document.getElementById('auditTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const search = document.getElementById('searchInput').value;
        const action = document.getElementById('actionFilter').value;
        const sortOrder = document.getElementById('sortFilter').value;
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;

        let query = `?sortOrder=${sortOrder}`;
        if (search) query += `&search=${encodeURIComponent(search)}`;
        if (action) query += `&action=${encodeURIComponent(action)}`;
        if (dateFrom) query += `&dateFrom=${encodeURIComponent(dateFrom)}`;
        if (dateTo) query += `&dateTo=${encodeURIComponent(dateTo)}`;

        globalLogsList = await window.API.fetchAPI(`/users/system/audit${query}`);
        renderTablePage();
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Помилка завантаження логів</td></tr>';
    }
}

function renderTablePage() {
    const tbody = document.getElementById('auditTableBody');
    tbody.innerHTML = '';

    if (globalLogsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">Записів аудиту не знайдено</td></tr>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(globalLogsList.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = globalLogsList.slice(start, end);

    pageItems.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        
        const date = new Date(log.createdAt).toLocaleString('uk-UA');
        let actionColor = 'text-gray-800 bg-gray-100';
        if (log.action === 'Створення') actionColor = 'text-green-800 bg-green-100';
        if (log.action === 'Редагування') actionColor = 'text-blue-800 bg-blue-100';
        if (log.action === 'Видалення') actionColor = 'text-red-800 bg-red-100';

        const esc = window.API.escapeHtml;
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${date}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${esc(log.adminName)}<br><span class="text-xs text-gray-500 font-normal">${esc(log.adminEmail)}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium rounded-full ${actionColor}">${esc(log.action)}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${esc(log.targetEmail) || '—'}</td>
            <td class="px-6 py-4 whitespace-normal break-words text-sm text-gray-600">${esc(log.details) || '—'}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(globalLogsList.length, start, Math.min(end, globalLogsList.length), totalPages);
}

function renderPagination(total, start, end, totalPages) {
    const pagination = document.getElementById('paginationControls');
    if (!pagination) return;
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = `<div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 sm:px-6"><div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">`;
    html += `<div><p class="text-sm text-gray-700">Показано <span class="font-medium">${start + 1}</span> - <span class="font-medium">${end}</span> з <span class="font-medium">${total}</span></p></div>`;
    html += `<div><nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">`;
    html += `<button onclick="currentPage--; renderTablePage()" ${currentPage === 1 ? 'disabled' : ''} class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Попередня</button>`;
    for(let i=1; i<=totalPages; i++) {
        html += `<button onclick="currentPage = ${i}; renderTablePage()" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${i === currentPage ? 'text-indigo-600 bg-indigo-50 z-10' : 'text-gray-700 hover:bg-gray-50'}">${i}</button>`;
    }
    html += `<button onclick="currentPage++; renderTablePage()" ${currentPage === totalPages ? 'disabled' : ''} class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Наступна</button>`;
    html += `</nav></div></div></div>`;
    pagination.innerHTML = html;
}

function exportToCSV() {
    if (globalLogsList.length === 0) {
        window.API.showModal({ title: 'Увага', message: 'Немає даних для експорту.' });
        return;
    }
    
    const headers = ['Дата', 'Ініціатор (Ім\'я)', 'Ініціатор (Email)', 'Дія', 'Ціль (Email)', 'Деталі'];
    const rows = globalLogsList.map(log => [
        new Date(log.createdAt).toLocaleString('uk-UA').replace(/,/g, ''),
        `"${log.adminName}"`,
        `"${log.adminEmail}"`,
        `"${log.action}"`,
        `"${log.targetEmail || ''}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_export_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function requestClearLogs() {
    window.API.showModal({
        title: 'Запит на очищення',
        message: 'Ви впевнені, що хочете повністю очистити аудит лог? На ваш email буде надіслано посилання для підтвердження цієї дії.',
        type: 'confirm',
        onConfirm: async () => {
            try {
                await window.API.fetchAPI('/users/system/audit/clear-request', 'POST');
                window.API.showModal({ title: 'Запит надіслано', message: 'Перевірте вашу пошту для підтвердження очищення логів.' });
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
            }
        }
    });
}