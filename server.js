// ========== 1. 引入依赖 ==========
const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDB, getAllTodos, addTodo, toggleTodo, deleteTodo, getTodoById, updateTodoText, checkDuplicate, addInvoice, getAllInvoices, deleteInvoice } = require('./db');
const { recognizeInvoice, validateTaxNo } = require('./ocr');

const app = express();

// ========== 2. 文件上传配置 ==========
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('只允许上传图片或 PDF 文件'));
  }
});

// ========== 3. 中间件 ==========
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// ==================== Todo API ====================
app.get('/api/todos', (req, res) => res.json(getAllTodos()));
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '任务内容不能为空' });
  res.status(201).json(addTodo(text.trim()));
});
app.put('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!toggleTodo(id)) return res.status(404).json({ error: '任务不存在' });
  res.json(getTodoById(id));
});
app.delete('/api/todos/:id', (req, res) => {
  if (!deleteTodo(parseInt(req.params.id))) return res.status(404).json({ error: '任务不存在' });
  res.json({ success: true });
});
app.patch('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '任务内容不能为空' });
  const todo = updateTodoText(id, text.trim());
  if (!todo) return res.status(404).json({ error: '任务不存在' });
  res.json(todo);
});

// ==================== 发票 API ====================
app.post('/api/invoices/upload', upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传发票图片' });
    const isPDF = req.file.mimetype === 'application/pdf';
    console.log(`📷 收到：${req.file.originalname} (${isPDF ? 'PDF' : '图片'})`);
    const result = await recognizeInvoice(req.file.path, isPDF);
    const taxCheck = validateTaxNo(result.taxNo);
    const duplicate = checkDuplicate(result.invoiceNo);
    res.json({
      success: true,
      data: { ...result, imageUrl: '/uploads/' + req.file.filename, taxCheck, duplicate: duplicate ? { exists: true, prevTitle: duplicate.title, createdAt: duplicate.created_at } : { exists: false } }
    });
  } catch (err) {
    console.error('OCR 失败：', err.message);
    res.status(500).json({ error: '识别失败：' + err.message });
  }
});

app.post('/api/invoices/save', (req, res) => {
  const { invoiceNo, title, taxNo, seller, amount, date, imageUrl, rawText } = req.body;
  if (!invoiceNo && !title) return res.status(400).json({ error: '至少需要发票号码或抬头' });
  const duplicate = checkDuplicate(invoiceNo);
  if (duplicate) return res.status(409).json({ error: `该发票已登记（${duplicate.title}，${duplicate.created_at}）` });
  const invoice = addInvoice({ invoiceNo, title, taxNo, seller, amount, date, imagePath: imageUrl, rawText });
  res.status(201).json({ success: true, data: invoice });
});

app.get('/api/invoices', (req, res) => res.json(getAllInvoices()));
app.delete('/api/invoices/:id', (req, res) => {
  if (!deleteInvoice(parseInt(req.params.id))) return res.status(404).json({ error: '记录不存在' });
  res.json({ success: true });
});

// ========== 4. 启动服务器（HTTP + HTTPS）==========
const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;

async function startServer() {
  await initDB();

  // HTTPS（扫码需要）
  const certPath = path.join(__dirname, 'cert.pem');
  const keyPath = path.join(__dirname, 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath)
    };
    https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`🔒 HTTPS : https://localhost:${HTTPS_PORT}`);
      console.log(`📱 手机扫码：https://192.168.199.104:${HTTPS_PORT}`);
    });
  } else {
    console.log('⚠️ 未找到证书，运行 node generate-cert.js 生成');
  }

  // HTTP 也保留（重定向用途）
  http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP  : http://localhost:${HTTP_PORT}`);
  });
}

startServer();
