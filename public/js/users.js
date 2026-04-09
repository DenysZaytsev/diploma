let globalUsersList = []; // Зберігаємо список для швидкого редагування

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

    // Setup UI UI
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    if(userNameEl) userNameEl.textContent = user.fullName || 'Admin';
    if(userRoleEl) userRoleEl.textContent = 'admin';

    // Сховати меню документів
    ['navRegistry', 'navNewDoc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Слухачі для фільтрів
    document.getElementById('filterRole')?.addEventListener('change', loadUsers);
    document.getElementById('filterDepartment')?.addEventListener('change', loadUsers);

    await loadUsers();
});

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const currentUser = window.API.getUser();
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const role = document.getElementById('filterRole')?.value;
        const dept = document.getElementById('filterDepartment')?.value;
        
        let queryParams = [];
        if (role) queryParams.push(`role=${encodeURIComponent(role)}`);
        if (dept) queryParams.push(`department=${encodeURIComponent(dept)}`);
        
        const queryString = queryParams.length ? '?' + queryParams.join('&') : '';
        
        globalUsersList = await window.API.fetchAPI(`/users${queryString}`);
        const users = globalUsersList;
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center">Користувачів не знайдено</td></tr>';
            document.getElementById('paginationControls').innerHTML = '';
            return;
        }

        currentPage = 1;
        renderTablePage();
    } catch (error) {
        console.error('Помилка завантаження користувачів:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Помилка завантаження даних</td></tr>';
    }
}

