document.addEventListener('DOMContentLoaded', async () => {
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

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('uk-UA', options);

    try {
        await fetchStats();
        await fetchRecentDocuments();
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
});

async function fetchStats() {
    try {
        const stats = await window.API.fetchAPI('/stats');

        const totalEl = document.getElementById('statTotal');
        if (totalEl) {
            const grid = totalEl.closest('.grid');
            if (grid) {
                grid.className = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8';
                let html = `
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Всього документів</dt><dd class="mt-1 text-3xl font-semibold text-gray-900">${stats.totalDocs}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">В роботі (Активні)</dt><dd class="mt-1 text-3xl font-semibold text-blue-600">${stats.inProgressDocs}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Вхідні / Вихідні / Внутр.</dt><dd class="mt-1 text-xl font-semibold text-gray-800 mt-2">${stats.incomingDocs || 0} / ${stats.outgoingDocs || 0} / ${stats.internalDocs || 0}</dd></div></div>
                `;

                // Feature 5: Overdue count
                if (stats.overdueDocs > 0) {
                    html += `<div class="bg-red-50 overflow-hidden shadow rounded-lg border border-red-200"><div class="p-5"><dt class="text-sm font-medium text-red-600 truncate">Прострочені</dt><dd class="mt-1 text-3xl font-semibold text-red-700">${stats.overdueDocs}</dd></div></div>`;
                }

                html += `
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Чернетки</dt><dd class="mt-1 text-2xl font-semibold text-gray-600">${stats.statusDraft}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">На погодженні</dt><dd class="mt-1 text-2xl font-semibold text-yellow-600">${stats.statusOnApproval}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">На підписанні</dt><dd class="mt-1 text-2xl font-semibold text-indigo-600">${stats.statusOnSigning}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Підписано</dt><dd class="mt-1 text-2xl font-semibold text-green-600">${stats.statusSigned}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Відхилено</dt><dd class="mt-1 text-2xl font-semibold text-red-600">${stats.statusRejected}</dd></div></div>
                    <div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">В архіві</dt><dd class="mt-1 text-2xl font-semibold text-gray-400">${stats.statusArchived}</dd></div></div>
                `;

                // Feature 12: Analytics tiles
                if (stats.avgApprovalTime !== null) {
                    html += `<div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Сер. час погодження</dt><dd class="mt-1 text-2xl font-semibold text-indigo-600">${stats.avgApprovalTime} год</dd></div></div>`;
                }
                if (stats.rejectionRate !== null) {
                    html += `<div class="bg-white overflow-hidden shadow rounded-lg border border-gray-100"><div class="p-5"><dt class="text-sm font-medium text-gray-500 truncate">Рівень відхилення</dt><dd class="mt-1 text-2xl font-semibold ${stats.rejectionRate > 30 ? 'text-red-600' : 'text-gray-600'}">${stats.rejectionRate}%</dd></div></div>`;
                }

                grid.innerHTML = html;
            }
        }

        // Feature 12: Activity feed
        if (stats.recentActivity && stats.recentActivity.length > 0) {
            renderActivityFeed(stats.recentActivity);
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function renderActivityFeed(activities) {
    const container = document.getElementById('activityFeedContainer');
    if (!container) return;

    const esc = window.API.escapeHtml;
    const actionLabels = {
        'create': 'Створено',
        'status_change': 'Зміна статусу',
        'file_upload': 'Завантажено файли',
        'delete': 'Видалено',
        'update': 'Відредаговано',
        'comment': 'Коментар',
        'file_delete': 'Видалено файл'
    };

    let html = '<h3 class="text-lg font-semibold text-gray-800 mb-4">Остання активність</h3>';
    html += '<div class="space-y-3">';

    activities.forEach(a => {
        const time = new Date(a.createdAt).toLocaleString('uk-UA');
        const userName = a.user ? esc(a.user.fullName) : 'Система';
        const docTitle = a.document ? esc(a.document.regNumber || '') : '';
        const action = actionLabels[a.action] || a.action;

        html += `
            <div class="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <p class="text-sm text-gray-800"><span class="font-medium">${userName}</span> — ${esc(action)}</p>
                    ${docTitle ? `<p class="text-xs text-gray-500 mt-0.5">Документ: ${docTitle}</p>` : ''}
                    ${a.comment ? `<p class="text-xs text-gray-600 mt-1 bg-white p-1.5 rounded border">${esc(a.comment)}</p>` : ''}
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap">${time}</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function fetchRecentDocuments() {
    try {
        const user = window.API.getUser();
        let query = '';

        if (user.role === 'approver' || user.role === 'signatory') {
            query = `?department=${encodeURIComponent(user.department)}`;
        }

        const documents = await window.API.fetchAPI(`/documents${query}`);
        const tbody = document.getElementById('recentDocsTable');

        tbody.innerHTML = '';

        if (documents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">Немає документів</td></tr>';
            return;
        }

        const recentDocs = documents.slice(0, 5);

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

        let dynamicTypeLabels = { 'contract': 'Договір', 'act': 'Акт', 'invoice': 'Рахунок' };
        try {
            const types = await window.API.fetchAPI('/document-types');
            dynamicTypeLabels = {};
            types.forEach(t => dynamicTypeLabels[t.code] = t.name);
        } catch (e) { console.warn('Could not fetch types'); }

        recentDocs.forEach(doc => {
            const tr = document.createElement('tr');
            const safeId = doc._id || doc.id || '';

            tr.className = 'hover:bg-gray-50 cursor-pointer transition-colors';
            tr.onclick = () => {
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

            if (doc.status === 'on_approval') statusColor = 'bg-yellow-100 text-yellow-800';
            if (doc.status === 'on_signing') statusColor = 'bg-blue-100 text-blue-800';
            if (doc.status === 'signed') statusColor = 'bg-green-100 text-green-800';
            if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';

            let deadlineText = '-';
            let deadlineClass = '';
            if (doc.dueDate) {
                const deadlineDate = new Date(doc.dueDate);
                deadlineText = deadlineDate.toLocaleDateString('uk-UA');
                if (deadlineDate < new Date() && !['signed', 'archived'].includes(doc.status)) {
                    deadlineClass = 'text-red-600 font-semibold';
                }
            }

            const createdDate = new Date(doc.createdAt).toLocaleDateString('uk-UA');

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${doc.regNumber || '—'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdDate}</td>
                <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900">${esc(doc.title)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="block text-xs font-semibold text-gray-500 mb-1">${directionText}</span>
                    <span class="px-2 py-0.5 inline-flex text-xs leading-5 font-medium rounded ${typeColor}">${esc(typeLabels[doc.type] || doc.type || 'Інше')}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${esc(doc.department) || '—'}</td>
                <td class="px-6 py-4 whitespace-normal break-words text-gray-600">${esc(doc.counterparty) || '—'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusLabels[doc.status] || doc.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-normal break-words text-sm text-gray-700">${responsibleName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${deadlineClass}">
                    ${deadlineText}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        document.getElementById('recentDocsTable').innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-red-500">Помилка завантаження даних</td></tr>';
    }
}
