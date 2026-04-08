document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth
    window.API.checkAuth();
    
    const user = window.API.getUser();

    // 2. Setup UI with User Data
    document.getElementById('userName').textContent = user.fullName || 'User';
    
    const roleLabels = {
        'employee': 'Працівник', // Змінено з "Контрактор"
        'manager': 'Менеджер',
        'admin': 'Адміністратор',
        'signatory': 'Підписант'
    };
    document.getElementById('userRole').textContent = roleLabels[user.role] || user.role;
    
    // Set initials
    const initials = (user.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('userInitials').textContent = initials;

    // Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('uk-UA', options);

    // 3. Fetch Data
    try {
        // Адміністратор тепер також може бачити загальну статистику системи
        await fetchStats();
        await fetchRecentDocuments();
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
});

async function fetchStats() {
    try {
        const stats = await window.API.fetchAPI('/stats');
        
        document.getElementById('statTotal').textContent = stats.totalDocs;
        
        const statInc = document.getElementById('statIncoming');
        if(statInc) { statInc.textContent = stats.incomingDocs || 0; statInc.previousElementSibling.textContent = 'Вхідні'; }
        
        const statOut = document.getElementById('statOutgoing');
        if(statOut) { statOut.textContent = stats.outgoingDocs || 0; statOut.previousElementSibling.textContent = 'Вихідні'; }
        
        const statInP = document.getElementById('statInProgress');
        if(statInP) { statInP.textContent = stats.inProgressDocs || 0; statInP.previousElementSibling.textContent = 'В роботі'; }
        
        const statOver = document.getElementById('statOverdue');
        if(statOver) { statOver.textContent = stats.underReviewDocs || 0; statOver.previousElementSibling.textContent = 'На розгляді'; }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function fetchRecentDocuments() {
    try {
        const documents = await window.API.fetchAPI('/documents');
        const tbody = document.getElementById('recentDocsTable');
        
        tbody.innerHTML = ''; // Clear loading

        if (documents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Немає документів</td></tr>';
            return;
        }

        // Show only top 5 recent
        const recentDocs = documents.slice(0, 5);

        // Динамічно оновлюємо заголовки таблиці
        const thead = tbody.previousElementSibling;
        if (thead) {
            thead.innerHTML = `<tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Назва документа</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Напрямок / Тип</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
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
            if (!safeId) console.error('Документ завантажено без ID:', doc);
            
            tr.className = 'hover:bg-gray-50 cursor-pointer transition-colors';
            tr.onclick = () => {
                if (safeId) {
                    localStorage.setItem('currentDocId', safeId);
                    window.location.href = `/pages/document.html?id=${safeId}`;
                } else {
                    window.API.showModal({ title: 'Помилка', message: 'Відсутній ID документа' });
                }
            };

            // Type Badge color
            let typeColor = 'bg-gray-100 text-gray-800';
            const typeLabels = dynamicTypeLabels;
            if (doc.type === 'contract') typeColor = 'bg-purple-100 text-purple-800';
            if (doc.type === 'act') typeColor = 'bg-blue-100 text-blue-800';
            if (doc.type === 'invoice') typeColor = 'bg-green-100 text-green-800';

            // Status Badge color
            let statusColor = 'bg-gray-100 text-gray-800';
            const statusLabels = {
                'draft': 'Чернетка', 
                'registered': 'Зареєстровані', 
                'under_review': 'На розгляді', 
                'in_progress': 'В роботі',
                'completed': 'Виконано', 
                'rejected': 'Відхилено', 'archived': 'В архіві'
            };
        
        // Direction Badge
        const directionLabels = { 'incoming': '📥 Вхідний', 'outgoing': '📤 Вихідний', 'internal': '📁 Внутр.' };
        const directionText = directionLabels[doc.direction] || '—';

            if (doc.status === 'registered') statusColor = 'bg-blue-100 text-blue-800';
            if (doc.status === 'under_review') statusColor = 'bg-yellow-100 text-yellow-800';
            if (doc.status === 'in_progress') statusColor = 'bg-orange-100 text-orange-800';
            if (doc.status === 'completed') statusColor = 'bg-green-100 text-green-800';
            if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';

            // Deadline formating
            let deadlineText = '-';
            let deadlineClass = '';
            if (doc.dueDate) {
                const deadlineDate = new Date(doc.dueDate);
                deadlineText = deadlineDate.toLocaleDateString('uk-UA');
                if (deadlineDate < new Date() && !['signed', 'archived'].includes(doc.status)) {
                    deadlineClass = 'text-red-600 font-semibold';
                }
            }

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-normal break-words font-medium text-gray-900 w-1/3">${doc.title}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                <span class="block text-xs font-semibold text-gray-500 mb-1">${directionText}</span>
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeColor}">${typeLabels[doc.type] || doc.type}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusLabels[doc.status] || doc.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${deadlineClass}">
                    ${deadlineText}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        document.getElementById('recentDocsTable').innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Помилка завантаження даних</td></tr>';
    }
}
