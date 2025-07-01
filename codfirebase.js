// =================================================================================
// IMPORTAÇÕES E CONFIGURAÇÃO DO FIREBASE
// =================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =================================================================================
// PASSO DE CONFIGURAÇÃO OBRIGATÓRIO
// Substitua o objeto abaixo pela configuração do seu projeto no Firebase.
// Pode encontrar esta configuração nas definições do seu projeto Firebase.
// =================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDuCRjLF1aNgfh0bPKiknm1HWUQ1dA6dmI",
  authDomain: "carteiracana.firebaseapp.com",
  projectId: "carteiracana",
  storageBucket: "carteiracana.firebasestorage.app",
  messagingSenderId: "950424552534",
  appId: "1:950424552534:web:b96c8a85ba02e4868127f7"
};
// =================================================================================
// FIM DO PASSO DE CONFIGURAÇÃO
// =================================================================================

// =================================================================================
// MÓDULO DE SERVIÇO DO BANCO DE DADOS (Firebase)
// =================================================================================
const dbService = {
    db: null,
    auth: null,
    tasksCollectionRef: null,
    appId: 'controle-de-tarefas-laranjeiras-v1', // ID único para a coleção de dados

    /**
     * Inicia o Firebase, a autenticação e o listener de dados em tempo real.
     * @returns {Promise<void>}
     */
    init() {
        return new Promise((resolve, reject) => {
            try {
                const app = initializeApp(firebaseConfig);
                this.db = getFirestore(app);
                this.auth = getAuth(app);
                this.tasksCollectionRef = collection(this.db, "shared_tasks", this.appId, "tasks");

                onAuthStateChanged(this.auth, (user) => {
                    if (user) {
                        appController.setCurrentUser(user);
                        this.listenForTasks(); // Começa a ouvir por tarefas após o login
                        resolve();
                    } else {
                        signInAnonymously(this.auth); // Se não houver utilizador, faz login anónimo
                    }
                });
            } catch (error) {
                console.error("Erro ao inicializar o Firebase:", error);
                reject(error);
            }
        });
    },

    /**
     * Configura um listener em tempo real para a coleção de tarefas.
     */
    listenForTasks() {
        onSnapshot(this.tasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            uiService.renderTasks(tasks);
        }, (error) => {
            console.error("Erro ao ouvir por atualizações de tarefas:", error);
            uiService.showNotification("Erro de conexão com o banco de dados.", "error");
        });
    },

    /**
     * Salva uma nova tarefa no banco de dados.
     * @param {object} taskData - Os dados da tarefa (sem o ID).
     * @returns {Promise<void>}
     */
    async addTask(taskData) {
        return addDoc(this.tasksCollectionRef, taskData);
    },

    /**
     * Atualiza uma tarefa existente no banco de dados.
     * @param {string} taskId - O ID da tarefa.
     * @param {object} taskData - Os campos a serem atualizados.
     * @returns {Promise<void>}
     */
    async updateTask(taskId, taskData) {
        const taskRef = doc(this.db, this.tasksCollectionRef.path, taskId);
        return updateDoc(taskRef, taskData);
    },

    /**
     * Deleta uma tarefa do banco de dados.
     * @param {string} taskId - O ID da tarefa.
     * @returns {Promise<void>}
     */
    async deleteTask(taskId) {
        const taskRef = doc(this.db, this.tasksCollectionRef.path, taskId);
        return deleteDoc(taskRef);
    }
};

