const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DB_PATH = path.join(__dirname, 'data.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function runSql(sql, options = { json: false }) {
  return new Promise((resolve, reject) => {
    const args = [DB_PATH];
    if (options.json) {
      args.push('-json');
    }
    args.push(sql);
    execFile('sqlite3', args, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      if (options.json) {
        try {
          const parsed = stdout.trim() ? JSON.parse(stdout) : [];
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

function escapeValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

async function initializeDatabase() {
  const createPolicies = `CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_number TEXT NOT NULL,
    claim_number TEXT,
    date TEXT,
    address TEXT,
    attended INTEGER DEFAULT 0,
    broker_letter_number TEXT,
    broker_letter_date TEXT
  );`;
  const createClients = `CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    claim_presented INTEGER DEFAULT 0,
    letter_sent INTEGER DEFAULT 0,
    client_letter_number TEXT,
    client_letter_date TEXT,
    technical_report_path TEXT,
    inspection_report_path TEXT,
    FOREIGN KEY(policy_id) REFERENCES policies(id) ON DELETE CASCADE
  );`;
  await runSql(`${createPolicies}${createClients}`);
}

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  }[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  stream.pipe(res);
  return true;
}

function serveUpload(req, res) {
  const filePath = path.join(__dirname, req.url);
  if (!filePath.startsWith(UPLOAD_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return true;
  }
  res.writeHead(200, { 'Content-Type': 'application/pdf' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e7) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function getPolicyClients() {
  const sql = `SELECT 
    p.id AS policy_id,
    p.policy_number,
    p.claim_number,
    p.date,
    p.address,
    p.attended,
    p.broker_letter_number,
    p.broker_letter_date,
    c.id AS client_id,
    c.name AS client_name,
    c.claim_presented,
    c.letter_sent,
    c.client_letter_number,
    c.client_letter_date,
    c.technical_report_path,
    c.inspection_report_path
  FROM policies p
  LEFT JOIN clients c ON c.policy_id = p.id
  ORDER BY p.date DESC, p.policy_number ASC, c.name ASC;`;
  const rows = await runSql(sql, { json: true });
  return rows;
}

async function getPolicy(id) {
  const sql = `SELECT * FROM policies WHERE id = ${escapeValue(id)} LIMIT 1;`;
  const rows = await runSql(sql, { json: true });
  return rows[0] || null;
}

async function getClient(id) {
  const sql = `SELECT * FROM clients WHERE id = ${escapeValue(id)} LIMIT 1;`;
  const rows = await runSql(sql, { json: true });
  return rows[0] || null;
}

function writeFileFromBase64(folder, fileInfo) {
  if (!fileInfo || !fileInfo.name || !fileInfo.data) {
    return null;
  }
  const baseName = `${Date.now()}-${fileInfo.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const targetPath = path.join(folder, baseName);
  const matches = fileInfo.data.match(/^data:.*;base64,(.*)$/);
  const content = matches ? matches[1] : fileInfo.data;
  fs.writeFileSync(targetPath, Buffer.from(content, 'base64'));
  return `/uploads/${baseName}`;
}

async function createPolicy(data) {
  const sql = `INSERT INTO policies (policy_number, claim_number, date, address, attended, broker_letter_number, broker_letter_date)
  VALUES (
    ${escapeValue(data.policy_number)},
    ${escapeValue(data.claim_number)},
    ${escapeValue(data.date)},
    ${escapeValue(data.address)},
    ${escapeValue(data.attended)},
    ${escapeValue(data.broker_letter_number)},
    ${escapeValue(data.broker_letter_date)}
  ); SELECT last_insert_rowid() AS id;`;
  const result = await runSql(sql, { json: true });
  return result && result[0] ? result[0].id : null;
}

async function updatePolicy(id, data) {
  const sql = `UPDATE policies SET
    policy_number = ${escapeValue(data.policy_number)},
    claim_number = ${escapeValue(data.claim_number)},
    date = ${escapeValue(data.date)},
    address = ${escapeValue(data.address)},
    attended = ${escapeValue(data.attended)},
    broker_letter_number = ${escapeValue(data.broker_letter_number)},
    broker_letter_date = ${escapeValue(data.broker_letter_date)}
  WHERE id = ${escapeValue(id)};`;
  await runSql(sql);
}

async function createClient(data) {
  const technicalPath = writeFileFromBase64(UPLOAD_DIR, data.technical_report_file);
  const inspectionPath = writeFileFromBase64(UPLOAD_DIR, data.inspection_report_file);
  const sql = `INSERT INTO clients (
    policy_id, name, claim_presented, letter_sent, client_letter_number, client_letter_date, technical_report_path, inspection_report_path
  ) VALUES (
    ${escapeValue(data.policy_id)},
    ${escapeValue(data.name)},
    ${escapeValue(data.claim_presented)},
    ${escapeValue(data.letter_sent)},
    ${escapeValue(data.client_letter_number)},
    ${escapeValue(data.client_letter_date)},
    ${escapeValue(technicalPath)},
    ${escapeValue(inspectionPath)}
  ); SELECT last_insert_rowid() AS id;`;
  const result = await runSql(sql, { json: true });
  return result && result[0] ? result[0].id : null;
}

async function updateClient(id, data) {
  let technicalPath = data.existing_technical_report_path || null;
  let inspectionPath = data.existing_inspection_report_path || null;
  if (data.technical_report_file && data.technical_report_file.data) {
    technicalPath = writeFileFromBase64(UPLOAD_DIR, data.technical_report_file);
  }
  if (data.inspection_report_file && data.inspection_report_file.data) {
    inspectionPath = writeFileFromBase64(UPLOAD_DIR, data.inspection_report_file);
  }
  const sql = `UPDATE clients SET
    policy_id = ${escapeValue(data.policy_id)},
    name = ${escapeValue(data.name)},
    claim_presented = ${escapeValue(data.claim_presented)},
    letter_sent = ${escapeValue(data.letter_sent)},
    client_letter_number = ${escapeValue(data.client_letter_number)},
    client_letter_date = ${escapeValue(data.client_letter_date)},
    technical_report_path = ${escapeValue(technicalPath)},
    inspection_report_path = ${escapeValue(inspectionPath)}
  WHERE id = ${escapeValue(id)};`;
  await runSql(sql);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/uploads/')) {
      serveUpload(req, res);
      return;
    }
    if (req.method === 'GET' && serveStatic(req, res)) {
      return;
    }

    if (req.url === '/api/policy-clients' && req.method === 'GET') {
      const data = await getPolicyClients();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.url.startsWith('/api/policies/') && req.method === 'GET') {
      const id = req.url.split('/').pop();
      const policy = await getPolicy(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(policy || {}));
      return;
    }

    if (req.url.startsWith('/api/clients/') && req.method === 'GET') {
      const id = req.url.split('/').pop();
      const client = await getClient(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(client || {}));
      return;
    }

    if (req.url === '/api/policies' && req.method === 'POST') {
      const body = await parseBody(req);
      const id = await createPolicy(body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id }));
      return;
    }

    if (req.url.startsWith('/api/policies/') && req.method === 'PUT') {
      const id = req.url.split('/').pop();
      const body = await parseBody(req);
      await updatePolicy(id, body);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/clients' && req.method === 'POST') {
      const body = await parseBody(req);
      const id = await createClient(body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id }));
      return;
    }

    if (req.url.startsWith('/api/clients/') && req.method === 'PUT') {
      const id = req.url.split('/').pop();
      const body = await parseBody(req);
      await updateClient(id, body);
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

initializeDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database', err);
});
