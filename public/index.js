let storageSessions = getStorageSessions();

const fadeOut = (element) => {
    // Enable the element's hidden attribute so that it can be targeted in CSS
    element.hidden = true;
    setTimeout(() => {
        element.remove();
    }, 1000);    
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

// Update deleteSession to be global
window.deleteQuizSession = async function(url) {
  const sessionId = url.split('session=')[1];
  const hashedSession = await hash(sessionId); // Hash the session ID
  delete storageSessions[url];
  localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));
  fetch(`/state/${hashedSession}`, { method: 'DELETE' });
}

const deleteSession = (target) => {
    const confirm = window.confirm("Are you sure you want to delete this session?");
    if (confirm) {
        delete storageSessions[target.dataset.session];
        localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));
        fadeOut(target.parentElement);
        if (Object.keys(storageSessions).length === 0) {
            document.getElementById("resumeTitle").remove();
        }
    }
}

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
  for (let [url, { course, lastAccess, startedOn }] of sortedSessions) {
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

const start = () => {
  const src = document.getElementById('quiz').value;
  const mode = document.getElementById('reviewmode').checked ? 'review' : document.getElementById('fastmode').checked ? 'fastmode' : 'default';
  const url = `quiz-engine.html?src=${src}&mode=${mode}`;
  window.location = url;
}

document.addEventListener("DOMContentLoaded", () => {
    renderSessions();
    loadQuizzes();
});

document.addEventListener("click", ({ target }) => {
    if (!target) return;
    if (target.classList.contains("deleteAllLink")) {
      deleteAllSessions();
      return;
    }
    if (target.id === "startButton") {
        return start();
    }
    if (target.className === "deleteSession") {
        return deleteSession(target);
    }
});

function hash(value) {
  // Simple hash for localhost development
  if (window.location.hostname === 'localhost') {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Promise.resolve(hash.toString());
  }
}