const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'todos.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data directory and initial todos file exist
function initializeData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initialTodos = [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : 'todo-' + Date.now() + '-1',
        title: 'Welcome to your new To-Do app! 👋',
        completed: true,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: crypto.randomUUID ? crypto.randomUUID() : 'todo-' + Date.now() + '-2',
        title: 'Add your own task in the box above ✍️',
        completed: false,
        createdAt: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: crypto.randomUUID ? crypto.randomUUID() : 'todo-' + Date.now() + '-3',
        title: 'Check off or delete tasks as you finish them ✨',
        completed: false,
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialTodos, null, 2), 'utf-8');
  }
}

function readTodos() {
  try {
    initializeData();
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading todos:', err);
    return [];
  }
}

function writeTodos(todos) {
  try {
    initializeData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving todos:', err);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Private-Network': 'true'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`[${new Date().toLocaleTimeString()}] ${method} ${pathname}`);

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Private-Network': 'true'
    });
    res.end();
    return;
  }

  // --- API Routes ---
  if (pathname.startsWith('/api/todos')) {
    // GET /api/todos
    if (method === 'GET' && pathname === '/api/todos') {
      const todos = readTodos();
      sendJSON(res, 200, todos);
      return;
    }

    // POST /api/todos
    if (method === 'POST' && pathname === '/api/todos') {
      try {
        const body = await parseRequestBody(req);
        const title = (body.title || '').trim();

        if (!title) {
          sendJSON(res, 400, { error: 'Task title is required' });
          return;
        }

        if (title.length > 250) {
          sendJSON(res, 400, { error: 'Task title cannot exceed 250 characters' });
          return;
        }

        const todos = readTodos();
        const newTodo = {
          id: crypto.randomUUID ? crypto.randomUUID() : 'todo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          title: title,
          completed: false,
          createdAt: new Date().toISOString()
        };

        todos.unshift(newTodo);
        writeTodos(todos);
        sendJSON(res, 201, newTodo);
      } catch (err) {
        sendJSON(res, 400, { error: err.message });
      }
      return;
    }

    // DELETE /api/todos?completed=true (Clear completed)
    if (method === 'DELETE' && pathname === '/api/todos') {
      if (parsedUrl.query.completed === 'true') {
        const todos = readTodos();
        const remaining = todos.filter(t => !t.completed);
        const removedCount = todos.length - remaining.length;
        writeTodos(remaining);
        sendJSON(res, 200, { success: true, removedCount });
        return;
      }
      sendJSON(res, 400, { error: 'Specify ?completed=true to clear completed tasks' });
      return;
    }

    // Specific item routes: /api/todos/:id
    const itemMatch = pathname.match(/^\/api\/todos\/([a-zA-Z0-9_-]+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      const todos = readTodos();
      const index = todos.findIndex(t => t.id === id);

      if (index === -1) {
        sendJSON(res, 404, { error: 'Task not found' });
        return;
      }

      // PATCH /api/todos/:id
      if (method === 'PATCH') {
        try {
          const body = await parseRequestBody(req);
          if (typeof body.completed === 'boolean') {
            todos[index].completed = body.completed;
          }
          if (typeof body.title === 'string' && body.title.trim()) {
            todos[index].title = body.title.trim();
          }
          todos[index].updatedAt = new Date().toISOString();
          writeTodos(todos);
          sendJSON(res, 200, todos[index]);
        } catch (err) {
          sendJSON(res, 400, { error: err.message });
        }
        return;
      }

      // DELETE /api/todos/:id
      if (method === 'DELETE') {
        const deleted = todos.splice(index, 1)[0];
        writeTodos(todos);
        sendJSON(res, 200, { success: true, deleted });
        return;
      }
    }

    sendJSON(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // --- Static File Serving ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent path traversal out of PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA or return 404
      const notFoundPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(notFoundPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(notFoundPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

initializeData();

server.listen(PORT, () => {
  console.log(`To-Do App server running at http://localhost:${PORT}`);
});
