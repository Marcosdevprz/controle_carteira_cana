// =================================================================================
// IMPORTAÇÕES DO FIREBASE
// =================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =================================================================================
// CONFIGURAÇÃO DO FIREBASE
// !! IMPORTANTE !! Copie este objeto INTEIRO e FRESCO do seu painel do Firebase.
// Vá para: Definições do projeto > (Geral) > As suas apps > Configuração do SDK
// =================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDuCRjLF1aNgfh0bPKiknm1HWUQ1dA6dmI",
    authDomain: "carteiracana.firebaseapp.com",
    projectId: "carteiracana",
    storageBucket: "carteiracana.appspot.com", // Usar o valor .appspot.com é o padrão mais seguro.
    messagingSenderId: "950424552534",
    appId: "1:950424552534:web:b96c8a85ba02e4868127f7"
};

// =================================================================================
// MÓDULO PRINCIPAL DA APLICAÇÃO
// =================================================================================
const App = {
    // --- Propriedades ---
    db: null,
    auth: null,
    currentUser: null,
    tasksCollectionRef: null,
    draggedElement: null,
    ghostElement: null,
    isDraggingTouch: false,
    
    // --- Elementos do DOM ---
    elements: {},

    /**
     * Ponto de entrada da aplicação.
     */
    async init() {
        console.log("A inicializar a aplicação...");
        this.cacheDOMElements();
        this.setupEventListeners();
        
        try {
            this.initializeFirebase();
        } catch (error) {
            console.error("ERRO CRÍTICO NA INICIALIZAÇÃO:", error);
            UI.showNotification("Falha crítica ao iniciar. Verifique a consola.", "error");
        }
    },

    /**
     * Mapeia os elementos do HTML para a propriedade 'elements'.
     */
    cacheDOMElements() {
        this.elements.addTaskBtn = document.getElementById('addTaskBtn');
        this.elements.taskModal = document.getElementById('taskModal');
        this.elements.cancelBtn = document.getElementById('cancelBtn');
        this.elements.taskForm = document.getElementById('taskForm');
        this.elements.submitBtn = document.querySelector('#taskForm button[type="submit"]');
        this.elements.userIdDisplay = document.getElementById('userIdDisplay');
        this.elements.columns = {
            todo: document.querySelector('#todo .tasks-container'),
            inprogress: document.querySelector('#inprogress .tasks-container'),
            done: document.querySelector('#done .tasks-container')
        };
    },

    /**
     * Configura todos os listeners de eventos da aplicação.
     */
    setupEventListeners() {
        this.elements.addTaskBtn.addEventListener('click', () => UI.openTaskModal());
        this.elements.cancelBtn.addEventListener('click', () => UI.closeTaskModal());
        this.elements.taskModal.addEventListener('click', (e) => {
            if (e.target === this.elements.taskModal) UI.closeTaskModal();
        });
        this.elements.taskForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    },

    /**
     * Inicializa o Firebase e a autenticação.
     */
    initializeFirebase() {
        this.elements.userIdDisplay.textContent = 'A ligar ao servidor...';
        
        const app = initializeApp(firebaseConfig);
        this.auth = getAuth(app);
        this.db = getFirestore(app);
        const appId = 'controle-de-tarefas-laranjeiras-v1';
        this.tasksCollectionRef = collection(this.db, "shared_tasks", appId, "tasks");

        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                console.log("Autenticação bem-sucedida. UID:", user.uid);
                this.currentUser = user;
                this.elements.userIdDisplay.textContent = 'Conectado (Online)';
                this.listenForTasks();
            } else {
                console.log("Nenhum utilizador. A tentar login anónimo...");
                signInAnonymously(this.auth).catch(error => {
                    console.error("FALHA no login anónimo:", error);
                    UI.showNotification("Falha na autenticação.", "error");
                });
            }
        });
    },

    /**
     * Ouve por mudanças na coleção de tarefas em tempo real.
     */
    listenForTasks() {
        onSnapshot(this.tasksCollectionRef, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            UI.renderTasks(tasks);
        }, (error) => {
            console.error("Erro ao ouvir o Firestore:", error);
            UI.showNotification("Erro de conexão com o banco de dados.", "error");
        });
    },

    /**
     * Lida com o envio do formulário para criar ou editar uma tarefa.
     */
    async handleFormSubmit(event) {
        event.preventDefault();
        UI.setSubmitButtonLoading(true);

        const taskId = document.getElementById('taskId').value;
        const formData = {
            title: this.elements.taskForm.title.value.trim(),
            description: this.elements.taskForm.description.value.trim(),
            dueDate: this.elements.taskForm.dueDate.value,
            priority: this.elements.taskForm.priority.value,
        };

        try {
            if (taskId) {
                const taskRef = doc(this.db, this.tasksCollectionRef.path, taskId);
                await updateDoc(taskRef, formData);
            } else {
                const newTaskData = { ...formData, ownerId: this.currentUser.uid, status: 'todo', createdAt: new Date().toISOString() };
                await addDoc(this.tasksCollectionRef, newTaskData);
            }
            UI.closeTaskModal();
            UI.showNotification("Tarefa salva com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            UI.showNotification("Falha ao salvar a tarefa.", "error");
        } finally {
            UI.setSubmitButtonLoading(false);
        }
    },
    
    // ... (restante do código para UI e Drag and Drop, que não precisa de alterações)
};

