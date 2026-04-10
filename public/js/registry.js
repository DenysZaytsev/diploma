let dynamicTypeLabels = {};
let globalDocsList = [];
let currentPage = 1;
const itemsPerPage = 10;
let selectedDocIds = new Set();

document.addEventListener('DOMContentLoaded', () => {
    window.API.checkAuth();

    const user = window.API.getUser();

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

    if (user.role === 'admin') {
        const nav = document.querySelector('aside nav');
        if (nav) {
            nav.insertAdjacentHTML('beforeend', `<a href="/pages/users.html" class="block px-4 py-2 mt-4 bg-red-900/50 text-red-200 hover:bg-red-800/50 rounded-md transition-colors">⚙️ Адмін-панель</a>`);
        }
    }

    if (user.role === 'employee') {
        const createLinks = document.querySelectorAll('a[href*="new-document"], #navNewDoc, #headerNewDocBtn');
        createLinks.forEach(el => {
            el.classList.remove('hidden');
            el.style.display = '';
        });
    }

    // Оновлюємо фільтр статусів
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

    // Додаємо нові фільтри в UI (якщо є контейнер)
    const filtersContainer = document.getElementById('filtersContainer');
    if (filtersContainer) {
        // Add confidentiality filter
        const confFilterHtml = `
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Конфіденційність</label>
                <select id="confidentialityFilter" class="w-full border border-gray-300 rounded-md text-sm p-2">
                    <option value="">Всі рівні</option>
                    <option value="public">Публічний</option>
                    <option value="internal">Внутрішній</option>
                    <option value="confidential">Конфіденційний</option>
                    <option value="secret">Секретний</option>
                </select>
            </div>
        `;
        const tagsFilterHtml = `
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Теги</label>
                <input type="text" id="tagsFilter" placeholder="тег1, тег2" class="w-full border border-gray-300 rounded-md text-sm p-2">
            </div>
        `;
        filtersContainer.insertAdjacentHTML('beforeend', confFilterHtml + tagsFilterHtml);
    }

    // Saved filters UI
    const savedFiltersContainer = document.getElementById('savedFiltersContainer');
    if (savedFiltersContainer) {
        loadSavedFilters();
    }

    fetchDocumentTypes();
    fetchDepartments();

    document.getElementById('applyFiltersBtn')?.addEventListener('click', fetchDocuments);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
        const fields = ['searchInput', 'typeFilter', 'statusFilter', 'deptFilter', 'directionFilter', 'deadlineBefore', 'createdFrom', 'createdTo', 'confidentialityFilter', 'tagsFilter'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        fetchDocuments();
    });
    document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') fetchDocuments();
    });

    document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);

    // Saved filter actions
    document.getElementById('saveFilterBtn')?.addEventListener('click', saveCurrentFilter);

    // Bulk action buttons
    document.getElementById('bulkSubmitBtn')?.addEventListener('click', () => bulkAction('submit'));
    document.getElementById('bulkDeleteBtn')?.addEventListener('click', () => bulkAction('delete'));

    fetchDocuments();
});

async function loadSavedFilters() {
    try {
        const filters = await window.API.fetchAPI('/saved-filters');
        const container = document.getElementById('savedFiltersContainer');
        if (!container) return;
        container.innerHTML = '';
        if (filters.length === 0) return;

        const esc = window.API.escapeHtml;
        filters.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 mr-2 mb-1';
            btn.innerHTML = `${esc(f.name)} <span onclick="event.stopPropagation(); deleteSavedFilter('${f._id}')" class="ml-1 text-indigo-400 hover:text-red-500 cursor-pointer">&times;</span>`;
            btn.onclick = () => applySavedFilter(f.filters);
            container.appendChild(btn);
        });
    } catch (e) {
        console.error('Saved filters error:', e);
    }
}

window.applySavedFilter = (filters) => {
    if (filters.search) document.getElementById('searchInput').value = filters.search;
    if (filters.type) document.getElementById('typeFilter').value = filters.type;
    if (filters.status) document.getElementById('statusFilter').value = filters.status;
    if (filters.department) document.getElementById('deptFilter').value = filters.department;
    if (filters.direction) document.getElementById('directionFilter').value = filters.direction;
    if (filters.deadlineBefore) document.getElementById('deadlineBefore').value = filters.deadlineBefore;
    if (filters.createdFrom) document.getElementById('createdFrom').value = filters.createdFrom;
    if (filters.createdTo) document.getElementById('createdTo').value = filters.createdTo;
    const confEl = document.getElementById('confidentialityFilter');
    if (confEl && filters.confidentiality) confEl.value = filters.confidentiality;
    const tagsEl = document.getElementById('tagsFilter');
    if (tagsEl && filters.tags) tagsEl.value = filters.tags.join(', ');
    fetchDocuments();
};

window.saveCurrentFilter = async () => {
    window.API.showModal({
        title: 'Зберегти фільтр',
        message: 'Введіть назву для збереженого фільтра:',
        type: 'prompt',
        inputPlaceholder: 'Мій фільтр',
        onConfirm: async (name) => {
            const filters = getCurrentFilters();
            try {
                await window.API.fetchAPI('/saved-filters', 'POST', { name, filters });
                loadSavedFilters();
            } catch (e) {
                window.API.showModal({ title: 'Помилка', message: e.message });
            }
        }
    });
};

