const path = require('path');
const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// Configuration
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const logsDir = path.join(PUBLIC_DIR, 'logs');

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
const quizzesDir = path.join(PUBLIC_DIR, 'quizzes');
app.get('/api/quizzes', (req, res) => {
  fs.readdir(quizzesDir, (err, files) => {
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
  try {
    fs.unlinkSync(path.join(DATA_DIR, hashid));
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(404);
  }
});

// logs directory creation in case someone deletes it before knowing what it does
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // console.log(`Created data directory at ${DATA_DIR}`);
}

// Log saving route
app.post('/save-log', (req, res) => {
  const { quizName, questionIndex, sessionId } = req.body;

  // Skip invalid indices
  if (questionIndex === -1) return res.sendStatus(200);

  const logPath = path.join(logsDir, `${quizName}_logs.json`);

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
      fs.writeFileSync(logPath, JSON.stringify(allLogs, null, 2));
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Server] Log save failed:', err);
    res.status(500).send('Server error');
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