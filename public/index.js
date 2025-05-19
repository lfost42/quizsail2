let storageSessions = getStorageSessions();

const fadeOut = (element) => {
    element.hidden = true;
    setTimeout(() => {
        element.remove();
    }, 500);    
}

const createIsolatedModal = (title, content) => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.innerHTML = `
    <h2>${title}</h2>
    <p>${content}</p>
    <button class="close-modal"> × </button>
  `;

  const closeBtn = modalContent.querySelector('.close-modal');
  closeBtn.addEventListener('click', () => modal.remove());

  modal.appendChild(modalContent);
  document.body.appendChild(modal);
};

const showCurrentModal = () => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.innerHTML = `
  <div class="modal-header">
    <h2>Active Quiz Files</h2>
    <button class="close-modal">&times;</button>
  </div>
  <div class="mode-selection">
    <div class="mode-header">
      <span>Mode: <span id="selectedMode">Standard</span></span>
      <span class="caret">⌄</span>
    </div>
    <div class="mode-options" hidden>
      <label><input type="radio" name="modalMode" value="default" checked> Standard</label>
      <label><input type="radio" name="modalMode" value="fastmode"> Fast</label>
      <label><input type="radio" name="modalMode" value="review"> Review</label>
    </div>
  </div>
  <div class="modal-body" id="currentQuizzesList">
    <div class="loading">Loading quizzes...</div>
  </div>
  <div class="modal-footer">
    <button id="startSelectedQuiz" disabled>Start Quiz</button>
    <button id="retireButton" disabled>Retire Quiz</button>
  </div>
`;

  let selectedQuiz = null;

  // Collapsible mode handler
  const modeHeader = modalContent.querySelector('.mode-header');
  const modeOptions = modalContent.querySelector('.mode-options');
  const caret = modalContent.querySelector('.caret');
  const selectedMode = modalContent.querySelector('#selectedMode');

  // Toggle visibility
  modeHeader.addEventListener('click', () => {
    const isHidden = modeOptions.hidden;
    modeOptions.hidden = !isHidden;
    caret.classList.toggle('expanded', isHidden);
  });

  // Update display when mode changes
  modalContent.querySelectorAll('input[name="modalMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      selectedMode.textContent = e.target.parentElement.textContent.trim();
      modeOptions.hidden = true; // Auto-close after selection
      caret.classList.remove('expanded');
    });
  });

  // Load current quizzes
  fetch('/api/quizzes')
    .then(res => res.json())
    .then(quizzes => {
      const list = modalContent.querySelector('#currentQuizzesList');
      // Get last accessed session
      const sessions = Object.values(storageSessions);
      const lastSession = sessions.sort((a, b) => 
        Date.parse(b.lastAccess) - Date.parse(a.lastAccess)
      )[0];

      // Determine default mode from last session's URL or default to 'fastmode'
      let defaultMode = 'fastmode';
      if (lastSession) {
          const urlParts = lastSession.url.split('?');
          if (urlParts.length > 1) {
              const params = new URLSearchParams(urlParts[1]);
              const modeParam = params.get('mode');
              if (modeParam) defaultMode = modeParam;
          }
      }

      // Update the radio button and selected mode display
      const modeRadios = modalContent.querySelectorAll('input[name="modalMode"]');
      modeRadios.forEach(radio => {
          if (radio.value === defaultMode) radio.checked = true;
      });

      // Update the selected mode text label
      const modeLabels = {
          default: 'Standard',
          fastmode: 'Fast',
          review: 'Review'
      };
      selectedMode.textContent = modeLabels[defaultMode] || 'Standard';
      
      // Determine default selection
      const lastQuiz = lastSession?.course;
      const defaultQuiz = lastQuiz || (quizzes.length > 0 ? quizzes[0] : null);

      list.innerHTML = quizzes.length > 0 
        ? quizzes.map(quiz => `
            <label class="quiz-item">
              <input type="radio" name="currentQuiz" value="${quiz}" 
                ${quiz === defaultQuiz ? 'checked' : ''}>
              ${quiz}
            </label>
          `).join('')
        : '<p>No quizzes available</p>';
      
      if (quizzes.length > 0) {
        // Auto-enable buttons if default exists
        if (defaultQuiz) {
          selectedQuiz = defaultQuiz;
          modalContent.querySelector('#startSelectedQuiz').disabled = false;
          modalContent.querySelector('#retireButton').disabled = false;
        }

        list.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            selectedQuiz = e.target.value;
            modalContent.querySelector('#startSelectedQuiz').disabled = false;
            modalContent.querySelector('#retireButton').disabled = false;
          });
        });
      }
    })
    .catch(error => {
      console.error('Failed to load quizzes:', error);
      list.innerHTML = '<p>Error loading quizzes</p>';
    });

  // Handle Start
  modalContent.querySelector('#startSelectedQuiz').addEventListener('click', () => {
    if (!selectedQuiz) return;
    
    const quizSelect = document.getElementById('quiz');
    quizSelect.value = selectedQuiz;
    
    // Get selected mode from modal
    const mode = modalContent.querySelector('input[name="modalMode"]:checked').value;
    
    modal.remove();
    
    // Start with selected mode
    const sessionId = crypto.randomUUID();
    setTimeout(() => {
      startQuizWithValidation(selectedQuiz, mode, sessionId);
    }, 1);
  });

  // Handle Retire
  modalContent.querySelector('#retireButton').addEventListener('click', () => {
    if (!selectedQuiz) return;

    fetch('/retire-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizName: selectedQuiz })
    })
    .then(res => {
      if (!res.ok) throw new Error('Retire failed');
      return fetch('/api/quizzes');
    })
    .then(res => res.json())
    .then(quizzes => {
      const list = modalContent.querySelector('#currentQuizzesList');
      list.innerHTML = quizzes.length > 0 
        ? quizzes.map(quiz => `
            <label class="quiz-item">
              <input type="radio" name="currentQuiz" value="${quiz}">
              ${quiz}
            </label>
          `).join('')
        : '<p>No quizzes available</p>';
      
      // Reset selection and disable buttons
      selectedQuiz = null;
      modalContent.querySelector('#startSelectedQuiz').disabled = true;
      modalContent.querySelector('#retireButton').disabled = true;

      // Reattach event listeners to new radio buttons
      list.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          selectedQuiz = e.target.value;
          modalContent.querySelector('#startSelectedQuiz').disabled = false;
          modalContent.querySelector('#retireButton').disabled = false;
        });
      });

      alert('Quiz retired successfully!');
    })
    .catch(error => {
      console.error('Retire error:', error);
      alert('Failed to retire quiz');
    });
  });
  // Close handling
  modalContent.querySelector('.close-modal').addEventListener('click', () => modal.remove());
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
};