// =================================================================================
// MÓDULO DE SERVIÇO DA INTERFACE DO USUÁRIO (UI) - Sem alterações
// =================================================================================
const uiService = {
    priorityOrder: { 'alta': 3, 'media': 2, 'baixa': 1 },

    renderTasks(tasksToRender) {
        const columns = {
            todo: document.querySelector('#todo .tasks-container'),
            inprogress: document.querySelector('#inprogress .tasks-container'),
            done: document.querySelector('#done .tasks-container')
        };
        Object.values(columns).forEach(col => col.innerHTML = '');
        const tasksByStatus = { todo: [], inprogress: [], done: [] };
        tasksToRender.forEach(task => {
            if (tasksByStatus[task.status]) tasksByStatus[task.status].push(task);
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
        appController.addDragAndDropListeners();
    },

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
            ${dueDateText}`;
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            appController.handleDeleteTask(task.id);
        });
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            appController.handleEditTask(task);
        });
        return card;
    },

    showConfirm(message) {
        return new Promise(resolve => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.innerHTML = `
                <div class="modal-content text-center">
                    <p class="text-lg mb-6">${message}</p>
                    <div class="flex justify-center gap-4">
                        <button id="confirm-no" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg">Não</button>
                        <button id="confirm-yes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Sim</button>
                    </div>
                </div>`;
            document.body.appendChild(backdrop);
            backdrop.querySelector('#confirm-yes').onclick = () => { document.body.removeChild(backdrop); resolve(true); };
            backdrop.querySelector('#confirm-no').onclick = () => { document.body.removeChild(backdrop); resolve(false); };
        });
    },

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
// CONTROLADOR DA APLICAÇÃO
// =================================================================================
const appController = {
    currentUser: null,
    addTaskBtn: document.getElementById('addTaskBtn'),
    taskModal: document.getElementById('taskModal'),
    cancelBtn: document.getElementById('cancelBtn'),
    taskForm: document.getElementById('taskForm'),
    submitBtn: document.querySelector('#taskForm button[type="submit"]'),
    isDraggingTouch: false,
    draggedElement: null,
    ghostElement: null,
    touchStartX: 0,
    touchStartY: 0,

    async initialize() {
        this.setupEventListeners();
        document.querySelectorAll('.tasks-container').forEach(c => {
            c.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p class="mt-2">A ligar ao servidor...</p></div>`;
        });
        try {
            await dbService.init();
        } catch (error) {
            uiService.showNotification("Falha ao ligar ao servidor.", "error");
        }
    },

    setCurrentUser(user) {
        this.currentUser = user;
        document.getElementById('userIdDisplay').textContent = `ID Partilhado (Online)`;
    },

    setupEventListeners() {
        this.addTaskBtn.addEventListener('click', () => this.handleNewTask());
        this.cancelBtn.addEventListener('click', () => this.taskModal.classList.add('hidden'));
        window.addEventListener('click', (e) => {
            if (e.target === this.taskModal) this.taskModal.classList.add('hidden');
        });
        this.taskForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
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
                uiService.showNotification("Tarefa excluída com sucesso!", "success");
            } catch (error) {
                uiService.showNotification("Falha ao excluir a tarefa.", "error");
            }
        }
    },

    async handleFormSubmit(event) {
        event.preventDefault();
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...`;
        const taskId = document.getElementById('taskId').value;
        const formData = {
            title: this.taskForm.title.value,
            description: this.taskForm.description.value,
            dueDate: this.taskForm.dueDate.value,
            priority: this.taskForm.priority.value,
        };
        try {
            if (taskId) {
                await dbService.updateTask(taskId, formData);
            } else {
                const newTaskData = {
                    ...formData,
                    ownerId: this.currentUser.uid,
                    status: 'todo',
                    createdAt: new Date().toISOString()
                };
                await dbService.addTask(newTaskData);
            }
            this.taskModal.classList.add('hidden');
            uiService.showNotification("Tarefa salva com sucesso!", "success");
        } catch (error) {
            uiService.showNotification("Falha ao salvar a tarefa.", "error");
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = `Salvar Tarefa`;
        }
    },
    
    // As funções de arrastar e soltar (desktop e mobile) continuam as mesmas
    addDragAndDropListeners() {
        const taskCards = document.querySelectorAll('.task-card');
        const columns = document.querySelectorAll('.kanban-column');
        taskCards.forEach(card => {
            card.addEventListener('dragstart', () => card.classList.add('dragging'));
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
            card.addEventListener('touchstart', (e) => this.handleTouchStart(e, card), { passive: false });
        });
        columns.forEach(column => {
            column.addEventListener('dragover', e => e.preventDefault());
            column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
            column.addEventListener('drop', (e) => this.handleDrop(e, column));
        });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    },

    async handleDrop(event, column) {
        event.preventDefault();
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
        this.handleTouchMove(event);
    },

    handleTouchMove(event) {
        if (!this.isDraggingTouch) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.ghostElement.style.left = `${touch.clientX - this.touchStartX}px`;
        this.ghostElement.style.top = `${touch.clientY - this.touchStartY}px`;
        this.ghostElement.style.display = 'none';
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        this.ghostElement.style.display = '';
        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
        if (elementBelow) {
            const columnBelow = elementBelow.closest('.kanban-column');
            if (columnBelow) columnBelow.classList.add('drag-over');
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
        this.draggedElement.classList.remove('dragging');
        document.body.removeChild(this.ghostElement);
        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
        this.isDraggingTouch = false;
    },

    async updateTaskStatus(taskId, newStatus) {
        try {
            await dbService.updateTask(taskId, { status: newStatus });
        } catch (error) {
            uiService.showNotification("Falha ao mover a tarefa.", "error");
            // O onSnapshot do Firebase irá reverter a UI automaticamente em caso de erro no backend.
        }
    }
};

// Inicia a aplicação
appController.initialize();
