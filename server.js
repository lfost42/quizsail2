const path = require('path');
const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// Configuration
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const logsDir = path.join(PUBLIC_DIR, 'logs');
const quizDir = path.join(PUBLIC_DIR, 'quizzes');

const app = express();
const port = 3000;

// Middleware setup FIRST
app.use(bodyParser.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API Routes
app.get('/api/quizzes', (req, res) => {
  fs.readdir(quizDir, (err, files) => {
    if (err) return res.status(500).send('Server error');
    const quizzes = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    res.json(quizzes);
  });
});

// State management routes
app.get('/state/:id', (req, res) => {
  const hashid = hash(req.params.id);
  const statePath = path.join(DATA_DIR, hashid); // Removed .json extension
  
  if (!fs.existsSync(statePath)) {
    return res.status(404).send('Not found');
  }
  
  try {
    const data = fs.readFileSync(statePath);
    res.send(JSON.parse(data));
  } catch (e) {
    console.error('State read error:', e);
    res.status(500).send('Invalid state format');
  }
});

app.post("/state/:id", (req, res) => {
  const hashid = hash(req.params.id);
  const statePath = path.join(DATA_DIR, hashid); // Removed .json extension
  
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    fs.writeFileSync(statePath, JSON.stringify(req.body), { flag: 'w' });
    res.sendStatus(200);
  } catch (e) {
    console.error('Save failed:', e);
    res.status(500).send('Save failed');
  }
});

app.delete("/state/:id", (req, res) => {
  const hashid = hash(req.params.id);
  const statePath = path.join(DATA_DIR, hashid);

  try {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    res.sendStatus(200);
  } catch (e) {
    if (e.code === 'ENOENT') {
      res.sendStatus(200); // File doesn't exist, no need to delete
    } else {
      console.error('Deletion error:', e);
      res.status(500).send('Server error during deletion');
    }
  }
});

// Directory creation in case someone deletes it before knowing what it does
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // console.log(`Created data directory at ${DATA_DIR}`);
}

app.get('/get-logs/:quizName', (req, res) => {
  const logPath = path.join(logsDir, `${req.params.quizName}_logs.json`);
  
  try {
    if (fs.existsSync(logPath)) {
      const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      res.json(logs);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('[Server] Log retrieval failed:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

app.post('/delete-log', (req, res) => {
  const { quizName, sessionId } = req.body;
  const logPath = path.join(logsDir, `${quizName}_logs.json`);

  try {
    if (fs.existsSync(logPath)) {
      const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      delete logs[sessionId];
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('[Server] Log deletion failed:', error);
    res.status(500).json({ error: 'Log deletion failed' });
  }
});

// Log saving route
app.post('/save-log', (req, res) => {
  const { quizName, questionIndex, sessionId } = req.body;
  const logPath = path.join(logsDir, `${quizName}_logs.json`);
  // Skip invalid indices
  if (questionIndex === -1) return res.sendStatus(200);
  try {
    let allLogs = {};
    if (fs.existsSync(logPath)) {
      allLogs = JSON.parse(fs.readFileSync(logPath));
    }

    // Initialize session if missing
    if (!allLogs[sessionId]) {
      allLogs[sessionId] = {
        firstCorrect: [],
        timestamp: new Date().toISOString()
      };
    }

    // Append valid index
    if (!allLogs[sessionId].firstCorrect.includes(questionIndex)) {
      allLogs[sessionId].firstCorrect.push(questionIndex);
      const logPath = path.join(logsDir, `${quizName}_logs.json`);
      fs.writeFileSync(logPath, JSON.stringify(allLogs, null, 2));
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Server] Log save failed:', err);
    res.status(500).send('Server error');
  }
});

app.post('/prune-logs', async (req, res) => {
  try {
    const { quizName, maxCount } = req.body;
    const logPath = path.join(logsDir, `${quizName}_logs.json`); // Use logsDir variable

    // Read existing logs or default to empty object
    let logs = {};
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }

    // Convert to sorted array and prune
    const logArray = Object.entries(logs)
      .sort(([, a], [, b]) => new Date(b.timestamp) - new Date(a.timestamp));
    const pruned = logArray.slice(0, maxCount)
      .reduce((acc, [sessionId, data]) => {
        acc[sessionId] = data;
        return acc;
      }, {});

    // Save pruned logs
    fs.writeFileSync(logPath, JSON.stringify(pruned, null, 2));
    res.sendStatus(200);
  } catch (error) {
    console.error('[Server] Pruning error:', error);
    res.status(500).json({ error: 'Log pruning failed' });
  }
});

// Static files LAST
app.use(express.static(PUBLIC_DIR));

app.listen(port, () => console.log(`Listening on port ${port}`));

// Data directory creation
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hash(value) {
  // Handle both positive and negative numeric hashes from client
  if (typeof value === 'string' && value.match(/^-?\d+$/)) {
    return value; // Return as-is if already a numeric string
  }

  // Handle string hashing (should match client exactly)
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(); // Important: must return string to match client
}