const showRetiredModal = () => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.innerHTML = `
    <div class="modal-header">
      <h2>Retired Quizzes</h2>
      <button class="close-modal">&times;</button>
    </div>
    <div class="modal-body" id="retiredQuizzesList">
      <div class="loading">Loading retired quizzes...</div>
    </div>
    <div class="modal-footer">
      <button id="restoreButton" disabled>Restore Quiz</button>
      <button id="deleteButton" disabled>Delete Quiz</button>
    </div>
  `;

  let selectedQuiz = null;

  // Load retired quizzes
  fetch('/api/retired-quizzes')
    .then(res => res.json())
    .then(quizzes => {
      const list = modalContent.querySelector('#retiredQuizzesList');
      list.innerHTML = quizzes.length > 0 
        ? quizzes.map(quiz => `
            <label class="quiz-item">
              <input type="radio" name="retiredQuiz" value="${quiz}">
              ${quiz}
            </label>
          `).join('')
        : '<p>No retired quizzes found</p>';
      
      if (quizzes.length > 0) {
        list.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            selectedQuiz = e.target.value;
            modalContent.querySelector('#restoreButton').disabled = false;
            modalContent.querySelector('#deleteButton').disabled = false;
          });
        });
      }
    })
    .catch(error => {
      console.error('Failed to load retired quizzes:', error);
      modalContent.querySelector('#retiredQuizzesList').innerHTML = 
        '<p>Error loading retired quizzes</p>';
    });

  // Handle restore
  modalContent.querySelector('#restoreButton').addEventListener('click', () => {
    if (!selectedQuiz) return;

    fetch('/restore-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizName: selectedQuiz })
    })
    .then(res => {
      if (!res.ok) throw new Error('Restore failed');
      // Refresh the list instead of closing modal
      return fetch('/api/retired-quizzes');
    })
    .then(res => res.json())
    .then(quizzes => {
      const list = modalContent.querySelector('#retiredQuizzesList');
      list.innerHTML = quizzes.length > 0 
        ? quizzes.map(quiz => `
            <label class="quiz-item">
              <input type="radio" name="retiredQuiz" value="${quiz}">
              ${quiz}
            </label>
          `).join('')
        : '<p>No retired quizzes found</p>';

      // Reset selection state
      selectedQuiz = null;
      modalContent.querySelector('#restoreButton').disabled = true;
      
      // Reattach event listeners to new radio buttons
      list.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          selectedQuiz = e.target.value;
          modalContent.querySelector('#restoreButton').disabled = false;
        });
      });
      
      alert('Quiz restored successfully!');
    })
    .catch(error => {
      console.error('Restore error:', error);
      alert('Failed to restore quiz');
    });
  });

  // Handle delete
  modalContent.querySelector('#deleteButton').addEventListener('click', () => {
    if (!selectedQuiz) return;
    
    const confirmDelete = confirm(`⚠️ WARNING ⚠️ \n This action cannot be oneone! \n\n Confirm permanent deletion for "${selectedQuiz}".`);
    if (!confirmDelete) return;

    fetch('/delete-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizName: selectedQuiz })
    })
    .then(res => {
      if (!res.ok) throw new Error('Deletion failed');
      return fetch('/api/retired-quizzes');
    })
    .then(res => res.json())
    .then(quizzes => {
      const list = modalContent.querySelector('#retiredQuizzesList');
      list.innerHTML = quizzes.length > 0 
        ? quizzes.map(quiz => `
            <label class="quiz-item">
              <input type="radio" name="retiredQuiz" value="${quiz}">
              ${quiz}
            </label>
          `).join('')
        : '<p>No retired quizzes found</p>';
      
      selectedQuiz = null;
      modalContent.querySelector('#restoreButton').disabled = true;
      modalContent.querySelector('#deleteButton').disabled = true;
      
      list.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          selectedQuiz = e.target.value;
          modalContent.querySelector('#restoreButton').disabled = false;
          modalContent.querySelector('#deleteButton').disabled = false;
        });
      });
    })
    .catch(error => {
      console.error('Delete error:', error);
      alert('Failed to delete quiz');
    });
  });

  // Close handling
  modalContent.querySelector('.close-modal').addEventListener('click', () => modal.remove());
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
};

