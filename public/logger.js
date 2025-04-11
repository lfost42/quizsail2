// Logs successful first attempts in each session. 
const MAX_LOG_COUNT = 10;

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function pruneOldLogs(quizName) {
  try {
    await fetch('/prune-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        quizName,
        maxCount: MAX_LOG_COUNT 
      })
    });
  } catch (error) {
    console.error('[Logger] Pruning failed:', error);
  }
}

// Modified initializeLogFile
function initializeLogFile() {
  const sessionId = getParam('session');
  const quizName = getParam('src');

  if (!sessionId || !quizName) {
    console.warn('[Logger] Missing session ID or quiz name');
    return;
  }

  // Create initial log entry with timestamp
  fetch('/save-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizName,
      questionIndex: -1,
      sessionId,
      timestamp: new Date().toISOString()
    })
  }).then(() => {
    pruneOldLogs(quizName); // Trigger pruning after initialization
  }).catch(err => {
    console.error('[Logger] Log initialization failed:', err);
  });
}

// Modified saveLogToServer
window.saveLogToServer = async function(quizName, questionIndex) {
  const sessionId = getParam('session');
  if (!sessionId) {
    console.error('[Logger] No session ID');
    return;
  }

  try {
    const response = await fetch('/save-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        quizName, 
        questionIndex,
        sessionId,
        timestamp: new Date().toISOString() // Add timestamp to all entries
      })
    });
    
    // Prune after final question submission
    if(questionIndex === -1) {
      await pruneOldLogs(quizName);
    }
  } catch (err) {
    console.error('[Logger] Save failed:', err);
  }
};

// Update installAnswerMonitor to ensure proper initialization
function installAnswerMonitor() {
  if (!window.submitAnswer) {
    console.warn('[Logger] submitAnswer not found, retrying...');
    setTimeout(installAnswerMonitor, 500);
    return;
  }

  const originalSubmit = window.submitAnswer;
  window.submitAnswer = function() {
    // console.log('[Logger] Answer submission intercepted');
    const currentBefore = window.cur?.();
    const result = originalSubmit.apply(this, arguments);
    
    if (currentBefore?.ref?.firstAttemptCorrect === null) {
      // console.log('[Logger] First attempt detected');
    }
    return result;
  };
}

// Initialize after quiz.js loads
if (document.readyState === 'complete') {
  initializeLogFile();
  installAnswerMonitor();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    initializeLogFile();
    installAnswerMonitor();
  });
}



