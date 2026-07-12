import './style.css';
import { Html5Qrcode } from 'html5-qrcode';

// ==================== 标签页切换 ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'invoice') fetchInvoices();
  });
});

// ==================== TODO 逻辑 ====================
const todoInput   = document.getElementById('todoInput');
const todoAddBtn  = document.getElementById('addBtn');
const todoList    = document.getElementById('todoList');
const totalEl     = document.getElementById('totalCount');
const doneEl      = document.getElementById('doneCount');
const clearBtn    = document.getElementById('clearBtn');
const filterBtns  = document.querySelectorAll('#tab-todo .filter-btn');

let todos = [];
let currentFilter = 'all';

async function fetchTodos() {
  const res = await fetch('/api/todos');
  todos = await res.json();
  renderTodos();
}

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  todoInput.value = '';
  fetchTodos();
}

async function toggleTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'PUT' });
  fetchTodos();
}

async function deleteTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  fetchTodos();
}

async function updateTodoText(id, newText) {
  if (!newText.trim()) return;
  await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: newText.trim() })
  });
  fetchTodos();
}

function startEdit(id, span) {
  const currentText = span.textContent;
  const input = document.createElement('input');
  input.type = 'text'; input.value = currentText;
  input.className = 'edit-input';
  span.replaceWith(input); input.focus(); input.select();

  const save = () => {
    const newText = input.value.trim();
    if (newText && newText !== currentText) updateTodoText(id, newText);
    else {
      const ns = document.createElement('span');
      ns.textContent = currentText; ns.onclick = () => startEdit(id, ns);
      input.replaceWith(ns);
    }
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') {
      const ns = document.createElement('span');
      ns.textContent = currentText; ns.onclick = () => startEdit(id, ns);
      input.replaceWith(ns);
    }
  });
}

async function clearDone() {
  const doneIds = todos.filter(t => t.done).map(t => t.id);
  for (const id of doneIds) await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  fetchTodos();
}

function setFilter(filter) {
  currentFilter = filter;
  filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  renderTodos();
}

function renderTodos() {
  let filtered = todos;
  if (currentFilter === 'active') filtered = todos.filter(t => !t.done);
  else if (currentFilter === 'done') filtered = todos.filter(t => t.done);

  todoList.innerHTML = filtered.map(todo => `
    <li class="${todo.done ? 'done' : ''}" data-id="${todo.id}">
      <input type="checkbox" class="todo-check" ${todo.done ? 'checked' : ''}>
      <span class="todo-text">${todo.text}</span>
      <button class="del-btn">删除</button>
    </li>
  `).join('');

  totalEl.textContent = `总计：${todos.length}`;
  doneEl.textContent = `已完成：${todos.filter(t => t.done).length}`;
}

todoList.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  const id = Number(li.dataset.id);
  if (e.target.matches('.todo-check')) toggleTodo(id);
  else if (e.target.matches('.del-btn')) deleteTodo(id);
  else if (e.target.matches('.todo-text')) startEdit(id, e.target);
});

todoAddBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
clearBtn.addEventListener('click', clearDone);
filterBtns.forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter)));

fetchTodos();

// ==================== 发票逻辑 ====================
const uploadZone  = document.getElementById('uploadZone');
const invoiceFile = document.getElementById('invoiceFile');
const loadingBox  = document.getElementById('loadingBox');
const loadingText = document.getElementById('loadingText');
const resultBox   = document.getElementById('resultBox');
const previewImg  = document.getElementById('previewImg');
const fInvoiceNo  = document.getElementById('fInvoiceNo');
const fTitle      = document.getElementById('fTitle');
const fTaxNo      = document.getElementById('fTaxNo');
const fSeller     = document.getElementById('fSeller');
const fAmount     = document.getElementById('fAmount');
const fDate       = document.getElementById('fDate');
const taxStatus   = document.getElementById('taxStatus');
const btnCancel   = document.getElementById('btnCancel');
const btnSave     = document.getElementById('btnSave');
const saveMsg     = document.getElementById('saveMsg');
const invoiceList = document.getElementById('invoiceList');

let currentResult = null; // 暂存当前识别结果
let html5QrCode = null;   // 扫码器实例

// 扫码按钮
const scanBtn = document.getElementById('scanBtn');
const uploadBtn = document.getElementById('uploadBtn');
const scannerBox = document.getElementById('scannerBox');
const scanCancel = document.getElementById('scanCancel');

scanBtn.addEventListener('click', startScan);
uploadBtn.addEventListener('click', () => invoiceFile.click());
scanCancel.addEventListener('click', stopScan);

