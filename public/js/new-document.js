document.addEventListener('DOMContentLoaded', async () => {
    window.API.checkAuth();
    
    const user = window.API.getUser();

    // ТІЛЬКИ Працівники (employee) можуть створювати документи
    if (user.role !== 'employee') {
        window.API.showModal({
            title: 'Відмова у доступі',
            message: 'Тільки ініціатори (Працівники) мають право створювати та реєструвати документи.',
            type: 'alert',
            onConfirm: () => window.location.href = '/pages/dashboard.html'
        });
        return;
    }

    // Setup UI with User Data
    document.getElementById('userName').textContent = user.fullName || 'User';
    
    const roleLabels = {
        'employee': 'Працівник',
        'manager': 'Менеджер'
    };
    document.getElementById('userRole').textContent = roleLabels[user.role] || user.role;
    
    // Form Submission
    const form = document.getElementById('newDocumentForm');
    
    // Динамічно переписуємо форму під нові поля (щоб не правити HTML)
    form.innerHTML = `
        <div id="formError" class="hidden mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm"></div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Назва документа</label>
            <input type="text" id="docTitle" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Напрямок</label>
            <select id="docDirection" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="incoming">Вхідний</option>
                <option value="outgoing">Вихідний</option>
                <option value="internal">Внутрішній</option>
            </select>
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Тип документа (динамічний довідник)</label>
            <select id="docType" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">Завантаження...</option>
            </select>
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Контрагент</label>
            <input type="text" id="docCounterparty" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700">Дедлайн (опційно)</label>
            <input type="date" id="docDueDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500">
        </div>
        <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700">Прикріпити файли</label>
            <input type="file" id="docFiles" multiple class="mt-1 block w-full text-gray-700">
            <p class="text-xs text-gray-500 mt-1">Щоб обрати декілька файлів одразу, утримуйте клавішу <strong>Ctrl</strong> (Windows) або <strong>Cmd</strong> (Mac) у вікні вибору.</p>
        </div>
        <div class="flex justify-end">
            <button type="submit" id="submitBtn" class="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition">Зберегти як Чернетку</button>
        </div>
    `;

    // Завантаження довідника типів документів
    const loadDocumentTypes = async () => {
        try {
            const types = await window.API.fetchAPI('/document-types');
            const select = document.getElementById('docType');
            select.innerHTML = '<option value="">Оберіть тип...</option>';
            types.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.code;
                opt.textContent = t.name;
                select.appendChild(opt);
            });
        } catch (error) {
            console.error('Помилка завантаження типів:', error);
            document.getElementById('docType').innerHTML = '<option value="">Помилка завантаження</option>';
        }
    };
    loadDocumentTypes();

    let currentSettings = { maxUploadFiles: 10 };
    try {
        currentSettings = await window.API.fetchAPI('/settings');
    } catch (error) {
        console.warn('Could not load settings, using defaults');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formError = document.getElementById('formError');
        formError.classList.add('hidden');
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Збереження...';

        const formData = new FormData();
        formData.append('title', document.getElementById('docTitle').value);
        formData.append('direction', document.getElementById('docDirection').value);
        formData.append('type', document.getElementById('docType').value);
        formData.append('counterparty', document.getElementById('docCounterparty').value);
        
        const dueDate = document.getElementById('docDueDate').value;
        if (dueDate) formData.append('dueDate', dueDate);
        
        const fileInput = document.getElementById('docFiles');

        if (fileInput.files.length > currentSettings.maxUploadFiles) {
            formError.textContent = `Максимальна кількість файлів для завантаження: ${currentSettings.maxUploadFiles}`;
            formError.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Зберегти як Чернетку';
            return;
        }

        if (fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append('files', fileInput.files[i]);
            }
        }

        try {
            await window.API.fetchAPI('/documents', 'POST', formData);
            window.API.showModal({
                title: 'Успіх',
                message: 'Документ успішно створено як Чернетку!',
                type: 'alert',
                onConfirm: () => window.location.href = '/pages/registry.html'
            });
        } catch (error) {
            formError.textContent = error.message;
            formError.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Зберегти як Чернетку';
        }
    });
});
