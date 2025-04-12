// declare variables
let inputs = [];
let labels = {};

var state = null;
var content = null;

const source = getParam('src');
if (!source) {
    alert("Please select a quiz from the menu.");
    window.location = window.location.origin; // Redirect to start
}

const mode = getParam('mode') || 'default';
const MAX_WORKING = 10;
const sessions = window.localStorage.getItem(window.SAVED_SESSIONS);

const updateSessions = (url, course) => {
  const sessions = getStorageSessions();
  const d = new Date();
  
  sessions[url] = {
    course,
    lastAccess: d.toISOString(),
    startedOn: sessions[url]?.startedOn || d.toISOString()
  };
  
  localStorage.setItem(SAVED_SESSIONS, JSON.stringify(sessions));
};

// Fixed deleteSession function
async function deleteSession() {
  const session = getParam('session');
  const fullUrl = document.location.href;
  const sessions = getStorageSessions();
  
  try {
    const hashedSession = await hash(session);
    await fetch(`/state/${hashedSession}`, { 
      method: 'DELETE' 
    });
  } catch (e) {
    console.warn("Cleanup error:", e);
  }
  
  delete sessions[fullUrl];
  localStorage.setItem(SAVED_SESSIONS, JSON.stringify(sessions));
}

async function start() {
  let session = getParam('session');
  
  // Detect fresh sessions using sessionStorage flag
  const isNewSession = sessionStorage.getItem('newSession') === 'true';

  if (!session) {
    // Create new session and set flag
    const newSession = makeid(128);
    sessionStorage.setItem('newSession', 'true'); // Flag new session
    const params = new URLSearchParams(window.location.search);
    params.set('session', newSession);
    window.location.search = params.toString();
    return;
  }

  try {
    // Load quiz content
    if (!content) {
      content = await fetch(`quizzes/${source}.json`)
        .then(res => {
          if (!res.ok) throw new Error('Quiz not found');
          return res.json();
        });
    }

    const hashedSession = hash(session).toLowerCase();
    if (isNewSession) {
      // Initialize state directly
      state = {
        complete: [],
        working: [],
        unseen: Array.from({ length: content.length }, (_, i) => ({
          index: i,
          count: 0,
          tries: 0,
          firstAttemptCorrect: null,
          currentStreak: 0
        })),
        lastIndex: -1
      };

      // Save state to server
      await fetch(`/state/${hashedSession}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      sessionStorage.removeItem('newSession'); // Clear flag
      updateSessions(window.location.href, source);
      show(); // Start quiz immediately
      return;
    }

    // Existing session flow: check server state
    let stateResponse;
    try {
      stateResponse = await fetch(`/state/${hashedSession}`);
    } catch (error) {
      stateResponse = { status: 0 };
    }

    if (stateResponse.status === 200) {
      state = await stateResponse.json();
    } else if (stateResponse.status === 404 || stateResponse.status === 0) {
      // Handle edge case (session flag lost but state missing)
      sessionStorage.setItem('newSession', 'true');
      window.location.reload(); // Retry with flag
      return;
    } else {
      throw new Error(`Unexpected server response: ${stateResponse.status}`);
    }

    updateSessions(window.location.href, source);
    show();
  } catch (error) {
    alert(`Quiz failed to start: ${error.message}`);
    window.location = window.location.origin;
  }
}


const choiceLetters = "ABCDEFGHIJ";

function showSessionModal(sessions) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    const sessionList = Object.entries(sessions).sort(([,a], [,b]) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Prune Logs Modal
    content.innerHTML = `
    <p>Found ${sessionList.length} saved sessions. Please select an option below.</p>
        <button id="refresh-btn">Refresh Quiz</button>&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp        
        <button id="continue-btn">Cancel</button>&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp
        <button id="back-btn">Back to Start</button>
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
    `;

    // Add event listeners
    content.querySelector('#continue-btn').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });

    // Back to start button
    content.querySelector('#back-btn').addEventListener('click', async () => {
      try {
        await deleteSession();
        window.location = window.location.origin;
      } catch (error) {
        console.error('Back to start failed:', error);
        alert('Failed to clear session');
      }
    });

    // Delete unwanted logs listener
    content.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await fetch('/delete-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quizName: source,
              sessionId: btn.dataset.session
            })
          });
          btn.closest('.session-item').remove();
        } catch (error) {
          alert('Failed to delete session');
        }
      });
    });

    // Update the refresh button handler in showSessionModal()
    const refreshBtn = content.querySelector('#refresh-btn');
    refreshBtn.addEventListener('click', async () => {
        try {
            const currentQuiz = getParam('src');
            const response = await fetch('/refresh-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizName: currentQuiz })
            });
            
            const result = await response.json(); // Parse once here
            if (!response.ok) throw new Error(result.error || 'Refresh failed');

            await deleteSession();
            // Use the already parsed result
            alert(`${result.message}\nNew version: ${result.newFileName}`);
            window.location.href = window.location.origin;

        } catch (error) {
            console.error('Refresh failed:', error);
            
            let message = error.message;
            if (error.response?.data?.originalFilePreserved) {
                message += '\nOriginal quiz file has been preserved.';
            }
            
            alert(`Refresh failed: ${message}`);
            window.location.reload();
        }
    });

    modal.appendChild(content);
    document.body.appendChild(modal);
  });
}

function show() {
  if (!content || !Array.isArray(content)) {
    console.error('No quiz content loaded');
    window.location = window.location.origin;
    return;
  }
  if (!state || !state.unseen || !state.working) {
    console.error('Invalid state:', state);
    window.location = window.location.origin;
    return;
  }

  // Check for quiz completion
  if (state.unseen.length === 0 && state.working.length === 0) {
    E("question").html = `Quiz Complete! 🎉`;
    E("choice_form").html = "<p>Please click [Return to Start] at the bottom of the page to start a new quiz.</p>";
    E("result").html = "";
    E("submitbtn").attr = false;
    deleteSession();
    return;
  }

  let currentItem;
  const avoidIndex = state.lastIndex;

  // Universal filtering for all question sources
  const workingCandidates = state.working.filter(q => q.index !== avoidIndex);
  const unseenCandidates = state.unseen.filter(q => q.index !== avoidIndex);

  // 1. Working Set Selection (when unseen empty)
  if (state.unseen.length === 0 && workingCandidates.length > 0) {
    currentItem = workingCandidates[Math.floor(Math.random() * workingCandidates.length)];
  }
  // 2. Normal Working Set Selection
  else if (state.working.length >= MAX_WORKING) {
    currentItem = workingCandidates.length > 0
      ? workingCandidates[Math.floor(Math.random() * workingCandidates.length)]
      : state.working[Math.floor(Math.random() * state.working.length)];
  }
  // 3. Unseen Set Selection
  else if (unseenCandidates.length > 0) {
    currentItem = unseenCandidates[Math.floor(Math.random() * unseenCandidates.length)];
    state.unseen = state.unseen.filter(q => q.index !== currentItem.index);
    state.working.push(currentItem);
  }
  // 4. Fallback to forced new question
  else {
    currentItem = state.working.concat(state.unseen)
      .find(q => q.index !== avoidIndex) || state.working[0];
  }

  // Final protection against duplicates
  if (currentItem?.index === avoidIndex) {
    const allQuestions = [...state.working, ...state.unseen];
    currentItem = allQuestions.find(q => q.index !== avoidIndex) || allQuestions[0];
  }

  state.lastIndex = currentItem?.index || -1;

  saveState(() => {
    const currentItem = cur();
    if (!currentItem) return;

        E("stats").html = `mastered: ${state.complete.length} <BR>`
            + `in-flight:  ${state.working.length}<BR>`
            + `unseen: ${state.unseen.length}`;
        inputs = {};
        labels = {};
        
        E("question").html = `${currentItem.item.q.replace(/\n/g, '<br>')}`;
        E("choice_form").html = "";
        E("result").html = "";

        // shuffle choices
        shuffle(currentItem.item.c);

        const numChoices = currentItem.item.c.length;
        const numAnswers = currentItem.item.a.length;
        
        currentItem.item.c.forEach((val,index)=>{
            const div = New("DIV");
            div.attr("class", "input")
            const choiceLetter = choiceLetters[index];
            if (numAnswers>1) {
                const input = New("INPUT")
                    .attr("type", "checkbox")
                    .attr("id", `radio_${index}`)
                    .attr("value", val)
                    .attr("name", `answer_${index}`);

                // Add change listener to handle choice limits
        input.e.addEventListener('change', () => {
          const checkboxes = document.querySelectorAll(`input[type="checkbox"][name^="answer_"]`);
          const checked = Array.from(checkboxes).filter(cb => cb.checked);
          
          checkboxes.forEach(cb => {
              cb.disabled = checked.length >= numAnswers && !cb.checked;
          });
      });
                inputs[val] = input;
                const label = New("LABEL")
                    .attr("for", `radio_${index}`);
                label.text = `${choiceLetter}: ${val}`;
                labels[val] = label;
                div.append(input);
                div.append(label);
            } else {
                if (numChoices>1) {
                    const input = New("INPUT")
                        .attr("type", "radio")
                        .attr("id", `radio_${index}`)
                        .attr("value", val)
                        .attr("name", `answer`);
                    const label = New("LABEL")
                        .attr("for", `radio_${index}`);
                    label.text = `${choiceLetter}: ${val}`;
                    div.append(input);
                    div.append(label);
                    labels[val] = label;
                    inputs[val] = input;
                } else {
                    inputs = New("INPUT")
                        .attr("type", "text")
                        .attr("id", "answer")
                        .attr("autocomplete", "off")
                        .attr("name", "answer");
                    const label = New("DIV");
                    label.text = currentItem.item.c;
                    div.append(label);
                    div.append(inputs);
                }                
            }
            E("choice_form").append(div);
        });
        E("choice_form")
        .child("DIV")
            .attr("id", "submit")
            .child("INPUT")
                .attr("value","Submit")
                .attr("type","button")
                .attr("id","submitbtn")
                .attr("onclick","submitAnswer()");
    });
}

/**
 * return reference to current question
 */
function cur() {
    if (!state.working || state.working.length === 0) {
      console.warn('[Quiz] cur() called with empty working set');  
      return null;
    }
    const questionRef = state.working[state.working.length-1];
    return {
        item: content[questionRef.index],
        ref: questionRef
    }
}

function submitAnswer() {
  const currentItem = cur();
  const questionState = currentItem.ref;
  const item = currentItem.item;
  const answers = item.a;
  const numChoices = currentItem.item.c.length;
  const numAnswers = answers.length;
  let correct = true;

  Object.values(labels).forEach(label => {
    label.e.style.color = ''; // Reset to default
  });

  if (numAnswers == 1 && numChoices == 1) {
    // Text input handling
    if (inputs.value.trim() === '' || inputs.value.toUpperCase() !== answers[0].toUpperCase()) {
        correct = false;
        inputs.e.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
    } else {
        inputs.e.style.backgroundColor = '#009f00';
    }
  } else {
    // Highlight correct answers in green
    answers.forEach(correctAnswer => {
        if (labels[correctAnswer]) {
            labels[correctAnswer].e.style.color = '#009f00';
        }
    });

    // Check if any answer is selected
    let hasSelection = false;
    for (const input of Object.values(inputs)) {
        if (input.checked) {
            hasSelection = true;
            break;
        }
    }
    if (!hasSelection) {
        correct = false;
    } else {
        // Mark incorrect selections
        for (const [choice, input] of Object.entries(inputs)) {
            if (input.checked && !answers.includes(choice)) {
                labels[choice].e.style.color = 'rgba(128, 128, 128, 0.7)';
                correct = false;
            }
        }
    }
  }
  
  if (correct) {
    // FIRST ATTEMPT LOGGING
    if (questionState.firstAttemptCorrect === null) {
      questionState.firstAttemptCorrect = true;
      window.saveLogToServer(getParam('src'), currentItem.ref.index);
    }
    
    if (questionState.count >= 3) {
      state.complete.push(questionState);
      state.working.pop();
    }
    // Increment tries FIRST
    if (!('tries' in questionState)) questionState.tries = 0;
questionState.tries++;
      switch(mode) {
          case 'review':
              questionState.count = 3;
              break;
              
          case 'fastmode':
              if (questionState.firstAttemptCorrect === null) {
                  // First attempt
                  questionState.firstAttemptCorrect = true;
                  questionState.count = 3;
              } else {
                  questionState.currentStreak++;
                  if (questionState.currentStreak >= 3) {
                      questionState.count = 3;
                  }
              }
              break;
              
          default: // Default mode
              questionState.count++;
      }
      saveState(() => {
        // console.log('[Quiz] State saved:', questionState);
      });
      
      if (questionState.count >= 3) {
          state.complete.push(questionState);
          state.working.pop();
      }
    } else {
      // Handle incorrect answers
      const currentIndex = state.working.findIndex(q => q.index === currentItem.ref.index);
      if (currentIndex > -1) {
        // Move answered question to middle of working set
        state.working.splice(currentIndex, 1);
        const insertPos = Math.max(1, Math.floor(state.working.length/2));
        state.working.splice(insertPos, 0, currentItem.ref);
      }
  
      // Update lastIndex immediately
      state.lastIndex = currentItem.ref.index;
  
      // Existing incorrect answer handling
      switch(mode) {
        case 'fastmode':
            if (questionState.firstAttemptCorrect === null) {
                questionState.firstAttemptCorrect = false;
            }
            questionState.currentStreak = 0;
            break;
        default:
            questionState.count = 0;
    }
  }

    // console.log(`answer is ${correct}`)
    let resultMessage = correct ? "✅ CORRECT! " : `🚫 Try again! ➡️ ${answers}`;
    // Add explanation if available
    if (item.e) {
        resultMessage += `<br><br>${item.e.replace(/\n/g, '<br>')}`;
      } else {
        resultMessage += `<br><br>Explanation not provided.`;
    }
    E("result").html = resultMessage;

    //remove classes, then add new class based on correct/incorrect answer
    E("result").e.className = "";
    var newClass = correct ? "correct" : "incorrect";
    E("result").e.classList.add(newClass);

    E("submitbtn").attr("onclick", 'show()').value = "Next Question";
    if (!('tries' in currentItem.ref)) {
        currentItem.ref.tries = 0;
    }

    if (correct) {
      // Handle correct answers based on mode
      switch(mode) {
          case 'fastmode':
              currentItem.ref.count = 3; // Immediate completion in fastmode
              break;
          default:
              currentItem.ref.count += 1; // Normal progression
      }
      
      if (currentItem.ref.count >= 3) {
          state.complete.push(currentItem.ref);
          state.working.pop();
          state.lastIndex = currentItem.ref.index;
      }
  } else {
      currentItem.ref.count = 0; // Reset on incorrect answer
  }
}

class Element {
    constructor (e) {
        this.e = e;
    }
    set html(val) {
        this.e.innerHTML = val;
    }
    set text(val) {
        this.e.innerText = val;
    }
    set value(val) {
        this.e.value = val;
    }
    attr(key,val)  {
        this.e.setAttribute(key, val);
        return this;
    }
    append(elem) {
        this.e.appendChild(elem.e);
        return this;
    }
    child(type) {
        const e = document.createElement(type);
        this.e.appendChild(e);
        return new Element(e);
    }
    set visible(val) {
        if (val===true) {
            this.e.style.display = "block";
        } else if (val===false) {
            this.e.style.display = "none";
        }
    }
    get value() {
        return this.e.value;
    }
    get checked() {
        return this.e.checked;
    }
}


function New(type) {
    return new Element(document.createElement(type));
}

function E(id) {
    return new Element(document.getElementById(id));
}

function sessionName() {
    return E('session_name').value;
}

function log(...args) {
    console.log(args.concat.apply);
}

Array.prototype.empty =  function() {
    return this.length==0;
}

function shuffle(a) {
    // console.log(a);
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getParam(name) {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get(name);
}

async function saveState(callback) {
  try {
    const session = getParam('session');
    if (!session) return;
    
    const hashedSession = hash(session).toLowerCase();
    await fetch(`/state/${hashedSession}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(state)
    });
    
    // Update localStorage timestamp
    updateSessions(window.location.href, source);
    
    callback();
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}

function makeid(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

document.addEventListener("DOMContentLoaded", start);

document.addEventListener("keyup", async (e) => {
  let key = null;
  if (e.key >= "a" && e.key <= "j") {
      key = e.key.toUpperCase();
  }

  if (key && choiceLetters.indexOf(key) >= 0) {
      const el = document.getElementById(`radio_${choiceLetters.indexOf(key)}`);
      if (el) {
          el.checked = !el.checked;
      }
  } else if (e.key === "Enter") {
      const el = document.getElementById("submitbtn");
      if (el) {
          el.click();
      }
  }

});

// In quiz.js - Enhanced hash function
function hash(value) {
  if (!value) return 'invalid';
  
  // Handle numeric strings and existing hashes
  if (typeof value === 'string' && value.match(/^-?\d+$/)) {
    return value;
  }

  // Stable hashing algorithm
  let hash = 0;
  const str = value.toString();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}