// ========== 扫码录入 ==========
async function startScan() {
  // 隐藏选择页，显示扫码区
  document.querySelector('.upload-methods').style.display = 'none';
  uploadZone.style.display = 'none';
  scannerBox.style.display = 'block';

  html5QrCode = new Html5Qrcode('qrReader');

  try {
    await html5QrCode.start(
      { facingMode: 'environment' }, // 后置摄像头
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      () => {} // 扫描中，不做处理
    );
  } catch (err) {
    console.error('无法启动摄像头：', err);
    alert('无法打开摄像头，请检查权限');
    stopScan();
  }
}

function onScanSuccess(decodedText) {
  html5QrCode.stop().then(() => {
    scannerBox.style.display = 'none';
    document.querySelector('.upload-methods').style.display = 'flex';
    console.log('扫码结果：', decodedText);
    showQRData(decodedText);
    checkDuplicateByNo();
  });
}

function stopScan() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
  scannerBox.style.display = 'none';
  document.querySelector('.upload-methods').style.display = 'flex';
}

// 解析并显示二维码自带数据（秒出，免费）
function showQRData(text) {
  const parts = text.split(',');
  const qrNo     = parts[2] || parts[3] || '';  // 发票代码或号码
  const qrAmount = parts[4] || '';
  const qrDate   = formatDate2(parts[5] || '');

  currentResult = {
    invoiceNo: qrNo,
    invoiceCode: parts[2] || '',
    amount: qrAmount,
    date: qrDate,
    title: '', taxNo: '', seller: '',
    imageUrl: '', rawText: text, confidence: 100,
    taxCheck: { valid: true },
    duplicate: { exists: false }
  };

  // 显示结果
  resultBox.style.display = 'block';
  previewImg.style.display = 'none';
  fInvoiceNo.value = qrNo;
  fAmount.value    = qrAmount;
  fDate.value      = qrDate;
  fTitle.value     = '';
  fTaxNo.value     = '';
  fSeller.value    = '';
  taxStatus.textContent = '✅ 扫码获取';
  taxStatus.className   = 'field-status ok';
  btnSave.disabled      = false;
  btnSave.style.display = 'inline';
  btnCancel.textContent = '取消';
  saveMsg.className     = 'save-msg';
  saveMsg.textContent   = '💡 如需抬头和税号，点「拍照补全」用百度OCR识别';

  // 显示补全按钮
  document.getElementById('ocrFillBtn').style.display = 'inline';
}

// 查重
async function checkDuplicateByNo() {
  const no = fInvoiceNo.value;
  if (!no) return;
  try {
    const res = await fetch('/api/invoices');
    const list = await res.json();
    const dup = list.find(inv => inv.invoice_no === no);
    if (dup) {
      saveMsg.className = 'save-msg error';
      saveMsg.textContent = `⚠️ 该发票已登记过（${dup.title || '无抬头'}，${dup.created_at || ''}）`;
      btnSave.disabled = true;
      currentResult.duplicate = { exists: true };
    }
  } catch (e) { /* ignore */ }
}

// 拍照补全 — 打开文件选择（相机），上传后OCR补全信息
const ocrFillBtn = document.getElementById('ocrFillBtn');
ocrFillBtn.addEventListener('click', () => invoiceFile.click());

function formatDate2(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd;
  return `${yyyymmdd.substring(0,4)}-${yyyymmdd.substring(4,6)}-${yyyymmdd.substring(6,8)}`;
}

// 点击上传区 → 触发文件选择
uploadZone.addEventListener('click', () => invoiceFile.click());

// 文件选择后 → 自动上传
invoiceFile.addEventListener('change', handleFile);

async function handleFile() {
  const file = invoiceFile.files[0];
  if (!file) return;

  previewImg.style.display = 'block';
  // 显示本地预览
  const reader = new FileReader();
  reader.onload = (e) => { previewImg.src = e.target.result; };
  reader.readAsDataURL(file);

  // 显示加载中
  document.querySelector('.upload-methods').style.display = 'none';
  uploadZone.style.display = 'none';
  resultBox.style.display = 'none';
  loadingBox.style.display = 'block';
  loadingText.textContent = '正在识别发票信息...';
  saveMsg.className = 'save-msg';
  saveMsg.textContent = '';

  const formData = new FormData();
  formData.append('invoice', file);

  try {
    const res = await fetch('/api/invoices/upload', { method: 'POST', body: formData });
    const json = await res.json();

    loadingBox.style.display = 'none';

    if (!json.success) {
      alert('识别失败：' + json.error);
      resetUpload();
      return;
    }

    const ocrData = json.data;
    // 如果是补全模式（已有QR数据），合并：OCR补抬头税号，其他保留扫码值
    const isFillMode = currentResult && currentResult.invoiceNo && !currentResult.title;
    if (isFillMode) {
      currentResult.title  = ocrData.title  || currentResult.title;
      currentResult.taxNo  = ocrData.taxNo  || currentResult.taxNo;
      currentResult.seller = ocrData.seller || currentResult.seller;
      currentResult.imageUrl = ocrData.imageUrl || '';
      currentResult.taxCheck = ocrData.taxCheck;
      currentResult.confidence = ocrData.confidence;
      displayResult(currentResult);
      saveMsg.textContent = '✅ 信息已补全';
      saveMsg.className = 'save-msg success';
    } else {
      // 直接上传模式
      currentResult = ocrData;
      displayResult(ocrData);
    }
  } catch (err) {
    loadingBox.style.display = 'none';
    alert('上传失败：' + err.message);
    resetUpload();
  }
}

