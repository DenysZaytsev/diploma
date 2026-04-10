let dynamicTypeLabels = {}; // Для зберігання типів
let globalDocsList = [];
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    window.API.checkAuth();
    
    const user = window.API.getUser();

    // Setup UI with User Data
    document.getElementById('userName').textContent = user.fullName || 'User';
    
    const roleLabels = {
        'employee': 'Працівник',
        'approver': 'Керівник',
        'admin': 'Адміністратор',
        'signatory': 'Підписант'
    };
    const roleColors = {
        'employee': 'bg-blue-100 text-blue-800 border border-blue-200',
        'approver': 'bg-purple-100 text-purple-800 border border-purple-200',
        'admin': 'bg-red-100 text-red-800 border border-red-200',
        'signatory': 'bg-green-100 text-green-800 border border-green-200'
    };
    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) {
        userRoleEl.textContent = roleLabels[user.role] || user.role;
        userRoleEl.className = `px-2 py-0.5 text-xs font-medium rounded-full inline-block mt-1 ${roleColors[user.role] || 'bg-gray-100 text-gray-800'}`;
    }
    
    // Додаємо посилання на Адмін-панель для Адміністратора в бокове меню
    if (user.role === 'admin') {
        const nav = document.querySelector('aside nav');
        if (nav) {
            nav.insertAdjacentHTML('beforeend', `<a href="/pages/users.html" class="block px-4 py-2 mt-4 bg-red-900/50 text-red-200 hover:bg-red-800/50 rounded-md transition-colors">⚙️ Адмін-панель</a>`);
        }
    }
    
    // Показуємо кнопки "Новий документ" ТІЛЬКИ для Employee (приховані по замовчуванню в HTML)
    if (user.role === 'employee') {
        const createLinks = document.querySelectorAll('a[href*="new-document"], #navNewDoc, #headerNewDocBtn');
        createLinks.forEach(el => {
            el.classList.remove('hidden');
            el.style.display = '';
        });
    }

    // Оновлюємо фільтр статусів правильними системними значеннями
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.innerHTML = `
            <option value="">Всі статуси</option>
            <option value="draft">Чернетка</option>
            <option value="on_approval">На погодженні</option>
            <option value="on_signing">На підписанні</option>
            <option value="signed">Підписано</option>
            <option value="rejected">Відхилено</option>
            <option value="archived">В архіві</option>
        `;
    }

    fetchDocumentTypes();
    fetchDepartments();
    
    // Filters event listener
    document.getElementById('applyFiltersBtn')?.addEventListener('click', fetchDocuments);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
        const fields = ['searchInput', 'typeFilter', 'statusFilter', 'deptFilter', 'directionFilter', 'deadlineBefore', 'createdFrom', 'createdTo'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        fetchDocuments();
    });
    document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') fetchDocuments();
    });
    
    // Додаємо обробник для кнопки експорту
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);

    // Initial fetch
    fetchDocuments();
});

