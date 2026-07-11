// ========== 1. 引入依赖 ==========
const express = require('express');
const { initDB, getAllTodos, addTodo, toggleTodo, deleteTodo, getTodoById, updateTodoText } = require('./db');

const app = express();

// ========== 2. 中间件配置 ==========
app.use(express.json());
app.use(express.static(__dirname));

// ========== 3. API 接口（全部改用数据库）==========

// GET /api/todos — 获取所有任务
app.get('/api/todos', (req, res) => {
  const todos = getAllTodos();      // 从数据库读取，不是从内存数组
  res.json(todos);
});

// POST /api/todos — 添加新任务
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: '任务内容不能为空' });
  }
  const todo = addTodo(text.trim());  // 写入数据库
  res.status(201).json(todo);
});

// PUT /api/todos/:id — 切换完成状态
app.put('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const result = toggleTodo(id);
  if (!result) {
    return res.status(404).json({ error: '任务不存在' });
  }
  // 返回完整的任务对象
  const todo = getTodoById(id);
  res.json(todo);
});

// DELETE /api/todos/:id — 删除任务
app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const success = deleteTodo(id);
  if (!success) {
    return res.status(404).json({ error: '任务不存在' });
  }
  res.json({ success: true });
});

// PATCH /api/todos/:id — 编辑任务文字
app.patch('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: '任务内容不能为空' });
  }
  const todo = updateTodoText(id, text.trim());
  if (!todo) {
    return res.status(404).json({ error: '任务不存在' });
  }
  res.json(todo);
});

// ========== 4. 启动服务器 ==========
const PORT = process.env.PORT || 3000;  // 云平台会给 PORT，本地用 3000

// 先初始化数据库，再启动服务器
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ 后端服务已启动：http://localhost:${PORT}`);
  });
});