window.deleteSavedFilter = async (id) => {
    try {
        await window.API.fetchAPI(`/saved-filters/${id}`, 'DELETE');
        loadSavedFilters();
    } catch (e) {
        window.API.showModal({ title: 'Помилка', message: e.message });
    }
};

function getCurrentFilters() {
    return {
        search: document.getElementById('searchInput')?.value || '',
        type: document.getElementById('typeFilter')?.value || '',
        status: document.getElementById('statusFilter')?.value || '',
        department: document.getElementById('deptFilter')?.value || '',
        direction: document.getElementById('directionFilter')?.value || '',
        deadlineBefore: document.getElementById('deadlineBefore')?.value || '',
        createdFrom: document.getElementById('createdFrom')?.value || '',
        createdTo: document.getElementById('createdTo')?.value || '',
        confidentiality: document.getElementById('confidentialityFilter')?.value || '',
        tags: (document.getElementById('tagsFilter')?.value || '').split(',').map(t => t.trim()).filter(Boolean)
    };
}

async function bulkAction(action) {
    if (selectedDocIds.size === 0) {
        window.API.showModal({ title: 'Увага', message: 'Оберіть документи для масової дії.' });
        return;
    }
    const actionLabels = { submit: 'відправити на розгляд', delete: 'видалити' };
    window.API.showModal({
        title: 'Масова дія',
        message: `Ви впевнені, що хочете ${actionLabels[action]} ${selectedDocIds.size} документ(ів)?`,
        type: 'confirm',
        onConfirm: async () => {
            try {
                const result = await window.API.fetchAPI('/documents/bulk', 'POST', {
                    documentIds: Array.from(selectedDocIds),
                    action
                });
                window.API.showModal({
                    title: 'Результат',
                    message: `Успішно: ${result.success}, Помилок: ${result.failed}`
                });
                selectedDocIds.clear();
                fetchDocuments();
            } catch (e) {
                window.API.showModal({ title: 'Помилка', message: e.message });
            }
        }
    });
}

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
    tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-10 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const filters = getCurrentFilters();
        let queryParams = [];
        if (filters.type) queryParams.push(`type=${encodeURIComponent(filters.type)}`);
        if (filters.status) queryParams.push(`status=${encodeURIComponent(filters.status)}`);
        if (filters.search) queryParams.push(`search=${encodeURIComponent(filters.search)}`);
        if (filters.department) queryParams.push(`department=${encodeURIComponent(filters.department)}`);
        if (filters.direction) queryParams.push(`direction=${encodeURIComponent(filters.direction)}`);
        if (filters.deadlineBefore) queryParams.push(`deadlineBefore=${encodeURIComponent(filters.deadlineBefore)}`);
        if (filters.createdFrom) queryParams.push(`createdFrom=${encodeURIComponent(filters.createdFrom)}`);
        if (filters.createdTo) queryParams.push(`createdTo=${encodeURIComponent(filters.createdTo)}`);
        if (filters.confidentiality) queryParams.push(`confidentiality=${encodeURIComponent(filters.confidentiality)}`);
        if (filters.tags.length > 0) queryParams.push(`tags=${encodeURIComponent(filters.tags.join(','))}`);

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const documents = await window.API.fetchAPI(`/documents${queryString}`);
        globalDocsList = documents;
        currentPage = 1;
        selectedDocIds.clear();

        renderTablePage();

    } catch (error) {
        console.error('Error fetching documents:', error);
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-10 text-center text-red-500">Помилка завантаження даних. Перевірте з\'єднання з сервером.</td></tr>';
    }
}

