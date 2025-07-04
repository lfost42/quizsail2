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

const retiredDir = path.join(quizDir, 'retired');
if (!fs.existsSync(retiredDir)) {
    fs.mkdirSync(retiredDir, { recursive: true });
}

// Middleware
app.use(bodyParser.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});
app.options('*', (req, res) => res.sendStatus(200));


app.use((err, req, res, next) => {
  // console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
app.use((req, res, next) => {
  if (req.body) {
  }
  next();
});

/*---------------*/ 
/*  Refresh Quiz */
/*---------------*/ 
app.post('/refresh-quiz', async (req, res) => {
  const { quizName } = req.body;
  const quizDir = path.join(PUBLIC_DIR, 'quizzes');
  const logsDir = path.join(PUBLIC_DIR, 'logs');
  const retiredDir = path.join(quizDir, 'retired');
  let originalPath, retiredPath, newPath;

  try {
      // 1. Validate original file first
      originalPath = path.join(quizDir, `${quizName}.json`);
      const logPath = path.join(logsDir, `${quizName}_logs.json`);

      if (!fs.existsSync(originalPath)) {
          return res.status(404).json({ error: 'Quiz not found' });
      }

      // 2. Create backup copy instead of moving immediately
      const backupPath = path.join(retiredDir, `${quizName}.json`);
      fs.copyFileSync(originalPath, backupPath);

      // 3. Load quiz content
      const quizContent = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
      let frequentQuestions = new Set();
      
      if (fs.existsSync(logPath)) {
        const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        const sessions = Object.values(logs)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 5);
  
        // 4. Identify questions to remove (answered correctly ≥3 times)
        const questionCounts = {};

        sessions.forEach(session => {
          session.firstCorrect.forEach(index => {
            questionCounts[index] = (questionCounts[index] || 0) + 1;
          });
        });

        // Populate frequentQuestions with indices meeting the condition
        Object.entries(questionCounts).forEach(([index, count]) => {
          if (count >= 3) {
            frequentQuestions.add(parseInt(index));
          }
        });
      }

      // 5. Filter content
      const filteredContent = quizContent.filter((_, index) => 
        !frequentQuestions.has(index)
      );
      newPath = path.join(quizDir, `${quizName}_new.json`);
      fs.writeFileSync(newPath, JSON.stringify(filteredContent));

      // 6. Delete original only after successful creation
      fs.unlinkSync(originalPath);

      res.json({
          newFileName: path.basename(newPath),
          removedQuestions: quizContent.length - filteredContent.length,
          message: `Removed ${quizContent.length - filteredContent.length} questions`
      });

  } catch (error) { // Added catch block
      // console.error('Refresh error:', error);
      // Cleanup failed files
      try {
          if (newPath && fs.existsSync(newPath)) fs.unlinkSync(newPath);
          if (backupPath && fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      } catch (cleanupError) {
          // console.error('Cleanup failed:', cleanupError);
      }

      res.status(500).json({ 
          error: 'Refresh failed',
          originalFilePreserved: true
      });
  }
});


/*---------------*/ 
/*  Get Quizzes  */
/*----------------*/ 
app.get('/api/quizzes', (req, res) => {
  fs.readdir(quizDir, (err, files) => {
    if (err) {
      console.error('Quiz directory error:', err);
      return res.status(500).send('Server error');
    }
    const quizzes = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    res.json(quizzes);
  });
});

/*-----------------------*/ 
/*  Get Retired Quizzes  */
/*-----------------------*/ 
app.get('/api/retired-quizzes', (req, res) => {
  fs.readdir(retiredDir, (err, files) => {
    if (err) return res.status(500).send('Server error');
    const quizzes = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    res.json(quizzes);
  });
});


/*---------------*/ 
/*  Retire Quiz  */
/*----------------*/ 
app.post('/retire-quiz', (req, res) => {
  const { quizName } = req.body;
  if (!quizName) return res.status(400).json({ error: 'Missing quiz name' });

  const sourcePath = path.join(quizDir, `${quizName}.json`);
  const destPath = path.join(retiredDir, `${quizName}.json`);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, destPath);
      return res.json({ success: true });
    }
    return res.status(404).json({ error: 'Quiz not found' });
  } catch (error) {
    console.error('Retire error:', error);
    return res.status(500).json({ error: 'Failed to retire quiz' });
  }
});

