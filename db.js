// ========== 数据库模块 db.js ==========
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');  // 数据库文件路径
let db;

// ========== 1. 初始化数据库 ==========
async function initDB() {
  // sql.js 需要在内存中创建一个"虚拟数据库"
  const SQL = await initSqlJs();

  // 如果硬盘上已有 data.db 文件，就读取它（服务器重启后数据不丢）
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    // 没有文件就新建一个空数据库
    db = new SQL.Database();
  }

  // 创建 todos 表
  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      text  TEXT    NOT NULL,
      done  INTEGER DEFAULT 0
    )
  `);

  // 创建发票表
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no  TEXT,
      title       TEXT,
      tax_no      TEXT,
      seller      TEXT,
      amount      TEXT,
      date        TEXT,
      image_path  TEXT,
      raw_text    TEXT,
      created_at  TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  saveToFile();
  console.log('✅ 数据库已就绪：' + DB_PATH);
}

// ========== 2. 保存到硬盘文件 ==========
function saveToFile() {
  const data = db.export();                  // 导出整个数据库为二进制
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);          // 写入硬盘
}

// ========== 3. 获取所有任务 ==========
function getAllTodos() {
  const stmt = db.prepare('SELECT id, text, done FROM todos ORDER BY id ASC');
  const rows = [];
  while (stmt.step()) {                       // 逐行读取
    const row = stmt.getAsObject();           // 每行转为 JS 对象
    rows.push({
      id: row.id,
      text: row.text,
      done: row.done === 1                    // SQLite 存 0/1，转成布尔值
    });
  }
  stmt.free();                                // 释放资源
  return rows;
}

// ========== 4. 添加任务 ==========
function addTodo(text) {
  db.run('INSERT INTO todos (text, done) VALUES (?, 0)', [text]);
  // 获取自增 ID
  const result = db.exec('SELECT last_insert_rowid() AS id');
  const id = result[0].values[0][0];
  saveToFile();
  return { id, text, done: false };
}

// ========== 5. 切换完成状态 ==========
function toggleTodo(id) {
  // 先查当前状态
  const stmt = db.prepare('SELECT done FROM todos WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;  // 没找到
  }
  const current = stmt.getAsObject().done;
  stmt.free();

  // 取反并更新
  const newDone = current === 1 ? 0 : 1;
  db.run('UPDATE todos SET done = ? WHERE id = ?', [newDone, id]);
  saveToFile();
  return { id, done: newDone === 1 };
}

// ========== 6. 删除任务 ==========
function deleteTodo(id) {
  const stmt = db.prepare('SELECT id FROM todos WHERE id = ?');
  stmt.bind([id]);
  const exists = stmt.step();
  stmt.free();

  if (!exists) return false;

  db.run('DELETE FROM todos WHERE id = ?', [id]);
  saveToFile();
  return true;
}

// ========== 7. 更新任务文字 ==========
function updateTodoText(id, text) {
  const stmt = db.prepare('SELECT id FROM todos WHERE id = ?');
  stmt.bind([id]);
  const exists = stmt.step();
  stmt.free();
  if (!exists) return null;

  db.run('UPDATE todos SET text = ? WHERE id = ?', [text, id]);
  saveToFile();
  return getTodoById(id);
}

// ========== 8. 按 ID 查找（用于 PUT 返回完整对象）==========
function getTodoById(id) {
  const stmt = db.prepare('SELECT id, text, done FROM todos WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return { id: row.id, text: row.text, done: row.done === 1 };
}

// ========== 9. 发票查重（按发票号码）==========
function checkDuplicate(invoiceNo) {
  if (!invoiceNo) return null;
  const stmt = db.prepare('SELECT id, title, created_at FROM invoices WHERE invoice_no = ?');
  stmt.bind([invoiceNo]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return { id: row.id, title: row.title, created_at: row.created_at };
  }
  stmt.free();
  return null;
}

// ========== 10. 添加发票记录 ==========
function addInvoice(data) {
  db.run(
    `INSERT INTO invoices (invoice_no, title, tax_no, seller, amount, date, image_path, raw_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.invoiceNo || '', data.title || '', data.taxNo || '',
     data.seller || '', data.amount || '', data.date || '',
     data.imagePath || '', data.rawText || '']
  );
  const result = db.exec('SELECT last_insert_rowid() AS id');
  const id = result[0].values[0][0];
  saveToFile();
  return { id, ...data };
}

// ========== 11. 获取所有发票 ==========
function getAllInvoices() {
  const stmt = db.prepare('SELECT * FROM invoices ORDER BY id DESC');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// ========== 12. 删除发票 ==========
function deleteInvoice(id) {
  const stmt = db.prepare('SELECT id FROM invoices WHERE id = ?');
  stmt.bind([id]);
  const exists = stmt.step();
  stmt.free();
  if (!exists) return false;
  db.run('DELETE FROM invoices WHERE id = ?', [id]);
  saveToFile();
  return true;
}

module.exports = { initDB, getAllTodos, addTodo, toggleTodo, deleteTodo, getTodoById, updateTodoText, checkDuplicate, addInvoice, getAllInvoices, deleteInvoice };