function renderTablePage() {
    const tbody = document.getElementById('usersTableBody');
    const pagination = document.getElementById('paginationControls');
    tbody.innerHTML = '';
    
    const totalPages = Math.ceil(globalUsersList.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = globalUsersList.slice(start, end);
    const currentUser = window.API.getUser();
    // Знаходимо повний об'єкт користувача з бази (щоб точно знати isSuperAdmin, навіть якщо його немає в локальному токені)
    const fullCurrentUser = globalUsersList.find(u => u.email === currentUser.email) || currentUser;

    pageItems.forEach(u => {
            const tr = document.createElement('tr');
            tr.className = (u.isBlocked ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50') + ' cursor-pointer transition-colors';
            const roleLabels = { 'employee': 'Працівник', 'approver': 'Керівник', 'admin': 'Адміністратор', 'signatory': 'Підписант' };
            const roleColors = {
                'employee': 'bg-blue-100 text-blue-800 border border-blue-200',
                'approver': 'bg-purple-100 text-purple-800 border border-purple-200',
                'admin': 'bg-red-100 text-red-800 border border-red-200',
                'signatory': 'bg-green-100 text-green-800 border border-green-200'
            };
            
            let displayedRole = roleLabels[u.role] || u.role;
            let roleBadgeClass = roleColors[u.role] || 'bg-gray-100 text-gray-800';
            if (u.isSuperAdmin) {
                displayedRole = 'Головний Адміністратор';
                roleBadgeClass = 'bg-indigo-700 text-white shadow-sm';
            }

            const listInitials = (u.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            const avatarHtml = u.avatar 
                ? `<img src="${window.API.API_BASE_URL.replace('/api', '')}${u.avatar}" class="w-8 h-8 rounded-full object-cover border border-gray-200">`
                : `<div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">${listInitials}</div>`;

            const statusBadge = u.isBlocked 
                ? '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Заблокований</span>'
                : '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Активний</span>';
            
            // Логіка кнопок дій (захист для фронтенду)
            const isSelf = u.email === fullCurrentUser.email;
            const amISuperAdmin = fullCurrentUser.isSuperAdmin;
            
            let actionButtons = '';
            if (isSelf) {
                actionButtons = '<span class="text-gray-400 italic">Це ви</span>';
            } else if (u.isSuperAdmin) { // Головного адміна не можна редагувати/видаляти/блокувати
                actionButtons = '<span class="text-gray-400 font-medium text-xs uppercase">Захищено</span>'; 
            } else if (u.role === 'admin' && !amISuperAdmin) { // Звичайний адмін не може редагувати/видаляти/блокувати інших адмінів
                actionButtons = '<span class="text-gray-400 italic text-xs">Немає доступу</span>'; 
            } else {
                const blockBtnText = u.isBlocked ? 'Розблокувати' : 'Заблокувати';
                const blockBtnClass = u.isBlocked ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900';
                actionButtons = `
                    <button onclick="event.stopPropagation(); toggleBlockUser('${u._id || u.id}', ${u.isBlocked})" class="${blockBtnClass}">${blockBtnText}</button>
                `;
            }
            
            // Логіка для кнопки "Змінити пароль"
            let canChangePassword = false;
            if (amISuperAdmin) {
                canChangePassword = true; // SuperAdmin може міняти всім
            } else if (u.role !== 'admin' && !u.isSuperAdmin) {
                canChangePassword = true; // Admin може міняти тільки не-адмінам
            }

            // Якщо є права на зміну пароля - завжди показуємо кнопку (для SuperAdmin це всі юзери)
            if (canChangePassword) {
                actionButtons += `<button onclick="event.stopPropagation(); openChangePasswordModal('${u._id || u.id}')" class="text-indigo-600 hover:text-indigo-900 mx-2">Пароль</button>`;
            }
            
            if (!isSelf && !u.isSuperAdmin && !(u.role === 'admin' && !amISuperAdmin)) {
                actionButtons += `<button onclick="event.stopPropagation(); deleteUser('${u._id || u.id}')" class="text-red-600 hover:text-red-900">Видалити</button>`;
            }

            tr.onclick = () => {
                // Дозволяємо Головному адміну редагувати себе, забороняємо іншим
                if (u.isSuperAdmin && !isSelf) { 
                    window.API.showModal({ title: 'Доступ заборонено', message: 'Ви не маєте прав для редагування Головного адміністратора', type: 'alert' });
                    return;
                }
                // Дозволяємо звичайному адміну редагувати себе, забороняємо іншим
                if (u.role === 'admin' && !amISuperAdmin && !isSelf) {
                    window.API.showModal({ title: 'Доступ заборонено', message: 'Ви не маєте прав для редагування іншого адміністратора', type: 'alert' });
                    return;
                }
                openEditUserModal(u._id || u.id);
            };

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900 w-1/4">
                    <div class="flex items-center space-x-3">
                        ${avatarHtml}
                        <span>${u.fullName}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-normal break-words text-gray-500 w-1/4">${u.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded flex items-center w-fit ${roleBadgeClass}">${displayedRole}</span>
                </td>
                <td class="px-6 py-4 whitespace-normal break-words text-gray-500">${u.department || '—'}</td>
                <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    ${actionButtons}
                </td>
            `;
            tbody.appendChild(tr);
        });

    renderPagination(globalUsersList.length, start, Math.min(end, globalUsersList.length), totalPages);
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

window.deleteUser = (id) => {
    window.API.showModal({
        title: 'Підтвердження',
        message: 'Ви впевнені, що хочете видалити цього користувача?',
        type: 'confirm',
        onConfirm: async () => {
            try {
                await window.API.fetchAPI(`/users/${id}`, 'DELETE');
                loadUsers();
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
            }
        }
    });
};

window.toggleBlockUser = (id, isBlocked) => {
    const action = isBlocked ? 'розблокувати' : 'заблокувати';
    window.API.showModal({
        title: 'Підтвердження',
        message: `Ви впевнені, що хочете ${action} цього користувача?`,
        type: 'confirm',
        onConfirm: async () => {
            try {
                await window.API.fetchAPI(`/users/${id}`, 'PATCH', { isBlocked: !isBlocked });
                loadUsers();
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
            }
        }
    });
};

// Модальне вікно створення
window.openAddUserModal = () => {
    const currentUser = window.API.getUser();
    const fullCurrentUser = globalUsersList.find(u => u.email === currentUser.email) || currentUser;
    const newRoleSelect = document.getElementById('newRole');
    
    if (fullCurrentUser.isSuperAdmin) {
        newRoleSelect.innerHTML = `
            <option value="employee">Працівник (Ініціатор)</option>
            <option value="approver">Керівник відділу</option>
            <option value="signatory">Підписант (Signatory)</option>
            <option value="admin">Адміністратор</option>
        `;
    } else {
        newRoleSelect.innerHTML = `
            <option value="employee">Працівник (Ініціатор)</option>
            <option value="approver">Керівник відділу</option>
            <option value="signatory">Підписант (Signatory)</option>
        `;
    }
    document.getElementById('addUserModal').classList.remove('hidden');
};

window.closeAddUserModal = () => {
    document.getElementById('addUserModal').classList.add('hidden');
    document.getElementById('addUserForm').reset();
};

window.createUser = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('saveUserBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';

    try {
        await window.API.fetchAPI('/users', 'POST', {
            fullName: document.getElementById('newFullName').value,
            email: document.getElementById('newEmail').value,
            password: document.getElementById('newPassword').value,
            role: document.getElementById('newRole').value,
            department: document.getElementById('newDepartment').value
        });
        closeAddUserModal();
        loadUsers();
    } catch (error) {
        window.API.showModal({ title: 'Помилка', message: error.message });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зберегти';
    }
};

// --- Логіка зміни пароля ---
window.openChangePasswordModal = (id) => {
    document.getElementById('changePasswordUserId').value = id;
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
    document.getElementById('changePasswordModal').classList.remove('hidden');
};

window.closeChangePasswordModal = () => {
    document.getElementById('changePasswordModal').classList.add('hidden');
    document.getElementById('changePasswordForm').reset();
};

window.submitChangePassword = async (e) => {
    e.preventDefault();
    const pwd1 = document.getElementById('newPasswordInput').value;
    const pwd2 = document.getElementById('confirmPasswordInput').value;

    if (pwd1 !== pwd2) {
        window.API.showModal({ title: 'Помилка', message: 'Паролі не співпадають!' });
        return;
    }

    const id = document.getElementById('changePasswordUserId').value;
    const btn = document.getElementById('savePasswordBtn');
    btn.disabled = true;
    btn.textContent = 'Збереження...';

    try {
        await window.API.fetchAPI(`/users/${id}`, 'PATCH', { password: pwd1 });
        closeChangePasswordModal();
        window.API.showModal({ title: 'Успіх', message: 'Пароль успішно змінено.' });
    } catch (error) {
        window.API.showModal({ title: 'Помилка', message: error.message });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Зберегти пароль';
    }
};

// Модальне вікно редагування
window.openEditUserModal = (id) => {
    const user = globalUsersList.find(u => (u._id || u.id) === id);
    if (!user) return;
    
    const currentUser = window.API.getUser();
    const fullCurrentUser = globalUsersList.find(u => u.email === currentUser.email) || currentUser;
    
    document.getElementById('editUserId').value = id;
    document.getElementById('editFullName').value = user.fullName;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editRole').value = user.role;
    document.getElementById('editDepartment').value = user.department || '';
    
    // Блокуємо зміну ролі для Головного адміністратора
    const roleSelect = document.getElementById('editRole');
    const roleDisplaySpan = document.getElementById('editRoleDisplay'); // Новий елемент для відображення ролі
    const deptSelect = document.getElementById('editDepartment');
    
    const isSelf = user.email === fullCurrentUser.email;
    const isRegularAdminSelf = isSelf && fullCurrentUser.role === 'admin' && !fullCurrentUser.isSuperAdmin;

    if (user.isSuperAdmin) {
        roleSelect.style.display = 'none'; // Приховуємо select
        roleDisplaySpan.textContent = 'Головний Адміністратор'; // Показуємо текст
        roleDisplaySpan.style.display = 'block';
        roleSelect.disabled = true; // Заборонити зміну
        roleSelect.classList.add('bg-gray-100', 'cursor-not-allowed'); // Візуально показати, що неактивно
        roleSelect.innerHTML = `<option value="${user.role}">${user.role}</option>`;
        roleSelect.value = user.role;
    } else {
        roleSelect.style.display = 'block'; // Показуємо select
        roleDisplaySpan.style.display = 'none'; // Приховуємо текст
        
        if (isRegularAdminSelf) {
            // Звичайний адмін не може змінити свою власну роль
            roleSelect.disabled = true;
            roleSelect.classList.add('bg-gray-100', 'cursor-not-allowed');
            roleSelect.innerHTML = `<option value="admin">Адміністратор</option>`;
        } else {
            roleSelect.disabled = false;
            roleSelect.title = '';
            roleSelect.classList.remove('bg-gray-100', 'cursor-not-allowed');
            
            // Якщо поточний користувач (той, хто редагує) НЕ SuperAdmin, він не може призначати роль "admin"
            if (!fullCurrentUser.isSuperAdmin) {
                roleSelect.innerHTML = `
                    <option value="employee">Працівник (Ініціатор)</option>
                    <option value="approver">Керівник відділу</option>
                    <option value="signatory">Підписант (Signatory)</option>
                `;
            } else { // Поточний користувач (той, хто редагує) є SuperAdmin, він може призначати всі ролі
                roleSelect.innerHTML = `
                    <option value="employee">Працівник (Ініціатор)</option>
                    <option value="approver">Керівник відділу</option>
                    <option value="signatory">Підписант (Signatory)</option>
                    <option value="admin">Адміністратор</option>
                `;
            }
        }
        roleSelect.value = user.role; // Встановлюємо поточну роль
    }
    
    // Блокуємо зміну відділу для звичайного адміна самому собі
    if (isRegularAdminSelf) {
        deptSelect.disabled = true;
        deptSelect.classList.add('bg-gray-100', 'cursor-not-allowed');
    } else {
        deptSelect.disabled = false;
        deptSelect.classList.remove('bg-gray-100', 'cursor-not-allowed');
    }

    document.getElementById('editUserModal').classList.remove('hidden');
};

window.closeEditUserModal = () => {
    document.getElementById('editUserModal').classList.add('hidden');
    document.getElementById('editUserForm').reset();
};

window.updateUser = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('updateUserBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';

    const id = document.getElementById('editUserId').value;
    
    const payload = {
        fullName: document.getElementById('editFullName').value,
        email: document.getElementById('editEmail').value,
        department: document.getElementById('editDepartment').value
    };
    
    const roleVal = document.getElementById('editRole').value;
    if (roleVal) payload.role = roleVal;

    try {
        await window.API.fetchAPI(`/users/${id}`, 'PATCH', payload);
        closeEditUserModal();
        loadUsers();
    } catch (error) {
        window.API.showModal({ title: 'Помилка', message: error.message });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зберегти зміни';
    }
};