/*----------------*/ 
/*  Restore Quiz  */
/*-----------------*/ 
app.post('/restore-quiz', (req, res) => {
  const { quizName } = req.body;
  if (!quizName) return res.status(400).json({ error: 'Missing quiz name' });

  const sourcePath = path.join(retiredDir, `${quizName}.json`);
  const destPath = path.join(quizDir, `${quizName}.json`);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, destPath);
      return res.json({ success: true });
    }
    return res.status(404).json({ error: 'Quiz not found in retired' });
  } catch (error) {
    console.error('Restore error:', error);
    return res.status(500).json({ error: 'Failed to restore quiz' });
  }
});

/*---------------*/
/*  Delete Quiz  */
/*---------------*/
app.post('/delete-quiz', (req, res) => {
  const { quizName } = req.body;
  if (!quizName) return res.status(400).json({ error: 'Missing quiz name' });

  const retiredPath = path.join(retiredDir, `${quizName}.json`);
  const activePath = path.join(quizDir, `${quizName}.json`);
  
  try {
    // First try active directory
    if (fs.existsSync(activePath)) {
      fs.unlinkSync(activePath);
      return res.json({ success: true });
    }
    
    // Then try retired directory
    if (fs.existsSync(retiredPath)) {
      fs.unlinkSync(retiredPath);
      return res.json({ success: true });
    }

    // If not found in either
    return res.status(404).json({ error: 'Quiz not found' });
  } catch (error) {
    console.error('Deletion error:', error);
    return res.status(500).json({ error: 'Failed to delete quiz' });
  }
});


/*-------------*/ 
/*  Get State  */
/*--------------*/ 
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
    // console.error('State read error:', e);
    res.status(500).send('Invalid state format');
  }
});

/*-------------*/ 
/*  Post State */
/*--------------*/ 
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
    // console.error('Save failed:', e);
    res.status(500).send('Save failed');
  }
});


/*----------------*/ 
/*  Delete State  */
/*-----------------*/ 
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
      // console.error('Deletion error:', e);
      res.status(500).send('Server error during deletion');
    }
  }
});

// Directory creation in case someone deletes it before knowing what it does
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/*-------------------*/ 
/*  Get Logger Logs  */
/*-------------------*/ 
app.get('/get-logs/:quizName', (req, res) => {
  const quizName = req.params.quizName;
  if (!quizName) {
    return res.status(400).json({ error: 'Missing quiz name' });
  }

  const logPath = path.join(logsDir, `${quizName}_logs.json`);
  
  try {
    if (fs.existsSync(logPath)) {
      const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      // Filter out future timestamps
      const validLogs = Object.fromEntries(
        Object.entries(logs).filter(([id, session]) => 
          new Date(session.timestamp) <= new Date()
        )
      );
      res.json(validLogs);
    } else {
      res.status(404).json({}); // Send empty response if no logs exist
    }
  } catch (error) {
    console.error('[Server] Log retrieval failed:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

/*----------------------*/ 
/*  Delete Logger Logs  */
/*----------------------*/ 
app.post('/delete-log', (req, res) => {
  const { quizName, sessionId } = req.body;
  const logPath = path.join(logsDir, `${quizName}_logs.json`);

  try {
    if (fs.existsSync(logPath)) {
      const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      delete logs[sessionId];
      fs.writeFileSync(logPath, JSON.stringify(logs));
    }
    res.sendStatus(200);
  } catch (error) {
    // console.error('[Server] Log deletion failed:', error);
    res.status(500).json({ error: 'Log deletion failed' });
  }
});

/*--------------------*/ 
/*  Save Logger Logs  */
/*--------------------*/ 
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
      fs.writeFileSync(logPath, JSON.stringify(allLogs));
    }

    res.sendStatus(200);
    } catch (err) {
      console.error('[SERVER] Log save failed:', err);
      console.error('[SERVER] Error details:', {
        body: req.body,
        stack: err.stack
      });
      res.status(500).send('Server error');
    }
});