function displayResult(data) {
  resultBox.style.display = 'block';

  fInvoiceNo.value = data.invoiceNo || '';
  fTitle.value     = data.title || '';
  fTaxNo.value     = data.taxNo || '';
  fSeller.value    = data.seller || '';
  fAmount.value    = data.amount || '';
  fDate.value      = data.date || '';

  // 税号校验状态
  if (data.taxCheck) {
    taxStatus.textContent = data.taxCheck.valid ? '✅' : '⚠️ ' + data.taxCheck.msg;
    taxStatus.className = 'field-status ' + (data.taxCheck.valid ? 'ok' : 'err');
  }

  // 查重提示
  if (data.duplicate?.exists) {
    saveMsg.className = 'save-msg error';
    saveMsg.textContent = `⚠️ 该发票已登记过（${data.duplicate.prevTitle}，${data.duplicate.createdAt}）`;
    btnSave.disabled = true;
  } else {
    btnSave.disabled = false;
  }

  // 置信度提示
  if (data.confidence < 50) {
    saveMsg.className = 'save-msg error';
    saveMsg.textContent = `⚠️ 识别置信度较低（${Math.round(data.confidence)}%），请手动核对`;
  }
}

function resetUpload() {
  document.querySelector('.upload-methods').style.display = 'flex';
  uploadZone.style.display = 'none';
  loadingBox.style.display = 'none';
  resultBox.style.display = 'none';
  invoiceFile.value = '';
  currentResult = null;
  btnSave.disabled = false;
  saveMsg.textContent = '';
  saveMsg.className = 'save-msg';
}

btnCancel.addEventListener('click', resetUpload);

btnSave.addEventListener('click', async () => {
  if (!currentResult) return;
  btnSave.disabled = true;
  btnSave.textContent = '保存中...';

  const body = {
    invoiceNo: fInvoiceNo.value,
    title:     fTitle.value,
    taxNo:     fTaxNo.value,
    seller:    fSeller.value,
    amount:    fAmount.value,
    date:      fDate.value,
    imageUrl:  currentResult.imageUrl,
    rawText:   currentResult.rawText
  };

  try {
    const res = await fetch('/api/invoices/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();

    if (json.success) {
      saveMsg.className = 'save-msg success';
      saveMsg.textContent = '✅ 登记成功！';
      btnCancel.textContent = '继续上传';
      btnSave.style.display = 'none';
      fetchInvoices();
    } else {
      saveMsg.className = 'save-msg error';
      saveMsg.textContent = '❌ ' + json.error;
      btnSave.disabled = false;
    }
  } catch (err) {
    saveMsg.className = 'save-msg error';
    saveMsg.textContent = '保存失败：' + err.message;
    btnSave.disabled = false;
  }
  btnSave.textContent = '确认登记';
});

// 获取发票列表
async function fetchInvoices() {
  try {
    const res = await fetch('/api/invoices');
    const data = await res.json();

    if (data.length === 0) {
      invoiceList.innerHTML = '<p class="empty-hint">暂无记录</p>';
      return;
    }

    invoiceList.innerHTML = data.map(inv => `
      <div class="invoice-card">
        ${inv.image_path ? `<img src="${inv.image_path}" alt="发票" onerror="this.style.display='none'">` : ''}
        <div class="invoice-info">
          <div class="title">${inv.title || '未识别抬头'}</div>
          <div class="meta">
            ${inv.invoice_no ? '号码：' + inv.invoice_no + ' | ' : ''}
            ${inv.date || ''}
          </div>
          ${inv.amount ? `<div class="amount">¥${inv.amount}</div>` : ''}
        </div>
        <button class="del-invoice" onclick="deleteInvoiceRemote(${inv.id})">删除</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('获取发票列表失败', err);
  }
}

// 删除发票（全局函数给 onclick 用）
window.deleteInvoiceRemote = async (id) => {
  if (!confirm('确定删除这条发票记录？')) return;
  await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
  fetchInvoices();
};
