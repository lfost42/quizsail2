// logger.js
const LOG_STORAGE_KEY = 'quizFirstTryLogs';

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Add this to logger.js
function initializeLogFile() {
  const sessionId = getParam('session');
  const quizName = getParam('src');

  if (!sessionId || !quizName) {
    console.warn('[Logger] Missing session ID or quiz name');
    return;
  }

  // Create initial log entry
  fetch('/save-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizName,
      questionIndex: -1,
      sessionId
    })
  }).then(() => {
    // console.log('[Logger] Log file initialized');
  }).catch(err => {
    console.error('[Logger] Log initialization failed:', err);
  });
}

// Expose saveLogToServer globally
window.saveLogToServer = async function(quizName, questionIndex) {
  const sessionId = getParam('session');
  if (!sessionId) {
    console.error('[Logger] No session ID');
    return;
  }

  try {
    // console.log('[Logger] Saving log:', { quizName, questionIndex, sessionId });
    const response = await fetch('/save-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizName, questionIndex, sessionId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // console.log('[Logger] Log saved successfully');
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



