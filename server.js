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
app.get('/api/quizzes', (req, res) => {
  fs.readdir(PUBLIC_DIR, (err, files) => {
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
  const statePath = path.join(DATA_DIR, hashid);
  
  if (!fs.existsSync(statePath)) {
      return res.status(404).send('Not found');
  }
  
  try {
      const data = fs.readFileSync(statePath);
      res.send(JSON.parse(data));
  } catch (e) {
      res.status(500).send('Invalid state format');
  }
});

app.post("/state/:id", (req, res) => {
  const hashid = hash(req.params.id);
  fs.writeFileSync(path.join(DATA_DIR, hashid), JSON.stringify(req.body));
  res.sendStatus(200);
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
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
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

// Data directory creation
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.listen(port, () => console.log(`Listening on port ${port}`));

// Utility functions
function hash(value) {
  // Match client-side localhost hashing
  if (value.match(/^-?\d+$/)) {
    return value; // Use numeric hash directly
  }
}