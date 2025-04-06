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