function renderTablePage() {
    const tbody = document.getElementById('documentsTableBody');
    const user = window.API.getUser();

    let pagination = document.getElementById('paginationControls');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'paginationControls';
        pagination.className = 'bg-white';
        tbody.parentElement.parentElement.appendChild(pagination);
    }

    const thead = tbody.previousElementSibling;
    if (thead) {
        thead.innerHTML = `<tr>
            ${user.role === 'employee' ? '<th class="px-3 py-3 text-center"><input type="checkbox" id="selectAllDocs" onchange="toggleSelectAll(this)"></th>' : ''}
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Створено</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Назва</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Відділ</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Контрагент</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Відповідальний</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дедлайн</th>
        </tr>`;
    }

    tbody.innerHTML = '';

    // Bulk actions bar
    const bulkBar = document.getElementById('bulkActionsBar');
    if (bulkBar) {
        bulkBar.style.display = user.role === 'employee' ? '' : 'none';
    }

    if (globalDocsList.length === 0) {
        const colSpan = user.role === 'employee' ? 11 : 10;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-6 py-10 text-center text-gray-500">Документів не знайдено</td></tr>`;
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

        tr.className = `hover:bg-blue-50 cursor-pointer transition-colors ${!safeId ? 'bg-red-50' : ''}`;
        tr.onclick = (e) => {
            if (e.target.type === 'checkbox') return;
            if (safeId) {
                localStorage.setItem('currentDocId', safeId);
                window.location.href = `/pages/document.html?id=${safeId}`;
            }
        };

        let typeColor = 'bg-gray-100 text-gray-800';
        const typeLabels = Object.keys(dynamicTypeLabels).length > 0 ? dynamicTypeLabels : { 'contract': 'Договір', 'act': 'Акт', 'invoice': 'Рахунок' };
        if (doc.type === 'contract') typeColor = 'bg-purple-100 text-purple-800 border border-purple-200';
        if (doc.type === 'act') typeColor = 'bg-blue-100 text-blue-800 border border-blue-200';
        if (doc.type === 'invoice') typeColor = 'bg-green-100 text-green-800 border border-green-200';

        let statusColor = 'bg-gray-100 text-gray-800';
        const statusLabels = {
            'draft': 'Чернетка',
            'on_approval': 'На погодженні',
            'on_signing': 'На підписанні',
            'signed': 'Підписано',
            'rejected': 'Відхилено',
            'archived': 'В архіві'
        };
        if (doc.status === 'on_approval') statusColor = 'bg-yellow-100 text-yellow-800';
        if (doc.status === 'on_signing') statusColor = 'bg-blue-100 text-blue-800';
        if (doc.status === 'signed') statusColor = 'bg-green-100 text-green-800';
        if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';
        if (doc.status === 'archived') statusColor = 'bg-gray-300 text-gray-800';

        const directionLabels = { 'incoming': '📥 Вхідний', 'outgoing': '📤 Вихідний', 'internal': '📁 Внутр.' };
        const directionText = directionLabels[doc.direction] || '—';

        const esc = window.API.escapeHtml;
        let responsibleName = '<span class="text-gray-400 italic">Невідомо</span>';
        if (['draft', 'rejected', 'archived'].includes(doc.status)) {
            responsibleName = doc.creator ? esc(doc.creator.fullName) : responsibleName;
        } else if (doc.status === 'on_approval') {
            responsibleName = doc.approver ? esc(doc.approver.fullName) : responsibleName;
        } else if (['on_signing', 'signed'].includes(doc.status)) {
            responsibleName = doc.signatory ? esc(doc.signatory.fullName) : responsibleName;
        }

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

        // Tags display
        let tagsHtml = '';
        if (doc.tags && doc.tags.length > 0) {
            tagsHtml = '<div class="flex flex-wrap gap-1 mt-1">' + doc.tags.slice(0, 3).map(t => `<span class="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">${esc(t)}</span>`).join('') + (doc.tags.length > 3 ? `<span class="text-xs text-gray-400">+${doc.tags.length - 3}</span>` : '') + '</div>';
        }

        // Confidentiality badge
        const confColors = { 'public': 'bg-green-50 text-green-700', 'internal': 'bg-blue-50 text-blue-700', 'confidential': 'bg-orange-50 text-orange-700', 'secret': 'bg-red-50 text-red-700' };
        const confLabels = { 'public': 'Публ.', 'internal': 'Внутр.', 'confidential': 'Конф.', 'secret': 'Секр.' };
        const confBadge = doc.confidentiality && doc.confidentiality !== 'internal'
            ? `<span class="ml-1 px-1 py-0.5 text-xs rounded ${confColors[doc.confidentiality] || ''}">${confLabels[doc.confidentiality] || ''}</span>`
            : '';

        const checkboxTd = user.role === 'employee'
            ? `<td class="px-3 py-4 text-center" onclick="event.stopPropagation()">
                <input type="checkbox" class="doc-checkbox rounded" value="${safeId}" onchange="toggleDocSelection('${safeId}', this.checked)" ${selectedDocIds.has(safeId) ? 'checked' : ''}>
               </td>`
            : '';

        tr.innerHTML = `
            ${checkboxTd}
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${esc(doc.regNumber) || '—'}${confBadge}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdDate}</td>
            <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900">${esc(doc.title)}${tagsHtml}</td>
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

window.toggleDocSelection = (id, checked) => {
    if (checked) selectedDocIds.add(id);
    else selectedDocIds.delete(id);
    const countEl = document.getElementById('selectedCount');
    if (countEl) countEl.textContent = selectedDocIds.size;
};

window.toggleSelectAll = (checkbox) => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = globalDocsList.slice(start, end);

    pageItems.forEach(doc => {
        const id = doc._id || doc.id;
        if (checkbox.checked) selectedDocIds.add(id);
        else selectedDocIds.delete(id);
    });

    document.querySelectorAll('.doc-checkbox').forEach(cb => cb.checked = checkbox.checked);
    const countEl = document.getElementById('selectedCount');
    if (countEl) countEl.textContent = selectedDocIds.size;
};

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

    const headers = ['ID', 'Створено', 'Назва', 'Тип', 'Напрямок', 'Відділ', 'Контрагент', 'Статус', 'Конфіденційність', 'Теги', 'Дедлайн'];

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
            `"${doc.confidentiality || 'internal'}"`,
            `"${(doc.tags || []).join('; ')}"`,
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
    URL.revokeObjectURL(link.href);
}