async function fetchDocumentTypes() {
    try {
        const types = await window.API.fetchAPI('/document-types');
        types.forEach(t => dynamicTypeLabels[t.code] = t.name);
        
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            typeFilter.innerHTML = '<option value="">Всі типи</option>' + types.map(t => `<option value="${t.code}">${t.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Не вдалося завантажити довідник типів', error);
    }
}

async function fetchDepartments() {
    try {
        const deps = await window.API.fetchAPI('/departments');
        const deptFilter = document.getElementById('deptFilter');
        if (deptFilter) {
            deptFilter.innerHTML = '<option value="">Всі відділи</option>' + deps.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Не вдалося завантажити відділи', error);
    }
}

async function fetchDocuments() {
    const tbody = document.getElementById('documentsTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-10 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        // Build query string based on filters
        const typeFilter = document.getElementById('typeFilter')?.value;
        const statusFilter = document.getElementById('statusFilter')?.value;
        const searchInput = document.getElementById('searchInput')?.value.trim();
        const deptFilter = document.getElementById('deptFilter')?.value;
        const directionFilter = document.getElementById('directionFilter')?.value;
        const deadlineBefore = document.getElementById('deadlineBefore')?.value;
        const createdFrom = document.getElementById('createdFrom')?.value;
        const createdTo = document.getElementById('createdTo')?.value;

        let queryParams = [];
        if (typeFilter) queryParams.push(`type=${encodeURIComponent(typeFilter)}`);
        if (statusFilter) queryParams.push(`status=${encodeURIComponent(statusFilter)}`);
        if (searchInput) queryParams.push(`search=${encodeURIComponent(searchInput)}`);
        if (deptFilter) queryParams.push(`department=${encodeURIComponent(deptFilter)}`);
        if (directionFilter) queryParams.push(`direction=${encodeURIComponent(directionFilter)}`);
        if (deadlineBefore) queryParams.push(`deadlineBefore=${encodeURIComponent(deadlineBefore)}`);
        if (createdFrom) queryParams.push(`createdFrom=${encodeURIComponent(createdFrom)}`);
        if (createdTo) queryParams.push(`createdTo=${encodeURIComponent(createdTo)}`);
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        // Fetch from API
        const documents = await window.API.fetchAPI(`/documents${queryString}`);
        globalDocsList = documents;
        currentPage = 1;

        renderTablePage();

    } catch (error) {
        console.error('Error fetching documents:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-10 text-center text-red-500">Помилка завантаження даних. Перевірте з\'єднання з сервером.</td></tr>';
    }
}

function renderTablePage() {
    const tbody = document.getElementById('documentsTableBody');
    
    let pagination = document.getElementById('paginationControls');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'paginationControls';
        pagination.className = 'bg-white';
        tbody.parentElement.parentElement.appendChild(pagination);
    }

    // Динамічно оновлюємо заголовки під нові поля
    const thead = tbody.previousElementSibling;
    if (thead) {
        thead.innerHTML = `<tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Створено</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Назва</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Відділ</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Контрагент</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Відповідальний</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дедлайн</th>
        </tr>`;
    }
    
    tbody.innerHTML = '';

    if (globalDocsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-10 text-center text-gray-500">Документів не знайдено</td></tr>';
        pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(globalDocsList.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    
    globalDocsList.slice(start, end).forEach(doc => {
        const tr = document.createElement('tr');
        const safeId = doc._id || doc.id || '';
        if (!safeId) console.error('Документ завантажено без ID:', doc);
        
        tr.className = `hover:bg-blue-50 cursor-pointer transition-colors ${!safeId ? 'bg-red-50' : ''}`;
        tr.onclick = () => {
            if (safeId) {
                localStorage.setItem('currentDocId', safeId);
                window.location.href = `/pages/document.html?id=${safeId}`;
            } else {
                window.API.showModal({ title: 'Помилка', message: 'ID документа не знайдено в базі даних. Зверніться до розробника.' });
            }
        };

        // Type Badge
        let typeColor = 'bg-gray-100 text-gray-800';
        const typeLabels = Object.keys(dynamicTypeLabels).length > 0 ? dynamicTypeLabels : { 'contract': 'Договір', 'act': 'Акт', 'invoice': 'Рахунок' };
        if (doc.type === 'contract') typeColor = 'bg-purple-100 text-purple-800 border border-purple-200';
        if (doc.type === 'act') typeColor = 'bg-blue-100 text-blue-800 border border-blue-200';
        if (doc.type === 'invoice') typeColor = 'bg-green-100 text-green-800 border border-green-200';

        // Status Badge
        let statusColor = 'bg-gray-100 text-gray-800';
        const statusLabels = {
            'draft': 'Чернетка', 
            'on_approval': 'На погодженні', 
            'on_signing': 'На підписанні',
            'signed': 'Підписано', 
            'rejected': 'Відхилено', 'archived': 'В архіві'
        };
        if (doc.status === 'on_approval') statusColor = 'bg-yellow-100 text-yellow-800';
        if (doc.status === 'on_signing') statusColor = 'bg-blue-100 text-blue-800';
        if (doc.status === 'signed') statusColor = 'bg-green-100 text-green-800';
        if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';
        if (doc.status === 'archived') statusColor = 'bg-gray-300 text-gray-800';

        // Direction Badge
        const directionLabels = { 'incoming': '📥 Вхідний', 'outgoing': '📤 Вихідний', 'internal': '📁 Внутр.' };
        const directionText = directionLabels[doc.direction] || '—';

        // Відповідальний
        const esc = window.API.escapeHtml;
        let responsibleName = '<span class="text-gray-400 italic">Невідомо</span>';
        if (['draft', 'rejected', 'archived'].includes(doc.status)) {
            responsibleName = doc.creator ? esc(doc.creator.fullName) : responsibleName;
        } else if (doc.status === 'on_approval') {
            responsibleName = doc.approver ? esc(doc.approver.fullName) : responsibleName;
        } else if (['on_signing', 'signed'].includes(doc.status)) {
            responsibleName = doc.signatory ? esc(doc.signatory.fullName) : responsibleName;
        }

        // Deadline
        let deadlineText = '<span class="text-gray-400">-</span>';
        let deadlineClass = '';
        if (doc.dueDate) {
            const deadlineDate = new Date(doc.dueDate);
            deadlineText = deadlineDate.toLocaleDateString('uk-UA');
            if (deadlineDate < new Date() && !['signed', 'archived'].includes(doc.status)) {
                deadlineClass = 'text-red-600 font-bold bg-red-50 px-2 py-1 rounded';
            }
        }
        
        const createdDate = new Date(doc.createdAt).toLocaleDateString('uk-UA');

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${esc(doc.regNumber) || '—'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdDate}</td>
            <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900">${esc(doc.title)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="block text-xs font-semibold text-gray-500 mb-1">${directionText}</span>
                <span class="px-2 py-0.5 inline-flex text-xs leading-5 font-medium rounded ${typeColor}">
                    ${esc(typeLabels[doc.type] || doc.type || 'Інше')}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${esc(doc.department) || '—'}</td>
            <td class="px-6 py-4 whitespace-normal break-words text-gray-600">${esc(doc.counterparty) || '—'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                    ${statusLabels[doc.status] || doc.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-normal break-words text-sm text-gray-700">${responsibleName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${deadlineClass}">${deadlineText}</td>
        `;
        tbody.appendChild(tr);
    });
    
    renderPagination(globalDocsList.length, start, Math.min(end, globalDocsList.length), totalPages);
}

function renderPagination(total, start, end, totalPages) {
    const pagination = document.getElementById('paginationControls');
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
    if (globalDocsList.length === 0) {
        window.API.showModal({ title: 'Увага', message: 'Немає документів для експорту.' });
        return;
    }
    
    const headers = ['ID', 'Створено', 'Назва', 'Тип', 'Напрямок', 'Відділ', 'Контрагент', 'Статус', 'Дедлайн'];
    
    const rows = globalDocsList.map(doc => {
        const createdDate = new Date(doc.createdAt).toLocaleDateString('uk-UA').replace(/,/g, '');
        const deadline = doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('uk-UA').replace(/,/g, '') : '';
        const typeName = dynamicTypeLabels[doc.type] || doc.type || '';
        
        return [
            `"${doc.regNumber || ''}"`,
            `"${createdDate}"`,
            `"${(doc.title || '').replace(/"/g, '""')}"`,
            `"${typeName}"`,
            `"${doc.direction || ''}"`,
            `"${doc.department || ''}"`,
            `"${(doc.counterparty || '').replace(/"/g, '""')}"`,
            `"${doc.status || ''}"`,
            `"${deadline}"`
        ];
    });
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `documents_export_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
