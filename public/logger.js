const LOG_STORAGE_KEY = 'quizFirstTryLogs';

async function saveLogToServer(quizName, questionIndex) {
  const sessionId = getParam('session');
  
  try {
      const response = await fetch('/save-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              quizName,
              questionIndex,
              sessionId
          })
      });
      
      if (!response.ok) throw new Error('Server error');
      // console.log('📁 Log saved to server');
  } catch (err) {
      console.error('Failed to save log:', err);
      // Fallback to localStorage
      const logs = JSON.parse(localStorage.getItem(quizName + '_logs') || {});
      if (!logs[sessionId]) logs[sessionId] = [];
      if (!logs[sessionId].includes(questionIndex)) {
          logs[sessionId].push(questionIndex);
      }
      localStorage.setItem(quizName + '_logs', JSON.stringify(logs));
  }
}

function installAnswerMonitor() {
    if (!window.submitAnswer || !window.cur) return false;

    const originalSubmit = window.submitAnswer;
    window.submitAnswer = function() {
        const result = originalSubmit.apply(this, arguments);
        const current = window.cur();
        
        if (current?.ref?.tries === 1 && current?.ref?.count > 0) {
            saveLogToServer(
                getParam('src'),
                current.ref.index
            );
        }
        
        return result;
    };
    return true;
}

// Initialize
if (document.readyState === 'complete') {
    installAnswerMonitor();
} else {
    document.addEventListener('DOMContentLoaded', installAnswerMonitor);
}