/**
 * TaskFlow Pro - Application Logic
 * Clean Vanilla JavaScript with LocalStorage persistence and modern micro-interactions
 */

(function () {
  'use strict';

  // --- Constants & State ---
  const STORAGE_KEY = 'taskflow_todos_v1';
  const THEME_KEY = 'taskflow_theme_pref';
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 22; // r=22 => ~138.23

  const DEFAULT_TODOS = [
    {
      id: 'demo-1',
      title: 'Complete project milestone presentation',
      completed: false,
      priority: 'high',
      category: 'Work',
      dueDate: getRelativeDateString(1),
      createdAt: Date.now() - 3600000 * 5,
    },
    {
      id: 'demo-2',
      title: 'Morning 5km run and meditation session',
      completed: true,
      priority: 'medium',
      category: 'Health',
      dueDate: getRelativeDateString(0),
      createdAt: Date.now() - 3600000 * 24,
    },
    {
      id: 'demo-3',
      title: 'Read chapter 4 of Clean Architecture',
      completed: false,
      priority: 'low',
      category: 'Study',
      dueDate: getRelativeDateString(3),
      createdAt: Date.now() - 3600000 * 2,
    }
  ];

  let state = {
    todos: loadTodos(),
    activeFilter: 'all',
    activeSort: 'newest',
    searchQuery: '',
    selectedPriority: 'medium',
    lastDeletedTask: null,
  };

  // --- DOM Elements ---
  const elements = {
    todoForm: document.getElementById('todoForm'),
    taskInput: document.getElementById('taskInput'),
    categorySelect: document.getElementById('categorySelect'),
    dueDateInput: document.getElementById('dueDateInput'),
    priorityGroup: document.getElementById('priorityGroup'),
    taskList: document.getElementById('taskList'),
    emptyState: document.getElementById('emptyState'),
    listStatusText: document.getElementById('listStatusText'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    // Stats
    statTotal: document.getElementById('statTotal'),
    statPending: document.getElementById('statPending'),
    statCompleted: document.getElementById('statCompleted'),
    statPercent: document.getElementById('statPercent'),
    progressRing: document.getElementById('progressRing'),
    // Theme
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    // Modal
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editTaskId: document.getElementById('editTaskId'),
    editTaskTitle: document.getElementById('editTaskTitle'),
    editTaskCategory: document.getElementById('editTaskCategory'),
    editTaskPriority: document.getElementById('editTaskPriority'),
    editTaskDueDate: document.getElementById('editTaskDueDate'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    // Toast
    toastContainer: document.getElementById('toastContainer'),
  };

  // --- Date Helpers ---
  function getRelativeDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  }

  function formatDisplayDate() {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString(undefined, options);
  }

  function formatDueDate(dueDateStr) {
    if (!dueDateStr) return null;
    const parts = dueDateStr.split('-');
    if (parts.length !== 3) return null;

    const due = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, status: 'overdue' };
    } else if (diffDays === 0) {
      return { text: 'Due today', status: 'due-today' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', status: 'upcoming' };
    } else {
      const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { text: `Due ${formatted}`, status: 'upcoming' };
    }
  }

  // --- Storage ---
  function loadTodos() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Unable to load from localStorage:', e);
    }
    return DEFAULT_TODOS;
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
    } catch (e) {
      console.warn('Unable to save to localStorage:', e);
    }
    updateStats();
  }

  // --- Theme Handling ---
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      elements.themeIconSun.classList.remove('hidden');
      elements.themeIconMoon.classList.add('hidden');
    } else {
      elements.themeIconSun.classList.add('hidden');
      elements.themeIconMoon.classList.remove('hidden');
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  // --- Task Operations ---
  function addTask(title, category, priority, dueDate) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: cleanTitle,
      completed: false,
      priority: priority || 'medium',
      category: category || 'Personal',
      dueDate: dueDate || '',
      createdAt: Date.now(),
    };

    state.todos.unshift(newTask);
    saveTodos();
    renderTasks();
    showToast('Task added successfully!');
  }

  function toggleTask(id) {
    const task = state.todos.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTodos();
    renderTasks();
  }

  function deleteTask(id) {
    const index = state.todos.findIndex(t => t.id === id);
    if (index === -1) return;

    const [deleted] = state.todos.splice(index, 1);
    state.lastDeletedTask = { task: deleted, index };
    saveTodos();
    renderTasks();

    showToast(`Task removed`, true, () => {
      // Undo callback
      if (state.lastDeletedTask) {
        state.todos.splice(state.lastDeletedTask.index, 0, state.lastDeletedTask.task);
        state.lastDeletedTask = null;
        saveTodos();
        renderTasks();
        showToast('Task restored');
      }
    });
  }

  function openEditModal(id) {
    const task = state.todos.find(t => t.id === id);
    if (!task) return;

    elements.editTaskId.value = task.id;
    elements.editTaskTitle.value = task.title;
    elements.editTaskCategory.value = task.category;
    elements.editTaskPriority.value = task.priority;
    elements.editTaskDueDate.value = task.dueDate || '';

    elements.editModal.showModal();
    elements.editTaskTitle.focus();
  }

  function saveEditedTask() {
    const id = elements.editTaskId.value;
    const task = state.todos.find(t => t.id === id);
    if (!task) return;

    const newTitle = elements.editTaskTitle.value.trim();
    if (!newTitle) return;

    task.title = newTitle;
    task.category = elements.editTaskCategory.value;
    task.priority = elements.editTaskPriority.value;
    task.dueDate = elements.editTaskDueDate.value;

    saveTodos();
    renderTasks();
    elements.editModal.close();
    showToast('Task updated');
  }

  function clearCompleted() {
    const completedCount = state.todos.filter(t => t.completed).length;
    if (completedCount === 0) {
      showToast('No completed tasks to clear');
      return;
    }

    state.todos = state.todos.filter(t => !t.completed);
    saveTodos();
    renderTasks();
    showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`);
  }

  // --- Filtering & Sorting ---
  function getFilteredAndSortedTasks() {
    let list = [...state.todos];

    // Status filter
    if (state.activeFilter === 'active') {
      list = list.filter(t => !t.completed);
    } else if (state.activeFilter === 'completed') {
      list = list.filter(t => t.completed);
    }

    // Search query
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.category.toLowerCase().includes(q)
      );
    }

    // Sorting
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    list.sort((a, b) => {
      if (state.activeSort === 'newest') {
        return b.createdAt - a.createdAt;
      } else if (state.activeSort === 'oldest') {
        return a.createdAt - b.createdAt;
      } else if (state.activeSort === 'priority') {
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      } else if (state.activeSort === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return 0;
    });

    return list;
  }

  // --- Rendering UI ---
  function renderTasks() {
    const tasks = getFilteredAndSortedTasks();
    elements.taskList.innerHTML = '';

    if (tasks.length === 0) {
      elements.emptyState.classList.remove('hidden');
    } else {
      elements.emptyState.classList.add('hidden');

      tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.dataset.id = task.id;

        const dueInfo = formatDueDate(task.dueDate);

        li.innerHTML = `
          <div class="task-left">
            <label class="task-checkbox-label" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
              <input 
                type="checkbox" 
                class="task-checkbox" 
                ${task.completed ? 'checked' : ''} 
                aria-label="Toggle task status"
              >
              <svg class="task-checkbox-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </label>
            <div class="task-content">
              <span class="task-title" title="Double click to edit">${escapeHtml(task.title)}</span>
              <div class="task-meta">
                <span class="badge-tag badge-category">${getCategoryIcon(task.category)} ${escapeHtml(task.category)}</span>
                <span class="badge-tag badge-priority-${task.priority}">
                  <span class="dot dot-${task.priority}"></span>
                  ${capitalize(task.priority)}
                </span>
                ${dueInfo ? `
                  <span class="badge-due ${dueInfo.status}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    ${dueInfo.text}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button class="action-btn edit-btn" title="Edit task" aria-label="Edit task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-btn delete-btn" title="Delete task" aria-label="Delete task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        `;

        // Event Listeners for Task Items
        const checkbox = li.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => toggleTask(task.id));

        const editBtn = li.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => openEditModal(task.id));

        const titleEl = li.querySelector('.task-title');
        titleEl.addEventListener('dblclick', () => openEditModal(task.id));

        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        elements.taskList.appendChild(li);
      });
    }

    // Status text update
    const total = state.todos.length;
    const visibleCount = tasks.length;
    if (state.searchQuery) {
      elements.listStatusText.textContent = `Found ${visibleCount} matching ${visibleCount === 1 ? 'task' : 'tasks'}`;
    } else {
      elements.listStatusText.textContent = `Showing ${visibleCount} of ${total} ${total === 1 ? 'task' : 'tasks'}`;
    }

    updateStats();
  }

  function updateStats() {
    const total = state.todos.length;
    const completed = state.todos.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    elements.statTotal.textContent = total;
    elements.statPending.textContent = pending;
    elements.statCompleted.textContent = completed;
    elements.statPercent.textContent = `${percentage}%`;

    // Circular progress
    if (elements.progressRing) {
      const offset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
      elements.progressRing.style.strokeDashoffset = offset;
    }
  }

  // --- Toast Notifications ---
  function showToast(message, allowUndo = false, onUndo = null) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

    if (allowUndo && onUndo) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', () => {
        onUndo();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // --- Utilities ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getCategoryIcon(cat) {
    switch (cat) {
      case 'Work': return '💼';
      case 'Health': return '💪';
      case 'Study': return '📚';
      case 'Finance': return '💳';
      default: return '🏠';
    }
  }

  // --- Event Setup ---
  function setupEventListeners() {
    // Current date
    elements.currentDateDisplay.textContent = formatDisplayDate();

    // Priority selector chips
    elements.priorityGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.priority-chip');
      if (!chip) return;

      elements.priorityGroup.querySelectorAll('.priority-chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });

      chip.classList.add('active');
      chip.setAttribute('aria-checked', 'true');
      state.selectedPriority = chip.dataset.priority;
    });

    // Add task submit
    elements.todoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = elements.taskInput.value;
      const category = elements.categorySelect.value;
      const priority = state.selectedPriority;
      const dueDate = elements.dueDateInput.value;

      addTask(title, category, priority, dueDate);

      elements.taskInput.value = '';
      elements.dueDateInput.value = '';
      elements.taskInput.focus();
    });

    // Search
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        elements.clearSearchBtn.classList.remove('hidden');
      } else {
        elements.clearSearchBtn.classList.add('hidden');
      }
      renderTasks();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.clearSearchBtn.classList.add('hidden');
      renderTasks();
      elements.searchInput.focus();
    });

    // Filter tabs
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.filterTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.activeFilter = tab.dataset.filter;
        renderTasks();
      });
    });

    // Sort select
    elements.sortSelect.addEventListener('change', (e) => {
      state.activeSort = e.target.value;
      renderTasks();
    });

    // Clear completed
    elements.clearCompletedBtn.addEventListener('click', clearCompleted);

    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Modal Edit Form
    elements.editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEditedTask();
    });

    elements.closeModalBtn.addEventListener('click', () => elements.editModal.close());
    elements.cancelEditBtn.addEventListener('click', () => elements.editModal.close());

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Press '/' to search
      if (e.key === '/' && document.activeElement !== elements.taskInput && document.activeElement !== elements.searchInput) {
        e.preventDefault();
        elements.searchInput.focus();
      }
      // Escape closes modal
      if (e.key === 'Escape' && elements.editModal.open) {
        elements.editModal.close();
      }
    });
  }

  // --- Initializer ---
  function init() {
    initTheme();
    setupEventListeners();
    renderTasks();
  }

  // Start app
  init();
})();
