let currentDocId = null;

document.addEventListener('DOMContentLoaded', async () => {
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

    // Block Admin from reading document content
    if (user.role === 'admin') {
        window.API.showModal({
            title: 'Доступ заборонено',
            message: 'Адміністратори не мають доступу до перегляду документів.',
            type: 'alert',
            onConfirm: () => window.location.href = '/pages/dashboard.html'
        });
        return;
    }

    // Надійний парсинг ID документа з URL (ігнорує специфіку локальних серверів)
    const rawUrl = window.location.href;
    const idMatch = rawUrl.match(/[?&]id=([^&#/]+)/);
    currentDocId = idMatch ? idMatch[1] : localStorage.getItem('currentDocId');

    // Зберігаємо ID в localStorage, щоб при оновленні сторінки документ не губився
    if (currentDocId) {
        localStorage.setItem('currentDocId', currentDocId);
    }

    if (!currentDocId || currentDocId === 'undefined' || currentDocId === 'null') {
        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('errorIndicator').innerHTML = `Помилка: Неможливо зчитати ID документа. <br> <span class="text-xs text-gray-500">Поточний URL: ${rawUrl}</span><br>Будь ласка, оберіть документ з <a href="/pages/registry.html" class="text-blue-600 underline hover:text-blue-800">Реєстру</a>.`;
        document.getElementById('errorIndicator').classList.remove('hidden');
        return;
    }

    await loadDocumentDetails();
    await loadAuditTrail();

});

async function loadDocumentDetails() {
    try {
        const doc = await window.API.fetchAPI(`/documents/${currentDocId}`);
        const user = window.API.getUser();

        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('docContent').classList.remove('hidden');

        // Fill Details
        document.getElementById('headerDocTitle').textContent = doc.title || 'Документ';
        document.getElementById('docRegNumber').textContent = `ID: ${doc._id.substring(0, 6).toUpperCase()}`;
        document.getElementById('docTitle').textContent = doc.title;
        document.getElementById('docCorrespondent').textContent = doc.counterparty || '—';
        document.getElementById('docDate').textContent = new Date(doc.createdAt).toLocaleDateString('uk-UA');
        document.getElementById('docRegistrar').textContent = doc.creator ? doc.creator.fullName : '—';
        
        try {
            const types = await window.API.fetchAPI('/document-types');
            const typeObj = types.find(t => t.code === doc.type);
            document.getElementById('docType').textContent = typeObj ? typeObj.name : doc.type;
        } catch (e) {
            const typeLabels = { 'contract': 'Договір', 'act': 'Акт', 'invoice': 'Рахунок' };
            document.getElementById('docType').textContent = typeLabels[doc.type] || doc.type;
        }

        // Files Viewer
        const viewerContainer = document.getElementById('fileViewerContainer');
        
        // Примусово прибираємо внутрішній скрол та обмеження висоти з контейнерів, 
        // щоб вони розтягувалися на всі файли, а скролилася вся сторінка
        viewerContainer.style.maxHeight = 'none';
        viewerContainer.style.height = 'auto';
        viewerContainer.style.overflow = 'visible';
        viewerContainer.style.position = 'relative';
        viewerContainer.classList.remove('overflow-y-auto', 'overflow-auto', 'max-h-96', 'max-h-[800px]', 'max-h-screen', 'h-full', 'h-screen', 'absolute', 'fixed');
        
        const fileSection = document.getElementById('fileSection');
        if (fileSection) {
            fileSection.style.maxHeight = 'none';
            fileSection.style.height = 'auto';
            fileSection.style.overflow = 'visible';
            fileSection.style.position = 'relative';
            fileSection.style.clear = 'both';
            fileSection.style.marginTop = '2rem';
            fileSection.classList.remove('overflow-y-auto', 'overflow-auto', 'max-h-96', 'max-h-[800px]', 'max-h-screen', 'h-full', 'h-screen', 'absolute', 'fixed', 'flex-1');
        }
        
        // Завжди показуємо секцію файлів, щоб відобразити або форму завантаження, або повідомлення про відсутність
        document.getElementById('fileSection').classList.remove('hidden');
        
        // Приховуємо старі хардкодні посилання з HTML, щоб вони не ламали логіку
        const legacyLink = document.getElementById('docFileLink');
        if (legacyLink && legacyLink.parentElement) {
            legacyLink.parentElement.style.display = 'none';
        }

        // Завантажуємо налаштування для лімітів
        let currentSettings = { maxUploadFiles: 10 };
        try {
            currentSettings = await window.API.fetchAPI('/settings');
        } catch (e) {
            console.warn('Could not load settings, using defaults');
        }

        let filesHtml = '';

        if (doc.files && doc.files.length > 0) {
            // Обертаємо ВСІ файли в єдиний вертикальний контейнер на 100% ширини
            filesHtml += `<div class="flex flex-col w-full">`;
            
            // Відображення прев'ю для файлів
            doc.files.forEach(f => {
                const baseUrl = window.API.API_BASE_URL.replace('/api', '');
                const fileUrl = baseUrl + f.path;
                const ext = f.path.split('.').pop().toLowerCase();
                
                // Контейнер окремого файлу з нижньою рискою (окрім останнього)
                filesHtml += `<div class="w-full flex flex-col mb-10 pb-10 border-b-2 border-gray-300 last:border-b-0 last:pb-0 last:mb-0">`;
                
                // 1. Назва файлу, розмір формат
                filesHtml += `
                    <div class="mb-4">
                        <h4 class="text-xl font-bold text-gray-900">${f.originalName}</h4>
                        <p class="text-sm text-gray-600 mt-1">Розмір: ${(f.size / 1024).toFixed(1)} KB | Формат: ${ext.toUpperCase()}</p>
                    </div>`;

                // 2 & 3. Кнопки Відкрити та Завантажити (в один рядок)
                const canUpload = (doc.status === 'draft' || doc.status === 'rejected') && user.role === 'employee';
                filesHtml += `
                    <div class="flex flex-row flex-wrap items-center gap-3 mb-6">
                        <a href="${fileUrl}" target="_blank" class="px-6 py-2.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap">
                            <svg class="h-5 w-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            Відкрити
                        </a>
                        <a href="${fileUrl}" download="${f.originalName}" class="px-6 py-2.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap">
                            <svg class="h-5 w-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Завантажити
                        </a>
                        ${canUpload ? `
                        <button onclick="deleteFile('${f._id || f.id}')" class="px-6 py-2.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap ml-auto">
                            <svg class="h-5 w-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Видалити
                        </button>
                        ` : ''}
                    </div>`;

                // 4. ОКРЕМИЙ плейсхолдер для превью файлу
                filesHtml += `<div class="w-full bg-gray-50 border border-gray-200 rounded-lg flex justify-center p-0 overflow-hidden">`;
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    filesHtml += `<img src="${fileUrl}" class="max-w-full h-auto object-contain max-h-[800px]" alt="${f.originalName}">`;
                } else if (ext === 'pdf') {
                    filesHtml += `<iframe src="${fileUrl}#toolbar=1&navpanes=0&view=FitH" class="w-full h-[800px] border-0" allowfullscreen></iframe>`;
                } else {
                    filesHtml += `
                        <div class="py-12 text-center w-full">
                            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <p class="mt-2 text-sm text-gray-500">Попередній перегляд недоступний для цього формату.</p>
                        </div>`;
                }
                filesHtml += `</div>`; // Закриваємо область прев'ю
                filesHtml += `</div>`; // Закриваємо загальний блок одного файлу (під ним буде margin і border-b)
            });
            filesHtml += `</div>`; // Закриваємо flex flex-col w-full
        } else {
            filesHtml += '<p class="text-gray-500 p-4 text-center border rounded-md bg-gray-50 mb-4">Файли відсутні.</p>';
        }

        // Додаємо прихований інпут для завантаження файлів (якщо є права)
        if ((doc.status === 'draft' || doc.status === 'rejected') && user.role === 'employee') {
            filesHtml += `<input type="file" id="hiddenFileInput" multiple class="hidden" />`;
        }

        viewerContainer.innerHTML = filesHtml;

        // Обробник подій для прихованого інпуту
        const hiddenInput = document.getElementById('hiddenFileInput');
        if (hiddenInput) {
            hiddenInput.addEventListener('change', async (e) => {
                if (e.target.files.length === 0) return;
                
                if (e.target.files.length + (doc.files ? doc.files.length : 0) > currentSettings.maxUploadFiles) {
                    window.API.showModal({ title: 'Помилка', message: `Ліміт завантаження: ${currentSettings.maxUploadFiles} файлів. Можна додати ще максимум ${currentSettings.maxUploadFiles - (doc.files ? doc.files.length : 0)}.` });
                    hiddenInput.value = ''; // Скидаємо вибір
                    return;
                }

                // Показуємо загальний лоадер під час завантаження
                document.getElementById('loadingIndicator').classList.remove('hidden');
                document.getElementById('docContent').classList.add('hidden');

                const formData = new FormData();
                for (let i = 0; i < e.target.files.length; i++) {
                    formData.append('files', e.target.files[i]);
                }

                try {
                    await window.API.fetchAPI(`/documents/${currentDocId}/files`, 'POST', formData);
                    await loadDocumentDetails(); // Оновлюємо сторінку після успішного завантаження
                    await loadAuditTrail();
                } catch (error) {
                    window.API.showModal({ title: 'Помилка завантаження', message: error.message });
                    document.getElementById('loadingIndicator').classList.add('hidden');
                    document.getElementById('docContent').classList.remove('hidden');
                }
            });
        }

        // Status Badge
        const statusBadge = document.getElementById('docStatusBadge');
        const statusLabels = {
            'draft': 'Чернетка', 
            'registered': 'Зареєстровані', 
            'under_review': 'На розгляді', 
            'in_progress': 'В роботі',
            'completed': 'Виконано', 
            'rejected': 'Відхилено', 'archived': 'В архіві'
        };
        statusBadge.textContent = statusLabels[doc.status] || doc.status;
        
        let statusColor = 'bg-gray-100 text-gray-800';
        if (doc.status === 'registered') statusColor = 'bg-blue-100 text-blue-800';
        if (doc.status === 'under_review') statusColor = 'bg-yellow-100 text-yellow-800';
        if (doc.status === 'in_progress') statusColor = 'bg-orange-100 text-orange-800';
        if (doc.status === 'completed') statusColor = 'bg-green-100 text-green-800';
        if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';
        if (doc.status === 'archived') statusColor = 'bg-gray-300 text-gray-800';
        statusBadge.className = `px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${statusColor}`;

        // Execution Info
        const managerEl = document.getElementById('docManager');
        if (managerEl) managerEl.textContent = doc.manager ? doc.manager.fullName : '—';
        
        const executorEl = document.getElementById('docExecutor');
        if (executorEl) {
            executorEl.textContent = doc.signatory ? doc.signatory.fullName : '—';
            // Безпечна зміна заголовка (label) для підписанта
            const labelEl = executorEl.previousElementSibling;
            if (labelEl && labelEl.tagName.toLowerCase() === 'dt') {
                labelEl.textContent = 'Підписант';
            }
        }
        
        if (doc.dueDate) {
            const deadlineDate = new Date(doc.dueDate);
            const dlElem = document.getElementById('docDeadline');
            dlElem.textContent = deadlineDate.toLocaleDateString('uk-UA');
            if (deadlineDate < new Date() && !['signed', 'archived'].includes(doc.status)) {
                dlElem.className = 'font-bold text-red-600';
            } else {
                dlElem.className = 'font-medium text-gray-900';
            }
        } else {
            document.getElementById('docDeadline').textContent = '—';
        }

        renderActionButtons(doc, user);

    } catch (error) {
        console.error(error);
        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('errorIndicator').textContent = 'Помилка завантаження. ' + error.message;
        document.getElementById('errorIndicator').classList.remove('hidden');
    }
}

function renderActionButtons(doc, user) {
    const actionContainer = document.getElementById('actionButtons');
    actionContainer.innerHTML = '';
    let hasActions = false;

    const createBtn = (text, colorClass, onClick) => {
        hasActions = true;
        const btn = document.createElement('button');
        btn.className = `px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none ${colorClass}`;
        btn.textContent = text;
        btn.onclick = onClick;
        return btn;
    };

    const performAction = async (action, body = null) => {
        try {
            await window.API.fetchAPI(`/documents/${currentDocId}/${action}`, 'POST', body);
            await loadDocumentDetails();
            await loadAuditTrail();
        } catch (error) {
            window.API.showModal({ title: 'Помилка', message: error.message });
        }
    };

    const performActionWithConfirm = (action, title, message, body = null) => {
        window.API.showModal({
            title,
            message,
            type: 'confirm',
            onConfirm: () => performAction(action, body)
        });
    };

    const deleteDoc = () => {
        window.API.showModal({
            title: 'Видалення',
            message: 'Ви впевнені, що хочете видалити цей документ? Ця дія незворотна.',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await window.API.fetchAPI(`/documents/${currentDocId}`, 'DELETE');
                    window.API.showModal({ 
                        title: 'Успіх', 
                        message: 'Документ успішно видалено.', 
                        onConfirm: () => window.location.href = '/pages/registry.html' 
                    });
                } catch (error) {
                    window.API.showModal({ title: 'Помилка видалення', message: error.message });
                }
            }
        });
    };

    const exportArchive = async () => {
        const exportData = JSON.stringify(doc, null, 2);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `archive_passport_${doc.regNumber}.json`;
        a.click();
    };

    // Контрактор (Employee) Actions
    if (user.role === 'employee') {
        if (doc.status === 'draft' || doc.status === 'rejected') { // Можна відправити на розгляд з чернетки або після відхилення
            actionContainer.appendChild(createBtn('Відправити на розгляд', 'bg-blue-600 text-white hover:bg-blue-700', () => 
                performActionWithConfirm('submit', 'Відправка', 'Відправити документ на розгляд керівнику?')
            ));
        }
        if (doc.status === 'draft') {
            actionContainer.appendChild(createBtn('🗑️ Видалити', 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 ml-auto', deleteDoc));
        }
        if (doc.status === 'draft' || doc.status === 'rejected') {
            const mlClass = doc.status === 'rejected' ? ' ml-auto' : ' ml-3';
            actionContainer.appendChild(createBtn('📎 Додати файл(и)', 'bg-green-600 text-white hover:bg-green-700' + mlClass, () => document.getElementById('hiddenFileInput').click()));
        }
    }

    // Manager Actions
    if (user.role === 'manager') {
        if (doc.status === 'under_review') { // Менеджер розглядає документ
            actionContainer.appendChild(createBtn('✅ Погодити (В роботу)', 'bg-green-600 text-white hover:bg-green-700', () => 
                performActionWithConfirm('approve', 'Погодження', 'Ви підтверджуєте погодження цього документа та переведення його в статус "В роботі"?')
            ));
            
            actionContainer.appendChild(createBtn('❌ Відхилити', 'bg-red-600 text-white hover:bg-red-700', () => {
                window.API.showModal({
                    title: 'Відхилення документа',
                    message: 'Вкажіть причину відхилення:',
                    type: 'prompt',
                    onConfirm: (comment) => performAction('reject', { comment })
                });
            }));
        }
        if (doc.status === 'completed') { // Менеджер може архівувати виконаний документ
            actionContainer.appendChild(createBtn('В архів', 'bg-gray-600 text-white hover:bg-gray-700', () => 
                performActionWithConfirm('archive', 'Архівування', 'Перемістити документ до архіву?')
            ));
        }
    }

    // Signatory Actions
    if (user.role === 'signatory' && doc.signatory && doc.signatory._id === user.id) { // Тільки якщо він є підписантом цього документа
        if (doc.status === 'in_progress') { // Підписант підписує документ, який "в роботі"
            actionContainer.appendChild(createBtn('✍️ Підписати (КЕП)', 'bg-indigo-600 text-white hover:bg-indigo-700', () => 
                performActionWithConfirm('sign', 'Підписання', 'Накласти електронний підпис на цей документ?')
            ));
        }
    }

    // Export Archive Action (All except Admin)
    if (doc.status === 'archived' && user.role !== 'admin') {
        actionContainer.appendChild(createBtn('📥 Експорт паспорта (JSON)', 'bg-gray-800 text-white hover:bg-gray-900', exportArchive));
    }

    if (!hasActions) {
        actionContainer.innerHTML = '<span class="text-sm text-gray-500 italic">Немає доступних дій</span>';
    }
}

async function loadAuditTrail() {
    try {
        const logs = await window.API.fetchAPI(`/documents/${currentDocId}/audit`);
        const ul = document.getElementById('auditTrailList');
        ul.innerHTML = '';

        if (logs.length === 0) {
            ul.innerHTML = '<li class="text-sm text-gray-500 text-center">Історія порожня</li>';
            return;
        }

        logs.forEach((log, index) => {
            const isLast = index === logs.length - 1;
            
            // Icon based on action
            let iconHtml = '📝';
            if (log.action === 'create') iconHtml = '✨';
            if (log.action === 'status_change') iconHtml = '🔄';
            if (log.action === 'file_upload') iconHtml = '📎';
            
            let detailsText = '';
            if (log.action === 'create') detailsText = 'Документ створено (Чернетка)';
            else if (log.action === 'status_change') detailsText = `Статус змінено: <span class="font-medium uppercase">${log.fromStatus}</span> ➔ <span class="font-medium uppercase">${log.toStatus}</span>`;
            else if (log.action === 'file_upload') detailsText = 'Завантажено файли до документа';
            else if (log.action === 'delete') detailsText = 'Документ видалено';
            
            if (log.comment) detailsText += ` <div class="mt-1 text-sm bg-gray-50 p-2 rounded border border-gray-200"><span class="font-medium text-gray-700">Коментар:</span> ${log.comment}</div>`;

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="relative pb-8">
                    ${!isLast ? '<span class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>' : ''}
                    <div class="relative flex space-x-3">
                        <div>
                            <span class="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white text-lg">
                                ${iconHtml}
                            </span>
                        </div>
                        <div class="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                                <p class="text-sm text-gray-700">${detailsText}</p>
                                <p class="text-xs text-gray-400 mt-1">Користувач: <span class="font-medium text-gray-900">${log.user ? log.user.fullName : 'Система'}</span> (${log.user ? log.user.role : 'sys'})</p>
                            </div>
                            <div class="text-right text-xs whitespace-nowrap text-gray-500">
                                <time datetime="${log.createdAt}">${new Date(log.createdAt).toLocaleString('uk-UA')}</time>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            ul.appendChild(li);
        });

    } catch (error) {
        console.error('Audit Load Error:', error);
    }
}

window.deleteFile = (fileId) => {
    window.API.showModal({
        title: 'Видалення файлу',
        message: 'Ви впевнені, що хочете видалити цей прикріплений файл?',
        type: 'confirm',
        onConfirm: async () => {
            try {
                await window.API.fetchAPI(`/documents/${currentDocId}/files/${fileId}`, 'DELETE');
                await loadDocumentDetails();
                await loadAuditTrail();
            } catch (error) {
                window.API.showModal({ title: 'Помилка видалення', message: error.message });
            }
        }
    });
};

// Modal Logic
async function openDelegateModal() {
    document.getElementById('delegateModal').classList.remove('hidden');
    const select = document.getElementById('executorSelect');
    
    // Fetch users (employees)
    try {
        const users = await window.API.fetchAPI('/users?role=employee');
        select.innerHTML = '<option value="">Оберіть зі списку...</option>';
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u._id;
            opt.textContent = `${u.fullName} (${u.department || 'Без відділу'})`;
            select.appendChild(opt);
        });
    } catch (error) {
        select.innerHTML = '<option value="">Помилка завантаження</option>';
    }
}

function closeDelegateModal() {
    document.getElementById('delegateModal').classList.add('hidden');
}
