let globalTypesList = [];
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    window.API.checkAuth();
    
    const user = window.API.getUser();

    // Тільки адміністратор має сюди доступ
    if (user.role !== 'admin') {
        window.API.showModal({
            title: 'Доступ заборонено',
            message: 'Тільки для адміністраторів.',
            type: 'alert',
            onConfirm: () => window.location.href = '/pages/dashboard.html'
        });
        return;
    }

    // Setup UI
    const userNameEl = document.getElementById('userName');
    if(userNameEl) userNameEl.textContent = user.fullName || 'Admin';

    await loadDocumentTypes();
});

async function loadDocumentTypes() {
    const tbody = document.getElementById('typesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const types = await window.API.fetchAPI('/document-types');
        tbody.innerHTML = '';

        if (types.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Довідник порожній</td></tr>';
            return;
        }

        globalTypesList = types;
        currentPage = 1;
        renderTablePage();
    } catch (error) {
        console.error('Помилка завантаження типів:', error);
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Помилка завантаження даних</td></tr>';
    }
}

function renderTablePage() {
    const tbody = document.getElementById('typesTableBody');
    tbody.innerHTML = '';
    
    const totalPages = Math.ceil(globalTypesList.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = globalTypesList.slice(start, end);

    pageItems.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors cursor-pointer';
            tr.onclick = () => openEditTypeModal(t._id || t.id);
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900 w-1/3">${t.name}</td>
                <td class="px-6 py-4 whitespace-normal break-words text-sm text-gray-500 w-1/2">${t.description || '—'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="event.stopPropagation(); deleteDocType('${t._id || t.id}')" class="text-red-600 hover:text-red-900">Видалити</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    renderPagination(globalTypesList.length, start, Math.min(end, globalTypesList.length), totalPages);
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

window.openAddTypeModal = () => {
    document.getElementById('typeFormError').classList.add('hidden');
    document.getElementById('addTypeModal').classList.remove('hidden');
};

window.closeAddTypeModal = () => {
    document.getElementById('addTypeModal').classList.add('hidden');
    document.getElementById('addTypeForm').reset();
};

window.createDocType = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('saveTypeBtn');
    const errorBox = document.getElementById('typeFormError');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';
    errorBox.classList.add('hidden');

    try {
        await window.API.fetchAPI('/document-types', 'POST', {
            name: document.getElementById('typeName').value,
            description: document.getElementById('typeDescription').value
        });
        closeAddTypeModal();
        loadDocumentTypes();
    } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зберегти';
    }
};

window.deleteDocType = (id) => {
    window.API.showModal({
        title: 'Видалення типу документа',
        message: 'Ви впевнені, що хочете видалити цей тип? Документи, які вже були створені з цим типом, залишаться, але цей тип більше не буде доступний у списку для нових документів.',
        type: 'confirm',
        onConfirm: async () => {
            try {
                await window.API.fetchAPI(`/document-types/${id}`, 'DELETE');
                loadDocumentTypes();
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
            }
        }
    });
};

window.openEditTypeModal = (id) => {
    const type = globalTypesList.find(t => (t._id || t.id) === id);
    if(!type) return;
    document.getElementById('editTypeId').value = id;
    document.getElementById('editTypeName').value = type.name;
    document.getElementById('editTypeDescription').value = type.description || '';
    document.getElementById('editTypeModal').classList.remove('hidden');
};

window.closeEditTypeModal = () => {
    document.getElementById('editTypeModal').classList.add('hidden');
};

window.updateDocType = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editTypeId').value;
    const submitBtn = document.getElementById('updateTypeBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';
    try {
        await window.API.fetchAPI(`/document-types/${id}`, 'PATCH', {
            name: document.getElementById('editTypeName').value,
            description: document.getElementById('editTypeDescription').value
        });
        closeEditTypeModal();
        loadDocumentTypes();
    } catch(err) {
        window.API.showModal({ title: 'Помилка', message: err.message });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зберегти';
    }
};

window.openEditTypeModal = (id) => {
    const type = globalTypesList.find(t => (t._id || t.id) === id);
    if(!type) return;
    document.getElementById('editTypeId').value = id;
    document.getElementById('editTypeName').value = type.name;
    document.getElementById('editTypeDescription').value = type.description || '';
    document.getElementById('editTypeModal').classList.remove('hidden');
};

window.closeEditTypeModal = () => {
    document.getElementById('editTypeModal').classList.add('hidden');
};

window.updateDocType = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editTypeId').value;
    try {
        await window.API.fetchAPI(`/document-types/${id}`, 'PATCH', {
            name: document.getElementById('editTypeName').value,
            description: document.getElementById('editTypeDescription').value
        });
        closeEditTypeModal();
        loadDocumentTypes();
    } catch(err) {
        window.API.showModal({ title: 'Помилка', message: err.message });
    }
};