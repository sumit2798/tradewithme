// Pre-Results Radar Web Server & API Service
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RadarEngine } from './src/engine.js';
import { RadarScheduler } from './src/scheduler.js';
import { NseMcpClient } from './src/nse_mcp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3456;
const publicDir = path.join(__dirname, 'public');

const engine = new RadarEngine();
engine.seedInitialData();

const scheduler = new RadarScheduler(engine);
scheduler.start();

const nseMcp = new NseMcpClient();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, text, contentType = 'text/plain; charset=utf-8', statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache'
  });
  res.end(text);
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // REST API Endpoints
  if (pathname === '/api/radar' && req.method === 'GET') {
    const radar = engine.generateRadar('08:00', false);
    sendJSON(res, radar);
    return;
  }

  if (pathname === '/api/refresh' && req.method === 'POST') {
    const radar = engine.generateRadar('manual', true);
    sendJSON(res, radar);
    return;
  }

  if (pathname === '/api/archive' && req.method === 'GET') {
    const archives = engine.getArchive();
    sendJSON(res, archives);
    return;
  }

  if (pathname === '/api/export/whatsapp' && req.method === 'GET') {
    const radar = engine.generateRadar('08:00');
    const text = engine.formatWhatsAppText(radar);
    sendText(res, text);
    return;
  }

  if (pathname === '/api/export/markdown' && req.method === 'GET') {
    const radar = engine.generateRadar('08:00');
    const text = engine.formatMarkdown(radar);
    sendText(res, text, 'text/markdown; charset=utf-8');
    return;
  }

  if (pathname === '/api/notes' && req.method === 'GET') {
    sendJSON(res, engine.getNotes());
    return;
  }

  if (pathname === '/api/notes' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { stock_name, notes } = JSON.parse(body);
        const result = engine.saveNote(stock_name, notes);
        sendJSON(res, result);
      } catch (err) {
        sendJSON(res, { error: err.message }, 400);
      }
    });
    return;
  }

  if (pathname === '/api/shortlist' && req.method === 'GET') {
    sendJSON(res, engine.getShortlist());
    return;
  }

  if (pathname === '/api/shortlist' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { stock_name } = JSON.parse(body);
        const result = engine.toggleShortlist(stock_name);
        sendJSON(res, result);
      } catch (err) {
        sendJSON(res, { error: err.message }, 400);
      }
    });
    return;
  }

  // Trade Plans (User-defined Entry and Stop-Loss tracker)
  if (pathname === '/api/plans' && req.method === 'GET') {
    sendJSON(res, engine.getTradePlans());
    return;
  }

  if (pathname === '/api/plans' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { stock_name, entry_price, stop_loss_price, target_price, notes } = JSON.parse(body);
        const result = engine.saveTradePlan(stock_name, entry_price, stop_loss_price, target_price, notes);
        sendJSON(res, result);
      } catch (err) {
        sendJSON(res, { error: err.message }, 400);
      }
    });
    return;
  }

  // Official NSE India Bhavcopy MCP Chat & Query APIs
  if (pathname === '/api/mcp/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body || '{}');
        const reply = await nseMcp.handleQuery(message);
        sendJSON(res, { ok: true, reply });
      } catch (err) {
        sendJSON(res, { ok: false, error: err.message }, 500);
      }
    });
    return;
  }

  if (pathname === '/api/mcp/tool' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { tool, args } = JSON.parse(body || '{}');
        const result = await nseMcp.callTool(tool, args || {});
        sendJSON(res, { ok: true, result });
      } catch (err) {
        sendJSON(res, { ok: false, error: err.message }, 500);
      }
    });
    return;
  }

  if (pathname === '/api/mcp/tools' && req.method === 'GET') {
    nseMcp.listTools().then(tools => {
      sendJSON(res, { ok: true, tools });
    }).catch(err => {
      sendJSON(res, { ok: false, error: err.message }, 500);
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  Pre-Results Radar Server is Live`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  Schedule:    07:45 IST (Build C) & 08:00 IST (Refresh)`);
  console.log(`======================================================\n`);
});
