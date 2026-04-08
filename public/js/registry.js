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
        'employee': 'Працівник', // Змінено з "Контрактор"
        'manager': 'Менеджер',
        'admin': 'Адміністратор',
        'signatory': 'Підписант'
    };
    document.getElementById('userRole').textContent = roleLabels[user.role] || user.role;
    
    const initials = (user.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('userInitials').textContent = initials;

    // Prevent Admin from viewing document registry
    if (user.role === 'admin') {
        window.API.showModal({
            title: 'Інформація',
            message: 'Перенаправлення в панель адміністратора...',
            type: 'alert',
            onConfirm: () => window.location.href = '/pages/users.html'
        });
        return;
    }
    
    // Приховуємо кнопку створення документа та меню для не-контракторів
    if (user.role !== 'employee') {
        const navNewDoc = document.getElementById('navNewDoc');
        if (navNewDoc) navNewDoc.style.display = 'none';
        // Приховуємо загальну кнопку "Створити", якщо вона є у HTML реєстру
        const createBtn = document.getElementById('btnCreateDocument');
        if (createBtn) createBtn.style.display = 'none';
    }

    // Оновлюємо фільтр статусів правильними системними значеннями
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.innerHTML = `
            <option value="">Всі статуси</option>
            <option value="draft">Чернетка</option>
            <option value="registered">Зареєстровані</option>
            <option value="under_review">На розгляді</option>
            <option value="in_progress">В роботі</option>
            <option value="completed">Виконано</option>
            <option value="rejected">Відхилено</option>
            <option value="archived">В архіві</option>
        `;
    }

    fetchDocumentTypes();
    // Filters event listener
    document.getElementById('applyFiltersBtn').addEventListener('click', fetchDocuments);
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if(e.key === 'Enter') fetchDocuments();
    });

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

async function fetchDocuments() {
    const tbody = document.getElementById('documentsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        // Build query string based on filters
        const typeFilter = document.getElementById('typeFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchInput = document.getElementById('searchInput').value.trim();

        let queryParams = [];
        if (typeFilter) queryParams.push(`type=${encodeURIComponent(typeFilter)}`);
        if (statusFilter) queryParams.push(`status=${encodeURIComponent(statusFilter)}`);
        if (searchInput) queryParams.push(`search=${encodeURIComponent(searchInput)}`);
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        // Fetch from API
        const documents = await window.API.fetchAPI(`/documents${queryString}`);
        globalDocsList = documents;
        currentPage = 1;

        renderTablePage();

    } catch (error) {
        console.error('Error fetching documents:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-red-500">Помилка завантаження даних. Перевірте з\'єднання з сервером.</td></tr>';
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
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Назва</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Контрагент</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ініціатор</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дедлайн</th>
        </tr>`;
    }
    
    tbody.innerHTML = '';

    if (globalDocsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-gray-500">Документів не знайдено</td></tr>';
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
            'registered': 'Зареєстровані', 
            'under_review': 'На розгляді', 
            'in_progress': 'В роботі',
            'completed': 'Виконано', 
            'rejected': 'Відхилено', 'archived': 'В архіві'
        };
        if (doc.status === 'registered') statusColor = 'bg-blue-100 text-blue-800';
        if (doc.status === 'under_review') statusColor = 'bg-yellow-100 text-yellow-800';
        if (doc.status === 'in_progress') statusColor = 'bg-orange-100 text-orange-800';
        if (doc.status === 'completed') statusColor = 'bg-green-100 text-green-800';
        if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';
        if (doc.status === 'archived') statusColor = 'bg-gray-300 text-gray-800';

        // Direction Badge
        const directionLabels = { 'incoming': '📥 Вхідний', 'outgoing': '📤 Вихідний', 'internal': '📁 Внутр.' };
        const directionText = directionLabels[doc.direction] || '—';

        // Creator
        const creatorName = doc.creator ? doc.creator.fullName : '<span class="text-gray-400 italic">Невідомо</span>';

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

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900">${doc.title}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="block text-xs font-semibold text-gray-500 mb-1">${directionText}</span>
                <span class="px-2 py-0.5 inline-flex text-xs leading-5 font-medium rounded ${typeColor}">
                    ${typeLabels[doc.type] || doc.type || 'Інше'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-normal break-words text-gray-600">${doc.counterparty || '—'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                    ${statusLabels[doc.status] || doc.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-normal break-words text-sm text-gray-700">${creatorName}</td>
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
