// Vite 支持直接 import CSS，修改时会自动热更新
import './style.css';

// ========== 获取 DOM 元素 ==========
const input      = document.getElementById('todoInput');
const addBtn     = document.getElementById('addBtn');
const list       = document.getElementById('todoList');
const totalEl    = document.getElementById('totalCount');
const doneEl     = document.getElementById('doneCount');
const clearBtn   = document.getElementById('clearBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

// ========== 状态 ==========
let todos = [];
let currentFilter = 'all';

// ========== 1. 从后端获取任务 ==========
async function fetchTodos() {
  const res = await fetch('/api/todos');
  todos = await res.json();
  render();
}

// ========== 2. 添加任务 ==========
async function addTodo() {
  const text = input.value.trim();
  if (!text) return;

  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  input.value = '';
  fetchTodos();
}

// ========== 3. 切换完成状态 ==========
async function toggleTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'PUT' });
  fetchTodos();
}

// ========== 4. 删除任务 ==========
async function deleteTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  fetchTodos();
}

// ========== 5. 编辑任务文字 ==========
async function updateTodoText(id, newText) {
  if (!newText.trim()) return;
  await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: newText.trim() })
  });
  fetchTodos();
}

// ========== 6. 进入编辑模式 ==========
function startEdit(id, span) {
  const currentText = span.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'edit-input';
  span.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      updateTodoText(id, newText);
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') {
      const newSpan = document.createElement('span');
      newSpan.textContent = currentText;
      input.replaceWith(newSpan);
    }
  });
}

// ========== 7. 清空已完成 ==========
async function clearDone() {
  const doneIds = todos.filter(t => t.done).map(t => t.id);
  for (const id of doneIds) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  }
  fetchTodos();
}

// ========== 8. 切换过滤器 ==========
function setFilter(filter) {
  currentFilter = filter;
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  render();
}

// ========== 9. 渲染 ==========
function render() {
  let filtered = todos;
  if (currentFilter === 'active') filtered = todos.filter(t => !t.done);
  else if (currentFilter === 'done') filtered = todos.filter(t => t.done);

  list.innerHTML = filtered.map(todo => `
    <li class="${todo.done ? 'done' : ''}" data-id="${todo.id}">
      <input type="checkbox" class="todo-check" ${todo.done ? 'checked' : ''}>
      <span class="todo-text">${todo.text}</span>
      <button class="del-btn">删除</button>
    </li>
  `).join('');

  totalEl.textContent = `总计：${todos.length}`;
  doneEl.textContent  = `已完成：${todos.filter(t => t.done).length}`;
}

// ========== 10. 事件委托（不写 inline onclick 了）==========

// 列表上的所有点击，统一在这里处理
list.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const id = Number(li.dataset.id);

  if (e.target.matches('.todo-check')) {
    toggleTodo(id);                        // 点复选框 → 切换完成
  } else if (e.target.matches('.del-btn')) {
    deleteTodo(id);                        // 点删除 → 删除任务
  } else if (e.target.matches('.todo-text')) {
    startEdit(id, e.target);              // 点文字 → 编辑
  }
});

addBtn.addEventListener('click', addTodo);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});
clearBtn.addEventListener('click', clearDone);
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

// ========== 启动 ==========
fetchTodos();
