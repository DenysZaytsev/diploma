let globalDeptsList = [];
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    window.API.checkAuth();
    const user = window.API.getUser();

    if (user.role !== 'admin') {
        window.API.showModal({
            title: 'Доступ заборонено',
            message: 'Тільки для адміністраторів.',
            type: 'alert',
            onConfirm: () => window.location.href = '/pages/dashboard.html'
        });
        return;
    }

    const userNameEl = document.getElementById('userName');
    if(userNameEl) userNameEl.textContent = user.fullName || 'Admin';

    await loadDepartments();
});

async function loadDepartments() {
    const tbody = document.getElementById('deptTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const deps = await window.API.fetchAPI('/departments');
        tbody.innerHTML = '';

        if (deps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Відділів ще немає</td></tr>';
            return;
        }

        globalDeptsList = deps;
        currentPage = 1;
        renderTablePage();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Помилка завантаження даних</td></tr>';
    }
}

function renderTablePage() {
    const tbody = document.getElementById('deptTableBody');
    tbody.innerHTML = '';
    
    const totalPages = Math.ceil(globalDeptsList.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = globalDeptsList.slice(start, end);

    pageItems.forEach(d => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors cursor-pointer';
            tr.onclick = () => openEditDeptModal(d._id || d.id);
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${d.name}</td>
                <td class="px-6 py-4 text-sm text-gray-500 break-words whitespace-normal">${d.description || '—'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="event.stopPropagation(); deleteDept('${d._id || d.id}')" class="text-red-600 hover:text-red-900">Видалити</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    renderPagination(globalDeptsList.length, start, Math.min(end, globalDeptsList.length), totalPages);
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

window.openAddDeptModal = () => {
    document.getElementById('deptFormError').classList.add('hidden');
    document.getElementById('addDeptModal').classList.remove('hidden');
};

window.closeAddDeptModal = () => {
    document.getElementById('addDeptModal').classList.add('hidden');
    document.getElementById('addDeptForm').reset();
};

window.createDept = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('saveDeptBtn');
    const errorBox = document.getElementById('deptFormError');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';
    errorBox.classList.add('hidden');

    try {
        await window.API.fetchAPI('/departments', 'POST', {
            name: document.getElementById('deptName').value,
            description: document.getElementById('deptDescription').value
        });
        closeAddDeptModal();
        loadDepartments();
    } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зберегти';
    }
};

window.deleteDept = (id) => {
    window.API.showModal({
        title: 'Видалення',
        message: 'Ви впевнені, що хочете видалити цей відділ?',
        type: 'confirm',
        onConfirm: async () => {
            try {
                await window.API.fetchAPI(`/departments/${id}`, 'DELETE');
                loadDepartments();
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
            }
        }
    });
};

window.openEditDeptModal = (id) => {
    const dept = globalDeptsList.find(d => (d._id || d.id) === id);
    if(!dept) return;
    document.getElementById('editDeptId').value = id;
    document.getElementById('editDeptName').value = dept.name;
    document.getElementById('editDeptDescription').value = dept.description || '';
    document.getElementById('editDeptModal').classList.remove('hidden');
};

window.closeEditDeptModal = () => {
    document.getElementById('editDeptModal').classList.add('hidden');
};

window.updateDept = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editDeptId').value;
    const submitBtn = document.getElementById('updateDeptBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';
    try {
        await window.API.fetchAPI(`/departments/${id}`, 'PATCH', {
            name: document.getElementById('editDeptName').value,
            description: document.getElementById('editDeptDescription').value
        });
        closeEditDeptModal();
        loadDepartments();
    } catch(err) {
        window.API.showModal({ title: 'Помилка', message: err.message });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зберегти';
    }
};

window.openEditDeptModal = (id) => {
    const dept = globalDeptsList.find(d => (d._id || d.id) === id);
    if(!dept) return;
    document.getElementById('editDeptId').value = id;
    document.getElementById('editDeptName').value = dept.name;
    document.getElementById('editDeptDescription').value = dept.description || '';
    document.getElementById('editDeptModal').classList.remove('hidden');
};

window.closeEditDeptModal = () => {
    document.getElementById('editDeptModal').classList.add('hidden');
};

window.updateDept = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editDeptId').value;
    try {
        await window.API.fetchAPI(`/departments/${id}`, 'PATCH', {
            name: document.getElementById('editDeptName').value,
            description: document.getElementById('editDeptDescription').value
        });
        closeEditDeptModal();
        loadDepartments();
    } catch(err) {
        window.API.showModal({ title: 'Помилка', message: err.message });
    }
};