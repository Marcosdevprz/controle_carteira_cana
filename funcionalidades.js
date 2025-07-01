// =================================================================================
// MÓDULO DE SERVIÇO DO BANCO DE DADOS (IndexedDB)
// Encapsula todas as interações com o IndexedDB.
// =================================================================================
const dbService = {
    db: null,
    DB_NAME: 'ControleDeTarefasLaranjeirasDB',
    DB_VERSION: 1,
    STORE_NAME: 'tasks',

    /**
     * Inicia e configura o banco de dados IndexedDB.
     * @returns {Promise<IDBDatabase>}
     */
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const dbInstance = event.target.result;
                if (!dbInstance.objectStoreNames.contains(this.STORE_NAME)) {
                    dbInstance.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Banco de dados IndexedDB aberto com sucesso.');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('Erro ao abrir o IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    /**
     * Busca todas as tarefas do banco de dados.
     * @returns {Promise<Array>}
     */
    getAllTasks() {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("O banco de dados não está inicializado.");
            const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Salva ou atualiza uma tarefa no banco de dados.
     * @param {object} task - O objeto da tarefa a ser salvo.
     * @returns {Promise<void>}
     */
    saveTask(task) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.put(task);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Deleta uma tarefa do banco de dados pelo seu ID.
     * @param {string} taskId - O ID da tarefa a ser deletada.
     * @returns {Promise<void>}
     */
    deleteTask(taskId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(taskId);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
};

// =================================================================================
// MÓDULO DE SERVIÇO DA INTERFACE DO USUÁRIO (UI)
// Encapsula todas as manipulações diretas do DOM.
// =================================================================================
const uiService = {
    priorityOrder: { 'alta': 3, 'media': 2, 'baixa': 1 },

    /**
     * Renderiza todas as tarefas no quadro Kanban.
     * @param {Array<object>} tasksToRender - A lista de tarefas a serem exibidas.
     */
    renderTasks(tasksToRender) {
        const columns = {
            todo: document.querySelector('#todo .tasks-container'),
            inprogress: document.querySelector('#inprogress .tasks-container'),
            done: document.querySelector('#done .tasks-container')
        };

        Object.values(columns).forEach(col => col.innerHTML = '');

        const tasksByStatus = { todo: [], inprogress: [], done: [] };
        tasksToRender.forEach(task => {
            if (tasksByStatus[task.status]) {
                tasksByStatus[task.status].push(task);
            }
        });

        for (const status in tasksByStatus) {
            const columnTasks = tasksByStatus[status];
            const columnEl = columns[status];
            
            document.querySelector(`#${status} .task-count`).textContent = columnTasks.length;

            if (columnTasks.length === 0) {
                columnEl.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open fa-2x mb-2"></i><p>Nenhuma tarefa aqui</p></div>`;
            } else {
                columnTasks.sort((a, b) => (this.priorityOrder[b.priority] || 0) - (this.priorityOrder[a.priority] || 0));
                columnTasks.forEach(task => {
                    const taskCard = this.createTaskCard(task);
                    columnEl.appendChild(taskCard);
                });
            }
        }
        
        app.addDragAndDropListeners();
    },

    /**
     * Cria o elemento HTML para um único cartão de tarefa.
     * @param {object} task - O objeto da tarefa.
     * @returns {HTMLElement}
     */
    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;
        card.setAttribute('draggable', 'true');
        card.dataset.id = task.id;

        const dueDateText = task.dueDate ? `<p class="text-xs text-gray-400 mt-2"><i class="fas fa-calendar-alt mr-1"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString()}</p>` : '';

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <h3 class="font-bold text-md text-gray-100">${task.title}</h3>
                <div class="flex gap-2">
                     <button class="edit-btn text-gray-400 hover:text-blue-400"><i class="fas fa-edit"></i></button>
                     <button class="delete-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <p class="text-sm text-gray-300 my-2">${task.description || ''}</p>
            ${dueDateText}
        `;
        
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            app.handleDeleteTask(task.id);
        });

        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            app.handleEditTask(task);
        });

        return card;
    },

    /**
     * Exibe um modal de confirmação para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @returns {Promise<boolean>}
     */
    showConfirm(message) {
        return new Promise(resolve => {
            const confirmBackdrop = document.createElement('div');
            confirmBackdrop.className = 'modal-backdrop';
            confirmBackdrop.innerHTML = `
                <div class="modal-content text-center">
                    <p class="text-lg mb-6">${message}</p>
                    <div class="flex justify-center gap-4">
                        <button id="confirm-no" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg">Não</button>
                        <button id="confirm-yes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Sim</button>
                    </div>
                </div>`;
            document.body.appendChild(confirmBackdrop);
            confirmBackdrop.querySelector('#confirm-yes').onclick = () => { document.body.removeChild(confirmBackdrop); resolve(true); };
            confirmBackdrop.querySelector('#confirm-no').onclick = () => { document.body.removeChild(confirmBackdrop); resolve(false); };
        });
    },

    /**
     * Exibe uma notificação (toast) na tela.
     * @param {string} message - A mensagem da notificação.
     * @param {string} type - 'success' ou 'error'.
     */
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
        notification.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-20 ${bgColor}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.remove('translate-y-20'), 10);
        
        setTimeout(() => {
            notification.classList.add('translate-y-20');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
};

// =================================================================================
// LÓGICA PRINCIPAL E CONTROLADOR DA APLICAÇÃO
// =================================================================================
const app = {
    currentUserId: null,
    
    // Elementos do DOM
    addTaskBtn: document.getElementById('addTaskBtn'),
    taskModal: document.getElementById('taskModal'),
    cancelBtn: document.getElementById('cancelBtn'),
    taskForm: document.getElementById('taskForm'),
    submitBtn: document.querySelector('#taskForm button[type="submit"]'),

    // Variáveis para o drag and drop por toque
    isDraggingTouch: false,
    draggedElement: null,
    ghostElement: null,
    touchStartX: 0,
    touchStartY: 0,

    async initialize() {
        this.currentUserId = `local_user_${Math.random().toString(36).substr(2, 9)}`;
        document.getElementById('userIdDisplay').textContent = `ID Local: ${this.currentUserId}`;
        
        this.setupEventListeners();

        document.querySelectorAll('.tasks-container').forEach(c => {
            c.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p class="mt-2">Abrindo banco de dados...</p></div>`;
        });

        try {
            await dbService.init();
            this.refreshUI();
        } catch (error) {
            document.querySelectorAll('.tasks-container').forEach(c => {
                c.innerHTML = `<div class="empty-state"><p>Não foi possível iniciar o banco de dados local.</p></div>`;
            });
            uiService.showNotification("Falha ao iniciar o banco de dados.", "error");
        }
    },

    setupEventListeners() {
        this.addTaskBtn.addEventListener('click', () => this.handleNewTask());
        this.cancelBtn.addEventListener('click', () => this.taskModal.classList.add('hidden'));
        window.addEventListener('click', (e) => {
            if (e.target === this.taskModal) this.taskModal.classList.add('hidden');
        });
        this.taskForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    },

    async refreshUI() {
        try {
            const tasks = await dbService.getAllTasks();
            uiService.renderTasks(tasks);
        } catch (error) {
            console.error("Erro ao buscar e renderizar tarefas:", error);
            uiService.showNotification("Não foi possível carregar as tarefas.", "error");
        }
    },

    handleNewTask() {
        this.taskForm.reset();
        document.getElementById('taskId').value = '';
        document.getElementById('modalTitle').textContent = 'Nova Tarefa';
        this.taskModal.classList.remove('hidden');
    },
    
    handleEditTask(task) {
        document.getElementById('modalTitle').textContent = 'Editar Tarefa';
        document.getElementById('taskId').value = task.id;
        this.taskForm.title.value = task.title;
        this.taskForm.description.value = task.description;
        this.taskForm.dueDate.value = task.dueDate;
        this.taskForm.priority.value = task.priority;
        this.taskModal.classList.remove('hidden');
    },

    async handleDeleteTask(taskId) {
        if (await uiService.showConfirm("Tem certeza que deseja excluir esta tarefa?")) {
            try {
                await dbService.deleteTask(taskId);
                this.refreshUI();
                uiService.showNotification("Tarefa excluída com sucesso!", "success");
            } catch (error) {
                console.error("Erro ao excluir tarefa:", error);
                uiService.showNotification("Falha ao excluir a tarefa.", "error");
            }
        }
    },

    async handleFormSubmit(event) {
        event.preventDefault();
        
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...`;
        
        const taskId = document.getElementById('taskId').value;
        let taskData;

        try {
            if (taskId) {
                const tasks = await dbService.getAllTasks();
                const existingTask = tasks.find(t => t.id === taskId);
                taskData = {
                    ...existingTask,
                    title: this.taskForm.title.value,
                    description: this.taskForm.description.value,
                    dueDate: this.taskForm.dueDate.value,
                    priority: this.taskForm.priority.value,
                };
            } else {
                taskData = {
                    id: crypto.randomUUID(),
                    title: this.taskForm.title.value,
                    description: this.taskForm.description.value,
                    dueDate: this.taskForm.dueDate.value,
                    priority: this.taskForm.priority.value,
                    ownerId: this.currentUserId,
                    status: 'todo',
                    createdAt: new Date().toISOString()
                };
            }
            
            await dbService.saveTask(taskData);
            this.refreshUI();
            this.taskModal.classList.add('hidden');
            uiService.showNotification("Tarefa salva com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            uiService.showNotification("Falha ao salvar a tarefa.", "error");
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = `Salvar Tarefa`;
        }
    },

    addDragAndDropListeners() {
        const taskCards = document.querySelectorAll('.task-card');
        const columns = document.querySelectorAll('.kanban-column');

        // Eventos para Desktop (Mouse)
        taskCards.forEach(card => {
            card.addEventListener('dragstart', () => card.classList.add('dragging'));
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
        });

        columns.forEach(column => {
            column.addEventListener('dragover', e => e.preventDefault());
            column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
            column.addEventListener('drop', (e) => this.handleDrop(e, column));
        });

        // Eventos para Mobile (Toque)
        taskCards.forEach(card => {
            card.addEventListener('touchstart', (e) => this.handleTouchStart(e, card), { passive: false });
        });
        // Listeners de movimento e fim são adicionados ao documento inteiro para capturar o movimento em qualquer lugar
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    },

    async handleDrop(event, column) {
        event.preventDefault();
        column.classList.remove('drag-over');
        const draggingCard = document.querySelector('.dragging');
        if (draggingCard && draggingCard.parentElement.parentElement !== column) {
            await this.updateTaskStatus(draggingCard.dataset.id, column.dataset.status);
        }
    },

    handleTouchStart(event, card) {
        if (event.touches.length !== 1) return;
        this.isDraggingTouch = true;
        this.draggedElement = card;
        
        const rect = card.getBoundingClientRect();
        this.touchStartX = event.touches[0].clientX - rect.left;
        this.touchStartY = event.touches[0].clientY - rect.top;

        this.ghostElement = card.cloneNode(true);
        this.ghostElement.style.position = 'absolute';
        this.ghostElement.style.width = `${rect.width}px`;
        this.ghostElement.style.height = `${rect.height}px`;
        this.ghostElement.style.pointerEvents = 'none';
        this.ghostElement.style.opacity = '0.8';
        this.ghostElement.style.zIndex = '1000';
        document.body.appendChild(this.ghostElement);
        
        card.classList.add('dragging');
        this.handleTouchMove(event); // Posiciona o fantasma inicial
    },

    handleTouchMove(event) {
        if (!this.isDraggingTouch) return;
        event.preventDefault(); // Previne o scroll da página enquanto arrasta

        const touch = event.touches[0];
        this.ghostElement.style.left = `${touch.clientX - this.touchStartX}px`;
        this.ghostElement.style.top = `${touch.clientY - this.touchStartY}px`;

        // Lógica para destacar a coluna sob o dedo
        this.ghostElement.style.display = 'none'; // Esconde temporariamente para ver o que está por baixo
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        this.ghostElement.style.display = '';

        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
        if (elementBelow) {
            const columnBelow = elementBelow.closest('.kanban-column');
            if (columnBelow) {
                columnBelow.classList.add('drag-over');
            }
        }
    },

    async handleTouchEnd(event) {
        if (!this.isDraggingTouch) return;
        
        this.ghostElement.style.display = 'none';
        const touch = event.changedTouches[0];
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const columnBelow = elementBelow ? elementBelow.closest('.kanban-column') : null;

        if (columnBelow && this.draggedElement.parentElement.parentElement !== columnBelow) {
            await this.updateTaskStatus(this.draggedElement.dataset.id, columnBelow.dataset.status);
        }

        // Limpeza
        this.draggedElement.classList.remove('dragging');
        document.body.removeChild(this.ghostElement);
        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
        this.isDraggingTouch = false;
        this.draggedElement = null;
        this.ghostElement = null;
    },

    async updateTaskStatus(taskId, newStatus) {
        try {
            const tasks = await dbService.getAllTasks();
            const taskToUpdate = tasks.find(t => t.id === taskId);
            if (taskToUpdate && taskToUpdate.status !== newStatus) {
                taskToUpdate.status = newStatus;
                await dbService.saveTask(taskToUpdate);
                this.refreshUI();
            }
        } catch (error) {
            console.error("Erro ao mover tarefa:", error);
            uiService.showNotification("Falha ao mover a tarefa.", "error");
            this.refreshUI(); // Reverte para o estado anterior em caso de erro
        }
    }
};

// Inicia a aplicação quando o script é carregado
app.initialize();