/*-------------------*/ 
/*  Save Debug Logs  */
/*-------------------*/ 
app.post('/save-debuglogs', (req, res) => {
  const { quizName, questionIndex, sessionId, correct, attemptNumber } = req.body;
  const logPath = path.join(logsDir, `${quizName}_debuglogs.json`);

  // Skip invalid indices or initialization calls
  if (questionIndex === -1) return res.sendStatus(200);

  try {
    let allLogs = {};
    if (fs.existsSync(logPath)) {
      allLogs = JSON.parse(fs.readFileSync(logPath));
    }

    // Initialize session if missing
    if (!allLogs[sessionId]) {
      allLogs[sessionId] = {
        attempts: [], // Array to store all attempts
        firstCorrect: [], // Optional: retain if needed
        timestamp: new Date().toISOString()
      };
    }

    // Log every attempt
    allLogs[sessionId].attempts.push({
      questionIndex,
      correct,
      attemptNumber,
      timestamp: new Date().toISOString()
    });

    // Update firstCorrect only on first correct attempt
    if (correct && !allLogs[sessionId].firstCorrect.includes(questionIndex)) {
      allLogs[sessionId].firstCorrect.push(questionIndex);
    }

    // Save to file
    fs.writeFileSync(logPath, JSON.stringify(allLogs));
    res.sendStatus(200);
  } catch (err) {
    // console.error('[Server] Log save failed:', err);
    res.status(500).send('Server error');
  }
});

/*-------------*/ 
/* Log Flagged */
/*--------------*/ 
app.post('/log-flagged', (req, res) => {
  const { quizName, sessionId, data } = req.body;
  const logPath = path.join(logsDir, `${quizName}_${sessionId}_flagged.json`);

  try {
    fs.writeFileSync(logPath, JSON.stringify(data, null, 2));
    res.sendStatus(200);
  } catch (error) {
    // console.error('Flagged log error:', error);
    res.status(500).json({ error: 'Failed to save flagged log' });
  }
});

/*---------------------*/ 
/* Delete Flagged logs */
/*---------------------*/ 
app.post('/delete-flagged-log', (req, res) => {
  const { quizName, sessionId } = req.body;
  if (!quizName || !sessionId) return res.status(400).send('Missing parameters');
  
  const logPath = path.join(logsDir, `${quizName}_${sessionId}_flagged.json`);
  
  try {
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
    res.sendStatus(200);
  } catch (error) {
    // console.error('Flagged log deletion failed:', error);
    res.status(500).json({ error: 'Failed to delete flagged log' });
  }
});