document.addEventListener("click", ({ target }) => {
  if (target.id === "currentButton") showCurrentModal();
  if (target.id === "retiredButton") showRetiredModal();
});


// Dynamically load quiz menu by parsing the public folder for json files
async function loadQuizzes() {
  try {
    const quizSelect = document.getElementById('quiz');
    // Fetch list of quizzes from server
    const response = await fetch(`/api/quizzes?t=${Date.now()}`);
    // if (!response.ok) throw new Error('Failed to load quizzes');
    const quizzes = await response.json();
    
    // Populate dropdown
    quizzes.forEach(quiz => {
      const option = document.createElement('option');
      option.value = quiz;
      option.textContent = quiz;
      quizSelect.appendChild(option);
    });
  } catch (error) {
    // console.error('Error loading quizzes:', error);
  }
  return;
}

// DeleteSession function
const deleteSession = async (target) => {
  const confirm = window.confirm("Are you sure you want to delete this session?");
  if (confirm) {
      try {
          const url = target.dataset.url;
          const sessionId = new URL(url).searchParams.get("session");
          const quizName = storageSessions[url]?.course; // Get quiz name from storage

          // Delete session state
          const hashedSession = hash(sessionId);
          const response = await fetch(`/state/${hashedSession}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('Server deletion failed');

          // Delete flagged log
          await fetch('/delete-flagged-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quizName, sessionId })
          });

          // Update client state
          delete storageSessions[url];
          localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));
          fadeOut(target.parentElement);

          if (Object.keys(storageSessions).length === 0) {
              document.getElementById("resumeTitle")?.remove();
          }
      } catch (error) {
          console.error('Deletion error:', error);
          alert('Failed to delete session');
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
        const quizName = storageSessions[url]?.course;
        const hashedSession = hash(sessionId);

        // Delete session state
        await fetch(`/state/${hashedSession}`, { method: 'DELETE' });
        
        // Delete flagged log
        await fetch('/delete-flagged-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizName, sessionId })
        });
      })
    );

    // Check for failures
    const failedDeletions = deletions.filter(result => result.status === 'rejected');
    if (failedDeletions.length > 0) {
      console.error('Some deletions failed:', failedDeletions);
    }

    // Clear client storage after server deletions
    storageSessions = {};
    localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));

    // Update UI
    document.querySelectorAll('.savedSession').forEach(session => fadeOut(session));
    const resumeTitle = document.getElementById('resumeTitle');
    if (resumeTitle) resumeTitle.remove();

  } catch (error) {
    console.error('Error deleting sessions:', error);
    alert('Failed to delete all sessions');
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
              <button data-url="${url}" class="deleteSession"> × </button><br>
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
    console.log('[DEBUG] Starting quiz:', src);
    const logUrl = `/get-logs/${encodeURIComponent(src)}`;
    console.log('[DEBUG] Fetching from:', logUrl);
    
    const logResponse = await fetch(logUrl);
    console.log('[DEBUG] Response status:', logResponse.status);

    if (!logResponse.ok) {
      console.error('[DEBUG] Failed response:', await logResponse.text());
      throw new Error('Log fetch failed');
    }
    
    const logs = await logResponse.json();
    
    // Filter out future timestamps
    const validSessions = Object.values(logs).filter(session => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate <= new Date();
    });

    console.log('[DEBUG] Total sessions:', Object.keys(logs).length);
    console.log('[DEBUG] Valid sessions:', validSessions.length);
    console.log('[DEBUG] Sample sessions:', validSessions.slice(0, 2));

    if (validSessions.length >= 5) {
      console.log('[DEBUG] Showing prune modal');
      const proceed = await showStartModal(logs, src);
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

async function startQuizWithValidation(quizName, mode, sessionId) {
  try {
    const logs = await fetch(`/get-logs/${encodeURIComponent(quizName)}`).then(res => res.json());
    const validSessions = Object.values(logs).filter(session => 
      new Date(session.timestamp) <= new Date()
    );
    
    if (validSessions.length >= 5) {
      const proceed = await showStartModal(logs, quizName);
      if (!proceed) return;
    }
    
    window.location = `quiz-engine.html?src=${quizName}&mode=${mode}&session=${sessionId}`;
  } catch (error) {
    console.error('Pre-check failed:', error);
  }
}

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
        <ul class="session-list">
          ${sessionList.map(([id, session]) => `
            <li class="session-item">
              <div>
                ${new Date(session.timestamp).toLocaleString()}<br>
                Questions: ${session.firstCorrect.length}
              </div>
              <button class="delete-btn" data-session="${id}"> × </button>
            </li>
          `).join('')}
        </ul>
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
        
        // PRUNE HERE AFTER USER ACTION
        await fetch('/prune-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizName: quizName, maxCount: 5 })
        });

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