// ========== 百度 OCR 增值税发票识别模块 ==========
const fs = require('fs');

const API_KEY    = 'wceMpoH0JXbtntXWNzkMfMDg';
const SECRET_KEY = 'j4ksfAk2fn0XNEcDJHA1DIii6SpqeEvW';

let accessToken = null;
let tokenExpire = 0;

// ========== 1. 获取 Access Token（有效期 30 天，缓存复用）==========
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpire) return accessToken;

  const res = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`);
  const data = await res.json();

  if (data.error) {
    throw new Error('获取百度Token失败：' + data.error_description);
  }

  accessToken = data.access_token;
  tokenExpire = Date.now() + (data.expires_in - 300) * 1000; // 提前5分钟过期
  console.log('  🔑 百度 OCR Token 已获取');
  return accessToken;
}

// ========== 2. 识别增值税发票（支持图片和 PDF）==========
async function recognizeInvoice(imagePath, isPDF = false) {
  const startTime = Date.now();
  console.log(`\n📷 正在用百度 OCR 识别${isPDF ? 'PDF' : '图片'}发票...`);

  const token = await getAccessToken();
  const fileBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

  // PDF 和图片用不同参数
  let body;
  if (isPDF) {
    body = 'pdf_file=' + encodeURIComponent(fileBase64) + '&pdf_file_num=1';
  } else {
    body = 'image=' + encodeURIComponent(fileBase64);
  }

  const res = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/vat_invoice?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });

  const data = await res.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (data.error_code) {
    throw new Error(`百度 OCR 错误 [${data.error_code}]: ${data.error_msg}`);
  }

  console.log(`  ✅ 识别完成，耗时 ${elapsed} 秒`);
  return parseBaiduResult(data);
}

// ========== 3. 解析百度返回的结果 ==========
function parseBaiduResult(data) {
  const words = data.words_result || {};

  const getVal = (key) => words[key]?.word || '';

  // 金额特殊处理：取小写金额
  let amount = getVal('AmountInFigures');
  if (!amount) {
    // 从合计金额提取
    amount = getVal('TotalAmount');
  }

  return {
    invoiceNo: getVal('InvoiceNum'),
    title:     getVal('PurchaserName'),          // 购方名称（抬头）
    taxNo:     getVal('PurchaserRegisterNum'),   // 购方税号
    seller:    getVal('SellerName'),             // 销方名称
    amount:    amount,
    date:      getVal('InvoiceDate'),
    // 校验码、货物清单等额外信息
    checkCode: getVal('CheckCode'),
    items:     (words.CommodityName         // 货物列表
        ? words.CommodityName.map((item, i) => ({
            name: item.word || '',
            count: words.CommodityNum?.[i]?.word || '',
            price: words.CommodityPrice?.[i]?.word || '',
          }))
        : []),
    rawText:   JSON.stringify(words, null, 2),
    confidence: 95  // 百度 OCR 准确率很高
  };
}

// ========== 4. 校验税号 ==========
function validateTaxNo(taxNo) {
  if (!taxNo) return { valid: false, msg: '未识别到税号' };
  const cleaned = taxNo.replace(/\s/g, '').toUpperCase();
  if (/^[A-Z0-9]{15}$/.test(cleaned) || /^[A-Z0-9]{18}$/.test(cleaned)) {
    return { valid: true, taxNo: cleaned };
  }
  return { valid: false, msg: `税号格式不正确（${taxNo.length}位），应为15或18位` };
}

module.exports = { recognizeInvoice, validateTaxNo };
