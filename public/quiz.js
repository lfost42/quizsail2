// quiz.js
(() => { // IIFE to encapsulate scope
let inputs = [];
let labels = {};

var state = null;
var content = null;

(function init() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'review') {
    document.removeEventListener('DOMContentLoaded', start);
    return;
  }
    document.addEventListener("DOMContentLoaded", start);

})();

function getParam(name) {
  const searchParams = new URLSearchParams(location.search);
  return searchParams.get(name);
}

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

if (new URLSearchParams(window.location.search).get('mode') !== 'review') {
  initializeLogFile();
  installAnswerMonitor();
}

// DeleteSession function
async function deleteEndSession() {
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

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'review') {
  document.removeEventListener('DOMContentLoaded', start);
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
    deleteEndSession();
    return;
  }

  let currentItem;
  const avoidIndex = mode === 'fastmode' ? -1 : state.lastIndex;

  // Always prioritize adding new questions when possible
  if (state.working.length < MAX_WORKING && state.unseen.length > 0) {
      // Filter unseen questions excluding avoidIndex
      const availableNew = state.unseen.filter(q => 
          q.index !== avoidIndex &&
          !state.complete.some(c => c.index === q.index)
      );
      
      if (availableNew.length > 0) {
          currentItem = availableNew[Math.floor(Math.random() * availableNew.length)];
          state.unseen = state.unseen.filter(q => q.index !== currentItem.index);
          state.working.push(currentItem);
      }
  }

  // If no new questions added, select from working set
  if (!currentItem) {
      const availableWorking = state.working.filter(q => 
          q.index !== avoidIndex &&
          !state.complete.some(c => c.index === q.index)
      );
      
      if (availableWorking.length > 0) {
          currentItem = availableWorking[Math.floor(Math.random() * availableWorking.length)];
      }
  }

  // Final fallback
  if (!currentItem) {
      currentItem = [...state.working, ...state.unseen]
          .filter(q => q.index !== avoidIndex)[0];
  }

  shuffle(state.working);
  state.lastIndex = currentItem.index;

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
    // Get from working set excluding completed questions
    const validWorking = state.working.filter(q => 
      !state.complete.some(c => c.index === q.index)
    );
    
    if (validWorking.length === 0) return null;
    
    const questionRef = validWorking[validWorking.length - 1];
    return {
        item: content[questionRef.index],
        ref: questionRef
    }
  }

async function submitAnswer() {
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
        await fetch('/save-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quizName: getParam('src'),
                questionIndex: currentItem.ref.index,
                sessionId: getParam('session'),
                timestamp: new Date().toISOString()
            })
        });
    }

    // Increment tries
    if (!('tries' in questionState)) questionState.tries = 0;
    questionState.tries++;

    // Handle mode-based progression
    switch(mode) {
      case 'fastmode':
          questionState.count = Math.max(0, questionState.count + 1); // Increment count
          questionState.currentStreak = 0; // Reset streak
          // Keep firstAttemptCorrect tracking
          if (questionState.firstAttemptCorrect === null) {
              questionState.firstAttemptCorrect = false;
          }
          break;
      default:
          questionState.count = Math.max(0, questionState.count + 1);
    }

    // Correct answer handling / mastery check:
    // Check if either fastmode with first correct attempt or count >=3
    if ((mode === 'fastmode' && questionState.firstAttemptCorrect) || questionState.count >= 3) {
      state.working = state.working.filter(q => q.index !== questionState.index);
      // Add to complete if not present
      if (!state.complete.some(c => c.index === questionState.index)) {
          state.complete.push(questionState);
      }
      state.lastIndex = -1;
  }

    await saveState();
  }

  // Handle incorrect answers
  const currentIndex = state.working.findIndex(q => q.index === currentItem.ref.index);
  if (currentIndex > -1) {
    // Move answered question to middle of working set
    state.working.splice(currentIndex, 1);
    const insertPos = state.working.length;
    state.working.splice(insertPos, 0, currentItem.ref);
  } else { // INCORRECT ANSWER HANDLING
    // Handle incorrect answers
    const currentIndex = state.working.findIndex(q => q.index === currentItem.ref.index);
    if (currentIndex > -1) {
      // Move answered question to middle of working set
      state.working.splice(currentIndex, 1);
      const insertPos = state.working.length;
      state.working.splice(insertPos, 0, currentItem.ref);
    }
  }
    // Update lastIndex immediately
    state.lastIndex = currentItem.ref.index;

    switch(mode) {
      case 'fastmode':
        questionState.currentStreak = 0; // Reset streak
        // Keep firstAttemptCorrect tracking
        if (questionState.firstAttemptCorrect === null) {
            questionState.firstAttemptCorrect = false;
        }
        break;
    default:
      // Increment count for each correct answer in default mode
      questionState.count = (questionState.count || 0) + 1;
  } 

    // console.log(`answer is ${correct}`)
    let resultMessage = correct ? "✅ CORRECT! " : `🚫 Try again! ➡️ ${answers.join(', ')}`;
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

const MAX_LOG_COUNT = 10;

async function pruneOldLogs(quizName) {
  try {
    await fetch('/prune-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizName, maxCount: MAX_LOG_COUNT })
    });
  } catch (error) {
    console.error('[Logger] Pruning failed:', error);
  }
}

function initializeLogFile() {
  const sessionId = getParam('session');
  const quizName = getParam('src');

  if (!sessionId || !quizName) {
    console.warn('[Logger] Missing session ID or quiz name');
    return;
  }

  fetch('/save-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizName,
      questionIndex: -1,
      sessionId,
      timestamp: new Date().toISOString()
    })
  }).then(() => pruneOldLogs(quizName))
    .catch(err => console.error('[Logger] Log initialization failed:', err));
}

function installAnswerMonitor() {
  const monitorButton = () => {
    const submitBtn = document.getElementById('submitbtn');
    if (!submitBtn) {
      setTimeout(monitorButton, 500); // Retry until button exists
      return;
    }

    const originalHandler = submitBtn.onclick;
    submitBtn.onclick = function(...args) {
      const current = cur(); // Access quiz.js's internal state
      if (current?.ref?.firstAttemptCorrect === null) {
        // Log first attempt
        fetch('/save-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizName: getParam('src'),
            questionIndex: current.ref.index,
            sessionId: getParam('session'),
            timestamp: new Date().toISOString()
          })
        });
      }
      return originalHandler?.apply(this, args);
    };
  };
  monitorButton();
}

window.submitAnswer = submitAnswer;
window.show = show;
})(); // End IIFE
