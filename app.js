document.addEventListener('DOMContentLoaded', () => {
  // --- Determine API Base ---
  const isFileProtocol = window.location.protocol === 'file:';
  const API_BASE = isFileProtocol ? 'http://localhost:3000' : '';

  // --- DOM Elements ---
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');
  const itemsLeftEl = document.getElementById('items-left');
  const countAllEl = document.getElementById('count-all');
  const countActiveEl = document.getElementById('count-active');
  const countCompletedEl = document.getElementById('count-completed');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const currentDateEl = document.getElementById('current-date');
  const toast = document.getElementById('toast');
  const protocolBanner = document.getElementById('protocol-banner');

  // --- State ---
  let todos = [];
  let currentFilter = 'all';
  let toastTimeout = null;

  // Show protocol warning if user opened file:/// directly in browser
  if (isFileProtocol && protocolBanner) {
    protocolBanner.style.display = 'flex';
  }

  // --- Initialize UI ---
  formatCurrentDate();
  initializeTodos();

  // --- Event Listeners ---
  todoForm.addEventListener('submit', handleAddTodo);

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentFilter = btn.dataset.filter;
      renderTodos();
    });
  });

  clearCompletedBtn.addEventListener('click', handleClearCompleted);

  // --- Storage & Sync Helpers ---
  function getLocalTodos() {
    try {
      const stored = localStorage.getItem('focus_todos');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocalTodos(data) {
    try {
      localStorage.setItem('focus_todos', JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  const defaultStarterTodos = [
    {
      id: 'default-1',
      title: 'Welcome to your new To-Do app! 👋',
      completed: true,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'default-2',
      title: 'Add your own task in the box above ✍️',
      completed: false,
      createdAt: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'default-3',
      title: 'Check off or delete tasks as you finish them ✨',
      completed: false,
      createdAt: new Date().toISOString()
    }
  ];

  // --- Initialize Todos ---
  async function initializeTodos() {
    // 1. Immediately render local/cached data so the page is instant and responsive
    const local = getLocalTodos();
    if (local && Array.isArray(local) && local.length > 0) {
      todos = local;
    } else {
      todos = [...defaultStarterTodos];
      saveLocalTodos(todos);
    }
    renderTodos();

    // 2. Fetch fresh data from backend server in background
    try {
      const res = await fetch(`${API_BASE}/api/todos`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const serverTodos = await res.json();
        if (Array.isArray(serverTodos) && serverTodos.length > 0) {
          todos = serverTodos;
          saveLocalTodos(todos);
          renderTodos();
        }
      }
    } catch (err) {
      console.log('Backend sync offline or running locally. Using local storage mode.');
      if (isFileProtocol) {
        showToast('Running in local mode. Open http://localhost:3000 to sync with Node server.');
      }
    }
  }

  // --- Add Todo ---
  async function handleAddTodo(e) {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;

    // Create new todo item immediately (Instant Optimistic UI)
    const tempId = 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newTodo = {
      id: tempId,
      title: title,
      completed: false,
      createdAt: new Date().toISOString()
    };

    // Update state & UI right away so the user never experiences delay or failure
    todos.unshift(newTodo);
    saveLocalTodos(todos);
    todoInput.value = '';
    renderTodos();
    showToast('Task added');

    // Sync with backend server
    try {
      const res = await fetch(`${API_BASE}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo.title })
      });

      if (res.ok) {
        const serverTodo = await res.json();
        // Replace tempId with confirmed server id
        const idx = todos.findIndex(t => t.id === tempId);
        if (idx !== -1) {
          todos[idx].id = serverTodo.id;
          saveLocalTodos(todos);
        }
      }
    } catch (err) {
      console.warn('Server sync failed, task preserved locally:', err);
    }
  }

  // --- Toggle Complete ---
  async function toggleTodoStatus(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    // Instant update
    todo.completed = !todo.completed;
    saveLocalTodos(todos);
    renderTodos();

    try {
      await fetch(`${API_BASE}/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: todo.completed })
      });
    } catch (err) {
      console.warn('Server sync failed for toggle:', err);
    }
  }

  // --- Delete Todo ---
  async function deleteTodoItem(id, itemElement) {
    // Smooth exit animation
    if (itemElement) {
      itemElement.classList.add('removing');
    }

    setTimeout(async () => {
      todos = todos.filter(t => t.id !== id);
      saveLocalTodos(todos);
      renderTodos();
      showToast('Task deleted');

      try {
        await fetch(`${API_BASE}/api/todos/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Server sync failed for delete:', err);
      }
    }, 180);
  }

  // --- Inline Edit Title ---
  async function updateTodoTitle(id, newTitle) {
    const trimmed = newTitle.trim();
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (!trimmed || trimmed === todo.title) {
      renderTodos();
      return;
    }

    todo.title = trimmed;
    saveLocalTodos(todos);
    renderTodos();
    showToast('Task updated');

    try {
      await fetch(`${API_BASE}/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed })
      });
    } catch (err) {
      console.warn('Server sync failed for title update:', err);
    }
  }

  // --- Clear Completed ---
  async function handleClearCompleted() {
    const completedCount = todos.filter(t => t.completed).length;
    if (completedCount === 0) return;

    todos = todos.filter(t => !t.completed);
    saveLocalTodos(todos);
    renderTodos();
    showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`);

    try {
      await fetch(`${API_BASE}/api/todos?completed=true`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Server sync failed for clear completed:', err);
    }
  }

  // --- Render Functions ---
  function renderTodos() {
    todoList.innerHTML = '';

    const filteredTodos = todos.filter(todo => {
      if (currentFilter === 'active') return !todo.completed;
      if (currentFilter === 'completed') return todo.completed;
      return true;
    });

    if (filteredTodos.length === 0) {
      emptyState.style.display = 'flex';
      if (currentFilter === 'active') {
        emptyTitle.textContent = 'No active tasks';
        emptyDesc.textContent = 'Great work! All your current tasks are completed.';
      } else if (currentFilter === 'completed') {
        emptyTitle.textContent = 'No completed tasks yet';
        emptyDesc.textContent = 'Tasks you finish will show up right here.';
      } else {
        emptyTitle.textContent = 'All caught up!';
        emptyDesc.textContent = 'Your to-do list is empty. Add a task above to get started.';
      }
    } else {
      emptyState.style.display = 'none';

      filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        // Checkbox button
        const checkBtn = document.createElement('button');
        checkBtn.className = 'checkbox-btn';
        checkBtn.setAttribute('type', 'button');
        checkBtn.setAttribute('aria-label', todo.completed ? 'Mark incomplete' : 'Mark complete');
        checkBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        checkBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTodoStatus(todo.id);
        });

        // Content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'todo-content';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'todo-title';
        titleSpan.textContent = todo.title;
        titleSpan.title = 'Click to toggle, double-click to edit';

        // Clicking title toggles completion
        titleSpan.addEventListener('click', () => toggleTodoStatus(todo.id));

        // Double click to inline edit
        titleSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          enableInlineEdit(todo.id, titleSpan);
        });

        const timeSpan = document.createElement('span');
        timeSpan.className = 'todo-time';
        timeSpan.textContent = formatRelativeTime(todo.createdAt);

        contentDiv.appendChild(titleSpan);
        contentDiv.appendChild(timeSpan);

        // Actions container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'todo-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('type', 'button');
        deleteBtn.setAttribute('aria-label', `Delete ${todo.title}`);
        deleteBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTodoItem(todo.id, li);
        });

        actionsDiv.appendChild(deleteBtn);

        li.appendChild(checkBtn);
        li.appendChild(contentDiv);
        li.appendChild(actionsDiv);

        todoList.appendChild(li);
      });
    }

    updateStats();
  }

  function enableInlineEdit(id, titleSpan) {
    const currentText = titleSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-edit-input';
    input.value = currentText;
    input.maxLength = 250;

    let isSaved = false;

    const save = () => {
      if (isSaved) return;
      isSaved = true;
      updateTodoTitle(id, input.value);
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        save();
      } else if (e.key === 'Escape') {
        isSaved = true;
        renderTodos();
      }
    });

    titleSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  function updateStats() {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const active = total - completed;

    // Badges
    countAllEl.textContent = total;
    countActiveEl.textContent = active;
    countCompletedEl.textContent = completed;

    // Footer items left
    itemsLeftEl.textContent = `${active} item${active === 1 ? '' : 's'} remaining`;

    // Clear completed button
    clearCompletedBtn.style.display = completed > 0 ? 'inline-block' : 'none';

    // Progress bar
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = `${completed} of ${total} tasks completed`;
  }

  // --- Helper Functions ---
  function formatCurrentDate() {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const today = new Date();
    currentDateEl.textContent = today.toLocaleDateString('en-US', options);
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function showToast(message) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }
});