/*------------------------*/ 
/*  Get Flagged Questions  */
/*-------------------------*/ 
app.get('/get-flagged/:quizName/:sessionId', (req, res) => {
  const { quizName, sessionId } = req.params;
  if (!req.params.quizName || !req.params.sessionId) {
    console.error('[SERVER] Missing parameters in get-flagged');
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const logPath = path.join(logsDir, `${quizName}_${sessionId}_flagged.json`);

  try {
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    
    // Add validation
    if (!Array.isArray(data)) {
      console.error('[SERVER] Invalid data format - not an array');
      return res.status(500).json({ 
        error: 'Invalid data format',
        receivedType: typeof data
      });
    }

    // Add content validation
    const invalidEntries = data.filter(item => 
      !('index' in item) || 
      !('incorrectTries' in item) ||
      typeof item.index !== 'number' ||
      typeof item.incorrectTries !== 'number'
    );

    if (invalidEntries.length > 0) {
      console.error('[SERVER] Invalid flagged entries:', invalidEntries);
      return res.status(500).json({
        error: 'Corrupted flagged data',
        invalidCount: invalidEntries.length
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Flagged error:', error);
    res.header('Access-Control-Allow-Origin', '*'); // Ensure CORS headers
    res.status(500).json([]);
    res.status(500).json([]);
  }
});

/*----------------*/ 
/*  Edit Quiz     */
/*----------------*/ 
app.post('/edit-quiz', (req, res) => {
  const { quizName, content } = req.body;
  if (!validateQuizStructure(content)) {
    return res.status(400).json({ error: 'Invalid quiz structure' });
  }

  if (!quizName || !content) {
    return res.status(400).json({ error: 'Missing quiz name or content' });
  }

  // Security checks
  if (quizName.includes('..') || quizName.includes('/')) {
    return res.status(400).json({ error: 'Invalid quiz name' });
  }

  // Check both active and retired directories
  const activePath = path.join(quizDir, `${quizName}.json`);
  const retiredPath = path.join(retiredDir, `${quizName}.json`);
  
  let savePath;
  if (fs.existsSync(activePath)) {
    savePath = activePath;
  } else if (fs.existsSync(retiredPath)) {
    savePath = retiredPath;
  } else {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  try {
    // Validate content format
    if (!Array.isArray(content)) {
      return res.status(400).json({ error: 'Invalid quiz format' });
    }
    
    fs.writeFileSync(savePath, JSON.stringify(content, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save quiz' });
  }
});

/*-----------------*/ 
/*  Generate Quiz  */
/*-----------------*/ 
app.post('/generate-quiz', async (req, res) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  let newPath; 
  const { sourceQuiz, category, flaggedQuestions, suffix } = req.body;

  // Validate all parameters
  if (!req.body.sourceQuiz || !req.body.category || !req.body.flaggedQuestions || !req.body.suffix) {
    console.error('[Server] Missing parameters. Received:', Object.keys(req.body));
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sourcePath = path.join(quizDir, `${sourceQuiz}.json`);
  if (!fs.existsSync(sourcePath)) {
    return res.status(404).json({ error: 'Source quiz not found' });
  }

  let sourceContent;
  try {
    sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (readError) {
    return res.status(500).json({ error: 'Failed to read source quiz' });
  }

  let filteredQuestions = [];
  if (category[0] === '0') {
    const questionMap = new Map();
    
    // First pass: create map of original questions
    sourceContent.forEach((question, index) => {
      questionMap.set(index, question);
    });

    // Second pass: create new questions with unique indices
    let newIndex = 0;
    flaggedQuestions.forEach(fq => {
      const originalQuestion = questionMap.get(fq.index);
      if (originalQuestion) {
        // Create a new question object with a unique index
        const newQuestion = JSON.parse(JSON.stringify(originalQuestion));
        newQuestion.originalIndex = fq.index; // Keep track of original index
        newQuestion.incorrectTries = fq.incorrectTries; // Store incorrect tries
        filteredQuestions.push(newQuestion);
        newIndex++;
      }
    });
  } else if (category[0] === 'a') {
    filteredQuestions = sourceContent.filter((_, index) => 
      flaggedQuestions.some(fq => 
        fq.index === index && 
        fq.incorrectTries > 0
      )
    );
    const questionMap = new Map();
    
    // First pass: create map of original questions
    sourceContent.forEach((question, index) => {
      questionMap.set(index, question);
    });

    // Second pass: create new questions with unique indices
    let newIndex = 0;
    flaggedQuestions.forEach(fq => {
      const originalQuestion = questionMap.get(fq.index);
      if (originalQuestion) {
        // Create a new question object with a unique index
        const newQuestion = JSON.parse(JSON.stringify(originalQuestion));
        newQuestion.originalIndex = fq.index; // Keep track of original index
        newQuestion.incorrectTries = fq.incorrectTries; // Store incorrect tries
        filteredQuestions.push(newQuestion);
        newIndex++;
      }
    });
  } else {
    // Original behavior for specific categories
    filteredQuestions = sourceContent.filter((_, index) => {
      return flaggedQuestions.some(fq => {
        if (
          fq.index >= sourceContent.length || 
          fq.index < 0 ||
          typeof fq.incorrectTries !== 'number' ||
          fq.incorrectTries < 0
        ) {
          return false;
        }
        return fq.index === index && 
          category.includes(getAttemptCategory(fq.incorrectTries));
      });
    });
  }

  if (filteredQuestions.length === 0) {
    return res.status(400).json({ 
      error: 'No questions matched filters',
      debugInfo: {
        sourceLength: sourceContent.length,
        receivedFlags: flaggedQuestions.length,
        categories: category
      }
    });
  }

  try {
    const baseName = `${sourceQuiz}_${suffix}-${filteredQuestions.length}`;
    // console.log('[SERVER] Generating quiz:', baseName, 'with', filteredQuestions.length, 'questions');
    const newQuizName = `${getUniqueName(baseName, quizDir)}`;
    const newPath = path.join(quizDir, `${newQuizName}.json`);

    if (!fs.existsSync(quizDir)) {
      fs.mkdirSync(quizDir, { recursive: true });
    }

    fs.writeFileSync(newPath, JSON.stringify(filteredQuestions, null, 2));

    res.json({ 
      success: true,
      newQuiz: newQuizName,
      questionCount: filteredQuestions.length,
    });

  } catch (error) {
    if (newPath && fs.existsSync(newPath)) {
      try {
        fs.unlinkSync(newPath);
      } catch (cleanupError) {
        console.error('[SERVER] Cleanup failed:', cleanupError);
      }
    }

    res.status(500).json({ 
      error: 'Quiz generation failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


/*-------------*/ 
/*  Prune logs */
/*-------------*/ 
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
    fs.writeFileSync(logPath, JSON.stringify(pruned));
    res.sendStatus(200);
  } catch (error) {
    // console.error('[Server] Pruning error:', error);
    res.status(500).json({ error: 'Log pruning failed' });
  }
});


/*-----------*/ 
/*  Get logs */
/*-----------*/ 
app.get('/api/logs', (req, res) => {
  fs.readdir(logsDir, (err, files) => {
    if (err) return res.status(500).send('Server error');
    res.json(files.filter(f => f.endsWith('.json')));
  });
});

/*------------------*/ 
/*  Delete log file */
/*------------------*/ 
app.delete('/delete-log-file', (req, res) => {
  const { fileName } = req.body;
  const filePath = path.join(logsDir, fileName);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.sendStatus(200);
    } else {
      res.status(404).send('File not found');
    }
  } catch (error) {
    res.status(500).send('Deletion failed');
  }
});

/*------------------*/ 
/*  Delete all logs */
/*------------------*/ 
app.delete('/delete-all-logs', (req, res) => {
  try {
    fs.readdirSync(logsDir).forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(logsDir, file));
      }
    });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send('Deletion failed');
  }
});

// Static files
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

function getAttemptCategory(attempts) {
  if (attempts === 0) return '0'; // New category for all questions
  if (attempts >= 4) return '4+';
  if (attempts === 3) return '3';
  if (attempts === 2) return '2';
  return '1';
}

// For use with getUniqueName function
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get Unique Name
function getUniqueName(baseName, dir) {
  const basePattern = new RegExp(`^${escapeRegExp(baseName)}([a-z]+)\\.json$`); // appends and then increments letter per version found in folder
  const existing = fs.readdirSync(dir)
    .filter(file => file.match(basePattern))
    .map(file => file.match(basePattern)[1]);

  // Find highest existing letter code
  const maxChar = existing.reduce((max, code) => {
    const current = code.charCodeAt(0);
    return current > max ? current : max;
  }, 96); // Start at 96 ('a' - 1)

  // Start with 'a' if no existing files, else next character
  const nextChar = maxChar === 96 ? 'a' : String.fromCharCode(maxChar + 1);
  return `${baseName}${nextChar}`;
}

// Update number_to_suffix()
function number_to_suffix(num) {
  if (num <= 0) return '';
  return String.fromCharCode(97 + (num % 26)); // 0→a, 1→b, etc
}

function validateQuizStructure(content) {
  return Array.isArray(content) && content.every(question => 
    typeof question === 'object' &&
    typeof question.q === 'string' &&
    Array.isArray(question.c) &&
    Array.isArray(question.a)
  );
}
