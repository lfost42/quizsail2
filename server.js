const path = require('path');
const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// Configuration
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

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
const logsDir = path.join(PUBLIC_DIR, 'logs');
// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created data directory at ${DATA_DIR}`);
}

// Log saving route
app.post('/save-log', (req, res) => {
  const { quizName, questionIndex, sessionId } = req.body;
  const logFile = path.join(logsDir, `${quizName}_logs.json`);
  
  try {
      let allLogs = {};
      
      // Read existing logs if file exists
      if (fs.existsSync(logFile)) {
          allLogs = JSON.parse(fs.readFileSync(logFile));
      }

      // Initialize session array if it doesn't exist
      if (!allLogs[sessionId]) {
          allLogs[sessionId] = [];
      }

      // Add question index to session
      if (!allLogs[sessionId].includes(questionIndex)) {
          allLogs[sessionId].push(questionIndex);
      }

      // Limit to 100 most recent sessions
      const sessions = Object.keys(allLogs);
      if (sessions.length > 100) {
          // Sort sessions by most recent (assuming newer sessions have later timestamps)
          sessions.sort((a, b) => {
              const aTime = allLogs[a].timestamp || 0;
              const bTime = allLogs[b].timestamp || 0;
              return bTime - aTime;
          });
          
          // Keep only first 100 sessions
          sessions.slice(100).forEach(session => {
              delete allLogs[session];
          });
      }

      // Save to file
      fs.writeFileSync(logFile, JSON.stringify(allLogs, null, 2));
      res.sendStatus(200);
  } catch (err) {
      console.error('Log save error:', err);
      res.sendStatus(500);
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