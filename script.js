// ========== 获取 DOM 元素 ==========
const input      = document.getElementById('todoInput');
const addBtn     = document.getElementById('addBtn');
const list       = document.getElementById('todoList');
const totalEl    = document.getElementById('totalCount');
const doneEl     = document.getElementById('doneCount');
const clearBtn   = document.getElementById('clearBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

// ========== 状态 ==========
let todos = [];           // 当前展示的任务列表
let currentFilter = 'all'; // 'all' | 'active' | 'done'

// ========== 1. 从后端获取所有任务 ==========
async function fetchTodos() {
  const res  = await fetch('/api/todos');  // 发 GET 请求
  todos      = await res.json();           // 把返回的 JSON 转成 JS 对象
  render();
}

// ========== 2. 添加任务（调后端 API）==========
async function addTodo() {
  const text = input.value.trim();
  if (!text) return;

  await fetch('/api/todos', {           // 发 POST 请求
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })      // 把 data 转成 JSON 字符串发送
  });

  input.value = '';
  fetchTodos();  // 重新从后端拉取最新数据
}

// ========== 3. 切换完成状态 ==========
async function toggleTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'PUT' });  // 发 PUT 请求
  fetchTodos();
}

// ========== 4. 删除任务 ==========
async function deleteTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'DELETE' }); // 发 DELETE 请求
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

// ========== 6. 双击进入编辑模式 ==========
function startEdit(id, span) {
  const currentText = span.textContent;
  // 把 <span> 替换成 <input>
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'edit-input';
  span.replaceWith(input);
  input.focus();
  input.select();  // 全选文字，方便修改

  // 保存编辑
  const save = () => {
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      updateTodoText(id, newText);  // 调 API 保存
    } else {
      // 没改或为空，恢复原样
      const newSpan = document.createElement('span');
      newSpan.textContent = currentText;
      newSpan.onclick = () => startEdit(id, newSpan);
      input.replaceWith(newSpan);
    }
  };

  input.addEventListener('blur', save);          // 失去焦点 = 保存
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();               // 回车 = 保存
    if (e.key === 'Escape') {                    // Esc = 取消
      const newSpan = document.createElement('span');
      newSpan.textContent = currentText;
      newSpan.onclick = () => startEdit(id, newSpan);
      input.replaceWith(newSpan);
    }
  });
}
// ========== 7. 清空已完成 ==========
async function clearDone() {
  // 批量删除所有已完成的任务
  const doneIds = todos.filter(t => t.done).map(t => t.id);
  for (const id of doneIds) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  }
  fetchTodos();
}

// ========== 6. 切换过滤器 ==========
function setFilter(filter) {
  currentFilter = filter;
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  render();  // 过滤器改变不需要重新请求后端，直接重新渲染即可
}

// ========== 7. 渲染 ==========
function render() {
  // 根据过滤器筛选
  let filtered = todos;
  if (currentFilter === 'active') {
    filtered = todos.filter(t => !t.done);
  } else if (currentFilter === 'done') {
    filtered = todos.filter(t => t.done);
  }

  // 生成 HTML
  list.innerHTML = filtered.map(todo => `
    <li class="${todo.done ? 'done' : ''}">
      <input type="checkbox" ${todo.done ? 'checked' : ''}
             onchange="toggleTodo(${todo.id})">
      <span onclick="startEdit(${todo.id}, this)">${todo.text}</span>
      <button class="del-btn" onclick="deleteTodo(${todo.id})">删除</button>
    </li>
  `).join('');

  // 更新统计
  totalEl.textContent = `总计：${todos.length}`;
  doneEl.textContent  = `已完成：${todos.filter(t => t.done).length}`;
}

// ========== 8. 事件绑定 ==========
addBtn.addEventListener('click', addTodo);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});
clearBtn.addEventListener('click', clearDone);
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

// ========== 9. 页面加载时从后端获取数据 ==========
fetchTodos();
