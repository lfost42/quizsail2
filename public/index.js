let storageSessions = getStorageSessions();

const fadeOut = (element) => {
    // Enable the element's hidden attribute so that it can be targeted in CSS
    element.hidden = true;
    setTimeout(() => {
        element.remove();
    }, 500);    
}

// Dynamically load quiz menu by parsing the public folder for json files
async function loadQuizzes() {
  try {
    const quizSelect = document.getElementById('quiz');
    // Fetch list of quizzes from server
    const response = await fetch('/api/quizzes');
    if (!response.ok) throw new Error('Failed to load quizzes');
    const quizzes = await response.json();
    
    // Populate dropdown
    quizzes.forEach(quiz => {
      const option = document.createElement('option');
      option.value = quiz;
      option.textContent = quiz;
      quizSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading quizzes:', error);
  }
}

// Update the deleteSession function
const deleteSession = async (target) => {
  const confirm = window.confirm("Are you sure you want to delete this session?");
  if (confirm) {
      try {
          const url = target.dataset.url;
          // Extract sessionId correctly using URLSearchParams
          const sessionId = new URL(url).searchParams.get("session");
          const hashedSession = hash(sessionId);
          
          // Wait for server confirmation
          const response = await fetch(`/state/${hashedSession}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('Server deletion failed');

          // Update client state only after successful server deletion
          delete storageSessions[url];
          localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));
          fadeOut(target.parentElement);
          
          if (Object.keys(storageSessions).length === 0) {
              document.getElementById("resumeTitle")?.remove();
          }
      } catch (error) {
          console.error('Deletion error:', error);
          alert('Failed to delete session from server');
      }
  }
};

const deleteAllSessions = async () => {
  const confirm = window.confirm("Are you sure you want to delete all sessions?");
  if (!confirm) return;

  try {
    // Convert to array of promises with proper error handling
    const deletions = await Promise.allSettled(
      Object.keys(storageSessions).map(async url => {
        const sessionId = new URL(url).searchParams.get("session");
        const hashedSession = await hash(sessionId);
        await fetch(`/state/${hashedSession}`, { method: 'DELETE' });
      })
    );

    // Clear client storage after server deletions
    storageSessions = {};
    localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));

    // Update UI
    document.querySelectorAll('.savedSession').forEach(session => fadeOut(session));
    const resumeTitle = document.getElementById('resumeTitle');
    if (resumeTitle) resumeTitle.remove();

  } catch (error) {
    console.error('Error deleting sessions:', error);
  }
};

const renderSessions = () => {
  let links = "";
  
  const sortedSessions = Object.entries(storageSessions).sort((a, b) => {
      return Date.parse(b[1].lastAccess) - Date.parse(a[1].lastAccess);
  });
  for (let [url, { course, lastAccess }] of sortedSessions) {
      links += `
          <div class="savedSession block">
              <a href="${url}">
                  ${course}: ${lastAccess}</a> 
              <button data-url="${url}" class="deleteSession">Delete</button><br>
          </div>
      `;
  }
  if (links) {
      const html = `<p id="resumeTitle">Resume Session or <a href="#" class="deleteAllLink">[Delete All]</a>
          ${links}
      `;
      document.getElementById(SAVED_SESSIONS).innerHTML = html;
  }
}

const start = async () => {
  const src = document.getElementById('quiz').value;
  if (!src) {
    alert("⚠️ Please select a quiz! ⚠️ ");
    return;
  }
  try {
    const logResponse = await fetch(`/get-logs/${src}`);
    if (!logResponse.ok) throw new Error('Failed to fetch logs');
    const logs = await logResponse.json();

    if (Object.keys(logs).length >= 5) {
      const proceed = await showStartModal(logs, src); // Pass src here
      if (!proceed) return;
    }
  } catch (error) {
    console.error('Log check failed:', error);
    return; // Prevent redirect on error
  }

  // Get mode parameters after handling errors
  const mode = document.getElementById('reviewmode').checked ? 'review' : 
              document.getElementById('fastmode').checked ? 'fastmode' : 'default';
  const sessionId = crypto.randomUUID();

  // Do not delete! Prevents a race condition. 
  setTimeout(() => {
    window.location = `quiz-engine.html?src=${src}&mode=${mode}&session=${sessionId}`;
  }, 1);
};

// Add modal handler
const showStartModal = (sessions, quizName) => {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const sessionList = Object.entries(sessions).sort(([,a], [,b]) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    modalContent.innerHTML = `
      <p>Found ${sessionList.length} saved sessions. Please select an option below.</p>
      <button id="refresh-btn">Refresh Quiz</button>
      <button id="continue-btn">Continue to Quiz</button>
      <div id="sessions-list">
        ${sessionList.map(([id, session]) => `
          <div class="session-item">
            <div>
              ${new Date(session.timestamp).toLocaleString()}<br>
              Questions: ${session.firstCorrect.length}
            </div>
            <button class="delete-btn" data-session="${id}">Delete</button>
          </div>
        `).join('')}
      </div>
    `;

    // Fixed: Changed all 'content' references to 'modalContent'
    modalContent.querySelector('#continue-btn').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });

    modalContent.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await fetch('/delete-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quizName: quizName, // Now uses the parameter
              sessionId: btn.dataset.session
            })
          });
          btn.closest('.session-item').remove();
        } catch (error) {
          alert('Failed to delete log');
        }
      });
    });

    modalContent.querySelector('#refresh-btn').addEventListener('click', async () => {
      try {
        const response = await fetch('/refresh-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizName: quizName })
        });
        if (!response.ok) throw new Error('Refresh failed');
        modal.remove();
        window.location.reload();
      } catch (error) {
        console.error('Refresh failed:', error);
        alert('Refresh failed - using original version');
      }
    });

    // Removed non-existent cancel-btn handler
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  });
};

document.addEventListener("DOMContentLoaded", () => {
    renderSessions();
    loadQuizzes();
});

document.addEventListener("click", async ({ target }) => {
    if (!target) return;
    if (target.classList.contains("deleteAllLink")) {
      deleteAllSessions();
      return;
    }
    if (target.id === "startButton") {
        return start();
    }
    if (target.classList.contains("deleteSession")) {
      await deleteSession(target);
      return;
}});

function hash(value) {
  // Handle numeric strings (server compatibility)
  if (typeof value === 'string' && value.match(/^-?\d+$/)) {
    return value;
  }

  // Sync hash calculation (matches server exactly)
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(); // Return string to match server
}