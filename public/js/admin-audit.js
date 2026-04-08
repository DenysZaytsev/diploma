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

    const initials = (user.fullName || 'A').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const userInitialsEl = document.getElementById('userInitials');
    if(userInitialsEl) userInitialsEl.textContent = initials;

    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        currentPage = 1;
        fetchLogs();
    });
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') { currentPage = 1; fetchLogs(); }
    });

    await fetchLogs();
});

async function fetchLogs() {
    const tbody = document.getElementById('auditTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const search = document.getElementById('searchInput').value;
        const action = document.getElementById('actionFilter').value;
        const sortOrder = document.getElementById('sortFilter').value;

        let query = `?sortOrder=${sortOrder}`;
        if (search) query += `&search=${encodeURIComponent(search)}`;
        if (action) query += `&action=${encodeURIComponent(action)}`;

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

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${date}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${log.adminName}<br><span class="text-xs text-gray-500 font-normal">${log.adminEmail}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium rounded-full ${actionColor}">${log.action}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${log.targetEmail || '—'}</td>
            <td class="px-6 py-4 whitespace-normal break-words text-sm text-gray-600">${log.details || '—'}</td>
        `;
        tbody.appendChild(tr);
    });

    // Можна перевикористати функцію пагінації, якщо вона глобальна, або скопіювати сюди базову
}