// =================================================================================
// MÓDULO DA INTERFACE DO USUÁRIO (UI)
// =================================================================================
const UI = {
    priorityOrder: { 'alta': 3, 'media': 2, 'baixa': 1 },

    openTaskModal(task = null) {
        const form = App.elements.taskForm;
        form.reset();
        if (task) {
            document.getElementById('modalTitle').textContent = 'Editar Tarefa';
            document.getElementById('taskId').value = task.id;
            form.title.value = task.title;
            form.description.value = task.description;
            form.dueDate.value = task.dueDate;
            form.priority.value = task.priority;
        } else {
            document.getElementById('modalTitle').textContent = 'Nova Tarefa';
            document.getElementById('taskId').value = '';
        }
        App.elements.taskModal.classList.remove('hidden');
    },

    closeTaskModal() {
        App.elements.taskModal.classList.add('hidden');
    },

    setSubmitButtonLoading(isLoading) {
        const btn = App.elements.submitBtn;
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `Salvar Tarefa`;
        }
    },

    renderTasks(tasks) {
        const { columns } = App.elements;
        Object.values(columns).forEach(col => col.innerHTML = '');
        
        const tasksByStatus = { todo: [], inprogress: [], done: [] };
        tasks.forEach(task => {
            if (tasksByStatus[task.status]) tasksByStatus[task.status].push(task);
        });

        for (const status in tasksByStatus) {
            const columnTasks = tasksByStatus[status];
            document.querySelector(`#${status} .task-count`).textContent = columnTasks.length;
            
            if (columnTasks.length === 0) {
                columns[status].innerHTML = `<div class="empty-state"><i class="fas fa-folder-open fa-2x mb-2"></i><p>Nenhuma tarefa aqui</p></div>`;
            } else {
                columnTasks
                    .sort((a, b) => (this.priorityOrder[b.priority] || 0) - (this.priorityOrder[a.priority] || 0))
                    .forEach(task => columns[status].appendChild(this.createTaskCard(task)));
            }
        }
        this.addDragAndDropListeners();
    },

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;
        card.setAttribute('draggable', 'true');
        card.dataset.id = task.id;
        
        const dueDateText = task.dueDate ? `<p class="text-xs text-gray-400 mt-2"><i class="fas fa-calendar-alt mr-1"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString()}</p>` : '';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <h3 class="font-bold text-md text-gray-100 break-words">${task.title}</h3>
                <div class="flex gap-2 flex-shrink-0 ml-2">
                    <button class="edit-btn text-gray-400 hover:text-blue-400"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <p class="text-sm text-gray-300 my-2 break-words">${task.description || ''}</p>
            ${dueDateText}`;
        
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openTaskModal(task);
        });
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDeleteTask(task.id);
        });
        return card;
    },

    async handleDeleteTask(taskId) {
        if (await this.showConfirm("Tem certeza que deseja excluir esta tarefa?")) {
            try {
                const taskRef = doc(App.db, App.tasksCollectionRef.path, taskId);
                await deleteDoc(taskRef);
                this.showNotification("Tarefa excluída com sucesso!", "success");
            } catch (error) {
                this.showNotification("Falha ao excluir a tarefa.", "error");
            }
        }
    },

    showConfirm(message) {
        return new Promise(resolve => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fixed inset-0 z-50 flex items-center justify-center';
            backdrop.innerHTML = `<div class="modal-content text-center rounded-lg p-6 sm:p-8 w-11/12 max-w-sm"><p class="text-lg mb-6">${message}</p><div class="flex justify-center gap-4"><button id="confirm-no" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg">Não</button><button id="confirm-yes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Sim</button></div></div>`;
            document.body.appendChild(backdrop);
            backdrop.querySelector('#confirm-yes').onclick = () => { document.body.removeChild(backdrop); resolve(true); };
            backdrop.querySelector('#confirm-no').onclick = () => { document.body.removeChild(backdrop); resolve(false); };
        });
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-20 ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.remove('translate-y-20'), 10);
        setTimeout(() => {
            notification.classList.add('translate-y-20');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    },

    addDragAndDropListeners() {
        // Esta parte pode ser expandida com a lógica de drag and drop
    }
};

// =================================================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
