let currentDocId = null;

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
        window.API.showModal({
            title: 'Доступ заборонено',
            message: 'Адміністратори не мають доступу до перегляду документів.',
            type: 'alert',
            onConfirm: () => window.location.href = '/pages/dashboard.html'
        });
        return;
    }

    const rawUrl = window.location.href;
    const idMatch = rawUrl.match(/[?&]id=([^&#/]+)/);
    currentDocId = idMatch ? idMatch[1] : localStorage.getItem('currentDocId');

    if (currentDocId) {
        localStorage.setItem('currentDocId', currentDocId);
    }

    if (!currentDocId || currentDocId === 'undefined' || currentDocId === 'null') {
        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('errorIndicator').innerHTML = `Помилка: Неможливо зчитати ID документа. <br> <span class="text-xs text-gray-500">Поточний URL: ${window.API.escapeHtml(rawUrl)}</span><br>Будь ласка, оберіть документ з <a href="/pages/registry.html" class="text-blue-600 underline hover:text-blue-800">Реєстру</a>.`;
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

        document.getElementById('headerDocTitle').textContent = doc.title || 'Документ';
        document.getElementById('docRegNumber').textContent = `ID: ${doc.regNumber || doc._id.substring(0, 6).toUpperCase()}`;
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

        // Confidentiality badge
        const confEl = document.getElementById('docConfidentiality');
        if (confEl) {
            const confLabels = { 'public': 'Публічний', 'internal': 'Внутрішній', 'confidential': 'Конфіденційний', 'secret': 'Секретний' };
            const confColors = { 'public': 'text-green-700 bg-green-50', 'internal': 'text-blue-700 bg-blue-50', 'confidential': 'text-orange-700 bg-orange-50', 'secret': 'text-red-700 bg-red-50' };
            confEl.textContent = confLabels[doc.confidentiality] || doc.confidentiality || 'Внутрішній';
            confEl.className = `px-2 py-0.5 text-xs font-medium rounded ${confColors[doc.confidentiality] || 'text-gray-700 bg-gray-50'}`;
        }

        // Tags
        const tagsEl = document.getElementById('docTags');
        if (tagsEl) {
            if (doc.tags && doc.tags.length > 0) {
                const esc = window.API.escapeHtml;
                tagsEl.innerHTML = doc.tags.map(t => `<span class="inline-block px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-full mr-1 mb-1">${esc(t)}</span>`).join('');
            } else {
                tagsEl.textContent = '—';
            }
        }

        // Related documents
        const relatedEl = document.getElementById('relatedDocsList');
        if (relatedEl) {
            if (doc.relatedDocuments && doc.relatedDocuments.length > 0) {
                const esc = window.API.escapeHtml;
                relatedEl.innerHTML = doc.relatedDocuments.map(r => `
                    <div class="flex items-center justify-between py-1">
                        <a href="/pages/document.html?id=${r._id}" class="text-sm text-indigo-600 hover:underline">${esc(r.regNumber)} — ${esc(r.title)}</a>
                        ${user.role === 'employee' && ['draft', 'rejected'].includes(doc.status) ? `<button onclick="unlinkRelated('${r._id}')" class="text-xs text-red-500 hover:text-red-700 ml-2">✕</button>` : ''}
                    </div>
                `).join('');
            } else {
                relatedEl.innerHTML = '<span class="text-sm text-gray-400">Немає пов\'язаних документів</span>';
            }
        }

        // Files
        const viewerContainer = document.getElementById('fileViewerContainer');
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

        document.getElementById('fileSection').classList.remove('hidden');

        const legacyLink = document.getElementById('docFileLink');
        if (legacyLink && legacyLink.parentElement) {
            legacyLink.parentElement.style.display = 'none';
        }

        let currentSettings = { maxUploadFiles: 10 };
        try {
            currentSettings = await window.API.fetchAPI('/settings');
        } catch (e) {
            console.warn('Could not load settings, using defaults');
        }

        let filesHtml = '';
        const canUpload = (doc.status === 'draft' || doc.status === 'rejected') && user.role === 'employee';

        if (doc.files && doc.files.length > 0) {
            filesHtml += `<div class="flex flex-col w-full">`;

            doc.files.forEach(f => {
                const baseUrl = window.API.API_BASE_URL.replace('/api', '');
                const fileUrl = baseUrl + f.path;
                const ext = f.path.split('.').pop().toLowerCase();
                const esc = window.API.escapeHtml;

                filesHtml += `<div class="w-full flex flex-col mb-10 pb-10 border-b-2 border-gray-300 last:border-b-0 last:pb-0 last:mb-0">`;

                // File name, size, version
                const versionBadge = f.version > 1 ? `<span class="ml-2 px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">v${f.version}</span>` : '';
                const uploadedByName = f.uploadedBy ? esc(f.uploadedBy.fullName || '') : '';

                filesHtml += `
                    <div class="mb-4">
                        <h4 class="text-xl font-bold text-gray-900">${esc(f.originalName)}${versionBadge}</h4>
                        <p class="text-sm text-gray-600 mt-1">Розмір: ${(f.size / 1024).toFixed(1)} KB | Формат: ${ext.toUpperCase()}${uploadedByName ? ` | Завантажив: ${uploadedByName}` : ''}</p>
                    </div>`;

                filesHtml += `
                    <div class="flex flex-row flex-wrap items-center gap-3 mb-6">
                        <a href="${fileUrl}" target="_blank" class="px-6 py-2.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap">
                            <svg class="h-5 w-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            Відкрити
                        </a>
                        <a href="${fileUrl}" download="${esc(f.originalName)}" class="px-6 py-2.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap">
                            <svg class="h-5 w-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Завантажити
                        </a>
                        ${canUpload ? `
                        <button onclick="replaceFile('${f._id || f.id}')" class="px-6 py-2.5 text-sm font-medium rounded-md bg-yellow-500 text-white hover:bg-yellow-600 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap">
                            Замінити (нова версія)
                        </button>
                        <button onclick="deleteFile('${f._id || f.id}')" class="px-6 py-2.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 flex items-center transition-colors shadow-sm w-fit whitespace-nowrap ml-auto">
                            Видалити
                        </button>
                        ` : ''}
                    </div>`;

                // File preview
                filesHtml += `<div class="w-full bg-gray-50 border border-gray-200 rounded-lg flex justify-center p-0 overflow-hidden">`;
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    filesHtml += `<img src="${fileUrl}" class="max-w-full h-auto object-contain max-h-[800px]" alt="${esc(f.originalName)}">`;
                } else if (ext === 'pdf') {
                    filesHtml += `<iframe src="${fileUrl}#toolbar=1&navpanes=0&view=FitH" class="w-full h-[800px] border-0" allowfullscreen></iframe>`;
                } else {
                    filesHtml += `
                        <div class="py-12 text-center w-full">
                            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <p class="mt-2 text-sm text-gray-500">Попередній перегляд недоступний для цього формату.</p>
                        </div>`;
                }
                filesHtml += `</div>`;

                // Version history for this file
                if (doc.fileVersions && doc.fileVersions.length > 0) {
                    const fileHistory = doc.fileVersions.filter(v => v.fileId && v.fileId.toString() === (f._id || f.id));
                    if (fileHistory.length > 0) {
                        filesHtml += `<div class="mt-4 bg-gray-50 border rounded-lg p-3">
                            <p class="text-sm font-medium text-gray-700 mb-2">Попередні версії:</p>`;
                        fileHistory.sort((a, b) => b.version - a.version).forEach(v => {
                            const vUrl = baseUrl + v.path;
                            const vDate = new Date(v.replacedAt).toLocaleString('uk-UA');
                            filesHtml += `<div class="flex items-center justify-between py-1 text-sm text-gray-600">
                                <span>v${v.version} — ${esc(v.originalName)} (${vDate})</span>
                                <a href="${vUrl}" target="_blank" class="text-indigo-600 hover:underline">Завантажити</a>
                            </div>`;
                        });
                        filesHtml += `</div>`;
                    }
                }

                filesHtml += `</div>`;
            });
            filesHtml += `</div>`;
        } else {
            filesHtml += '<p class="text-gray-500 p-4 text-center border rounded-md bg-gray-50 mb-4">Файли відсутні.</p>';
        }

        if (canUpload) {
            filesHtml += `<input type="file" id="hiddenFileInput" multiple class="hidden" />`;
            filesHtml += `<input type="file" id="hiddenReplaceInput" class="hidden" />`;
        }

        viewerContainer.innerHTML = filesHtml;

        // File upload handler
        const hiddenInput = document.getElementById('hiddenFileInput');
        if (hiddenInput) {
            hiddenInput.addEventListener('change', async (e) => {
                if (e.target.files.length === 0) return;
                if (e.target.files.length + (doc.files ? doc.files.length : 0) > currentSettings.maxUploadFiles) {
                    window.API.showModal({ title: 'Помилка', message: `Ліміт: ${currentSettings.maxUploadFiles} файлів.` });
                    hiddenInput.value = '';
                    return;
                }
                document.getElementById('loadingIndicator').classList.remove('hidden');
                document.getElementById('docContent').classList.add('hidden');
                const formData = new FormData();
                for (let i = 0; i < e.target.files.length; i++) {
                    formData.append('files', e.target.files[i]);
                }
                try {
                    await window.API.fetchAPI(`/documents/${currentDocId}/files`, 'POST', formData);
                    await loadDocumentDetails();
                    await loadAuditTrail();
                } catch (error) {
                    window.API.showModal({ title: 'Помилка завантаження', message: error.message });
                    document.getElementById('loadingIndicator').classList.add('hidden');
                    document.getElementById('docContent').classList.remove('hidden');
                } finally {
                    e.target.value = '';
                }
            });
        }

        // Status Badge
        const statusBadge = document.getElementById('docStatusBadge');
        const statusLabels = {
            'draft': 'Чернетка',
            'on_approval': 'На погодженні',
            'on_signing': 'На підписанні',
            'signed': 'Підписано',
            'rejected': 'Відхилено',
            'archived': 'В архіві'
        };
        statusBadge.textContent = statusLabels[doc.status] || doc.status;

        let statusColor = 'bg-gray-100 text-gray-800';
        if (doc.status === 'on_approval') statusColor = 'bg-yellow-100 text-yellow-800';
        if (doc.status === 'on_signing') statusColor = 'bg-blue-100 text-blue-800';
        if (doc.status === 'signed') statusColor = 'bg-green-100 text-green-800';
        if (doc.status === 'rejected') statusColor = 'bg-red-100 text-red-800';
        if (doc.status === 'archived') statusColor = 'bg-gray-300 text-gray-800';
        statusBadge.className = `px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${statusColor}`;

        const approverEl = document.getElementById('docManager');
        if (approverEl) {
            approverEl.textContent = doc.approver ? doc.approver.fullName : '—';
            const labelEl = approverEl.previousElementSibling;
            if (labelEl && labelEl.tagName.toLowerCase() === 'dt') labelEl.textContent = 'Керівник';
        }

        const executorEl = document.getElementById('docExecutor');
        if (executorEl) {
            executorEl.textContent = doc.signatory ? doc.signatory.fullName : '—';
            const labelEl = executorEl.previousElementSibling;
            if (labelEl && labelEl.tagName.toLowerCase() === 'dt') labelEl.textContent = 'Підписант';
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
        URL.revokeObjectURL(url);
    };

    // Employee Actions
    if (user.role === 'employee') {
        if (doc.status === 'draft' || doc.status === 'rejected') {
            actionContainer.appendChild(createBtn('Відправити на розгляд', 'bg-blue-600 text-white hover:bg-blue-700', () =>
                performActionWithConfirm('submit', 'Відправка', 'Відправити документ на розгляд керівнику?')
            ));
        }
        if (doc.status === 'draft') {
            actionContainer.appendChild(createBtn('Видалити', 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 ml-auto', deleteDoc));
        }
        if (doc.status === 'draft' || doc.status === 'rejected') {
            const mlClass = doc.status === 'rejected' ? ' ml-auto' : ' ml-3';
            actionContainer.appendChild(createBtn('Додати файл(и)', 'bg-green-600 text-white hover:bg-green-700' + mlClass, () => document.getElementById('hiddenFileInput').click()));
            actionContainer.appendChild(createBtn('Редагувати', 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 ml-3', () => openEditDocModal(doc)));
            // Link related document
            actionContainer.appendChild(createBtn('Пов\'язати', 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 ml-3', () => openLinkRelatedModal()));
        }
    }

    // Approver Actions
    if (user.role === 'approver' && doc.department === user.department) {
        if (doc.status === 'on_approval') {
            actionContainer.appendChild(createBtn('Погодити', 'bg-green-600 text-white hover:bg-green-700', () =>
                performActionWithConfirm('approve', 'Погодження', 'Погодити документ та передати його на підписання?')
            ));
            actionContainer.appendChild(createBtn('Відхилити', 'bg-red-600 text-white hover:bg-red-700', () => {
                window.API.showModal({
                    title: 'Відхилення документа',
                    message: 'Вкажіть причину відхилення:',
                    type: 'prompt',
                    onConfirm: (comment) => performAction('reject', { comment })
                });
            }));
        }
        if (doc.status === 'signed') {
            actionContainer.appendChild(createBtn('В архів', 'bg-gray-600 text-white hover:bg-gray-700', () =>
                performActionWithConfirm('archive', 'Архівування', 'Перемістити документ до архіву?')
            ));
        }
    }

    // Signatory Actions
    if (user.role === 'signatory' && doc.department === user.department) {
        if (doc.status === 'on_signing') {
            actionContainer.appendChild(createBtn('Підписати (КЕП)', 'bg-indigo-600 text-white hover:bg-indigo-700', () =>
                performActionWithConfirm('sign', 'Підписання', 'Накласти електронний підпис на цей документ?')
            ));
            actionContainer.appendChild(createBtn('Відхилити', 'bg-red-600 text-white hover:bg-red-700 ml-3', () => {
                window.API.showModal({
                    title: 'Відхилення документа',
                    message: 'Вкажіть причину відмови від підпису:',
                    type: 'prompt',
                    onConfirm: (comment) => performAction('reject', { comment })
                });
            }));
        }
    }

    if (doc.status === 'archived' && user.role !== 'admin') {
        actionContainer.appendChild(createBtn('Експорт паспорта (JSON)', 'bg-gray-800 text-white hover:bg-gray-900', exportArchive));
    }

    // Comment button
    actionContainer.appendChild(createBtn('Коментар', 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 ml-3', () => {
        window.API.showModal({
            title: 'Додати коментар',
            message: 'Введіть ваш коментар до документа:',
            type: 'prompt',
            onConfirm: (comment) => performAction('comments', { comment })
        });
    }));

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

            let iconHtml = '📝';
            if (log.action === 'create') iconHtml = '✨';
            if (log.action === 'status_change') iconHtml = '🔄';
            if (log.action === 'file_upload') iconHtml = '📎';
            if (log.action === 'update') iconHtml = '✏️';
            if (log.action === 'comment') iconHtml = '💬';

            let detailsText = '';
            if (log.action === 'create') detailsText = 'Документ створено (Чернетка)';
            else if (log.action === 'status_change') detailsText = `Статус змінено: <span class="font-medium uppercase">${log.fromStatus}</span> ➔ <span class="font-medium uppercase">${log.toStatus}</span>`;
            else if (log.action === 'file_upload') detailsText = 'Завантажено файли до документа';
            else if (log.action === 'delete') detailsText = 'Документ видалено';
            else if (log.action === 'update') detailsText = 'Документ відредаговано';
            else if (log.action === 'comment') detailsText = 'Додано коментар';
            else if (log.action === 'file_delete') detailsText = 'Видалено файл';

            if (log.comment) {
                const escapedComment = log.comment.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                detailsText += ` <div class="mt-1 text-sm bg-gray-50 p-2 rounded border border-gray-200"><span class="font-medium text-gray-700">Коментар:</span> ${escapedComment}</div>`;
            }

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
                                <p class="text-xs text-gray-400 mt-1">Користувач: <span class="font-medium text-gray-900">${log.user ? window.API.escapeHtml(log.user.fullName) : 'Система'}</span> (${log.user ? log.user.role : 'sys'})</p>
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

// Feature 1: Replace file
window.replaceFile = (fileId) => {
    window._replaceFileId = fileId;
    const input = document.getElementById('hiddenReplaceInput');
    if (input) {
        input.onchange = async (e) => {
            if (e.target.files.length === 0) return;
            document.getElementById('loadingIndicator').classList.remove('hidden');
            document.getElementById('docContent').classList.add('hidden');
            const formData = new FormData();
            formData.append('files', e.target.files[0]);
            try {
                await window.API.fetchAPI(`/documents/${currentDocId}/files/${window._replaceFileId}`, 'PUT', formData);
                await loadDocumentDetails();
                await loadAuditTrail();
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
                document.getElementById('loadingIndicator').classList.add('hidden');
                document.getElementById('docContent').classList.remove('hidden');
            } finally {
                e.target.value = '';
            }
        };
        input.click();
    }
};

// Feature 6: Link related document
window.openLinkRelatedModal = () => {
    window.API.showModal({
        title: 'Пов\'язати документ',
        message: 'Введіть реєстраційний номер або ID пов\'язаного документа:',
        type: 'prompt',
        inputPlaceholder: 'Наприклад: FIN-123456',
        onConfirm: async (searchTerm) => {
            try {
                const docs = await window.API.fetchAPI(`/documents?search=${encodeURIComponent(searchTerm)}`);
                if (docs.length === 0) {
                    window.API.showModal({ title: 'Не знайдено', message: 'Документів з таким номером не знайдено.' });
                    return;
                }
                const relatedDoc = docs[0];
                if ((relatedDoc._id || relatedDoc.id) === currentDocId) {
                    window.API.showModal({ title: 'Помилка', message: 'Не можна пов\'язати документ з самим собою.' });
                    return;
                }
                await window.API.fetchAPI(`/documents/${currentDocId}/related`, 'POST', { relatedId: relatedDoc._id || relatedDoc.id });
                await loadDocumentDetails();
            } catch (error) {
                window.API.showModal({ title: 'Помилка', message: error.message });
            }
        }
    });
};

window.unlinkRelated = async (relatedId) => {
    try {
        await window.API.fetchAPI(`/documents/${currentDocId}/related/${relatedId}`, 'DELETE');
        await loadDocumentDetails();
    } catch (error) {
        window.API.showModal({ title: 'Помилка', message: error.message });
    }
};

// Edit document modal
window.openEditDocModal = (doc) => {
    const existing = document.getElementById('editDocModal');
    if (existing) existing.remove();

    const esc = window.API.escapeHtml;
    const modalHtml = `
    <div id="editDocModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-[100] flex items-center justify-center transition-opacity">
        <div class="relative p-6 w-full max-w-md shadow-xl rounded-xl bg-white">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Редагувати документ</h3>
            <form id="editDocForm">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Назва</label>
                    <input type="text" id="editDocTitle" required value="${esc(doc.title || '')}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Контрагент</label>
                    <input type="text" id="editDocCounterparty" value="${esc(doc.counterparty || '')}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Дедлайн</label>
                    <input type="date" id="editDocDueDate" value="${doc.dueDate ? doc.dueDate.split('T')[0] : ''}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Конфіденційність</label>
                    <select id="editDocConfidentiality" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500">
                        <option value="public" ${doc.confidentiality === 'public' ? 'selected' : ''}>Публічний</option>
                        <option value="internal" ${doc.confidentiality === 'internal' || !doc.confidentiality ? 'selected' : ''}>Внутрішній</option>
                        <option value="confidential" ${doc.confidentiality === 'confidential' ? 'selected' : ''}>Конфіденційний</option>
                        <option value="secret" ${doc.confidentiality === 'secret' ? 'selected' : ''}>Секретний</option>
                    </select>
                </div>
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Теги (через кому)</label>
                    <input type="text" id="editDocTags" value="${esc((doc.tags || []).join(', '))}" placeholder="договір, фінанси" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="document.getElementById('editDocModal').remove()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium">Скасувати</button>
                    <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">Зберегти</button>
                </div>
            </form>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('editDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('editDocTitle').value;
        const counterparty = document.getElementById('editDocCounterparty').value;
        const dueDate = document.getElementById('editDocDueDate').value;
        const confidentiality = document.getElementById('editDocConfidentiality').value;
        const tags = document.getElementById('editDocTags').value;

        try {
            await window.API.fetchAPI(`/documents/${currentDocId}`, 'PATCH', { title, counterparty, dueDate, confidentiality, tags });
            document.getElementById('editDocModal').remove();
            await loadDocumentDetails();
            await loadAuditTrail();
        } catch (error) {
            window.API.showModal({ title: 'Помилка', message: error.message });
        }
    });
};

// Delegate modal (legacy)
async function openDelegateModal() {
    document.getElementById('delegateModal').classList.remove('hidden');
    const select = document.getElementById('executorSelect');
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
