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

if (!window.location.pathname.includes('quiz-engine.html')) return;

const source = getParam('src');
let isUnloading = false;

window.addEventListener('beforeunload', () => {
    isUnloading = true;
});

if (!isUnloading && !source) {
    window.location = window.location.origin;
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
  window.location = window.location.origin;
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'review') {
  document.removeEventListener('DOMContentLoaded', start);
}

async function start() {
  let session = getParam('session');
  const source = getParam('src');
  
  if (!session || !source) {
    console.error('Missing session or source parameters');
    window.location = window.location.origin;
    return;
  }

  // console.log('[DEBUG] start() - initial session param:', session);
  
  // Detect fresh sessions using sessionStorage flag
  const isNewSession = sessionStorage.getItem('newSession') === 'true';

  // if (!session) {
  //   // Create new session and set flag
  //   const newSession = makeid(128);
  //   sessionStorage.setItem('newSession', 'true'); // Flag new session
  //   const params = new URLSearchParams(window.location.search);
  //   params.set('session', newSession);
  //   window.location.search = params.toString();
  //   return;
  // }

  try {
    // console.log('[DEBUG] Loading quiz content for source:', source);
    if (!content) {
      content = await fetch(`quizzes/${source}.json`)
        .then(res => {
          // console.log('[DEBUG] Quiz fetch response status:', res.status);
          return res.json();
        });
    }

    content = await fetch(`quizzes/${source}.json`)
      .then(res => {
        if (!res.ok) {
          // console.error('[DEBUG] Quiz fetch failed:', res.status);
          window.location = window.location.origin;
          return;
        }
        return res.json();
      })
      .catch(error => {
        // console.error('[DEBUG] Quiz load error:', error);
        window.location = window.location.origin;
      });

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
          currentStreak: 0,
          incorrectTries: 0
        })),
        lastIndex: -1
      };

      // Save state to server
      await fetch(`/state/${hashedSession}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      await logFlaggedQuestions([]);

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
    // window.location = window.location.origin;
  }
}

const choiceLetters = "ABCDEFGHIJ";

async function show() {
  if (state.unseen.length === 0 && state.working.length === 0) {
    showCompletionScreen();
    return;
  }
  if (!content || !Array.isArray(content)) {
    // console.error('No quiz content loaded');
    window.location = window.location.origin;
    return;
  }
  if (!state || !state.unseen || !state.working) {
    // console.error('Invalid state:', state);
    window.location = window.location.origin;
    return;
  }

  // Check for quiz completion
  if (state.unseen.length === 0 && state.working.length === 0) {
  const allQuestions = state.complete;
  let incorrectCounts = { 1: 0, 2: 0, 3: 0, '4+': 0 };

  allQuestions.forEach(q => {
    const count = q.incorrectTries;
    if (count >= 4) incorrectCounts['4+']++;
    else if (count === 3) incorrectCounts[3]++;
    else if (count === 2) incorrectCounts[2]++;
    else if (count === 1) incorrectCounts[1]++;
  });


}

  let currentItem;
  const avoidIndex = state.lastIndex;

  // Always prioritize adding new questions when possible
  if (state.working.length < MAX_WORKING && state.unseen.length > 0) {
      // Filter unseen questions excluding avoidIndex
      const availableNew = state.unseen.filter(q => 
          q.index !== avoidIndex &&
          !state.complete.some(c => c.index === q.index)
      )
      
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
          if (checkboxes.length === 0) {
            alert('Please select at least one category');
            return;
          }

          // Add loading state feedback
        E("generateButton").disabled = true;
        E("generateButton").textContent = "Generating...";

          const checked = Array.from(checkboxes).filter(cb => cb.checked);
          
          checkboxes.forEach(cb => {
              cb.disabled = checked.length >= numAnswers && !cb.checked;
          });
      });
                inputs[val] = input;
                const label = New("LABEL")
                    .attr("for", `radio_${index}`);
                    label.html = `${choiceLetter}: ${val.replace(/\n/g, '<br>')}`;
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
  if (!state.working || state.working.length === 0) return null;
  
  const questionRef = state.working.find(q => q.index === state.lastIndex);
  return questionRef ? {
    item: content[questionRef.index],
    ref: questionRef
  } : null;
}

async function logFlaggedQuestions(questions) {
  const data = questions
    .filter(q => q.incorrectTries > 0 && q.index !== undefined) // Updated filter
    .map(q => ({
      index: q.index,
      incorrectTries: q.incorrectTries
    }));

  try {
    await fetch('/log-flagged', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizName: getParam('src'),
        sessionId: getParam('session'),
        data: data
      })
    });
  } catch (error) {
    // console.error('Failed to log flagged questions:', error);
  }
}

async function submitAnswer() {
  const currentItem = cur();
  console.log(currentItem.ref.index);
  // Add validation check
  if (!currentItem || !currentItem.ref || typeof currentItem.ref.index === 'undefined') {
    console.error('Invalid currentItem in submitAnswer:', currentItem);
    await saveState();
    show();
    return;
  }

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
    questionState.currentStreak = (questionState.currentStreak || 0) + 1;
    questionState.count = (questionState.count || 0) + 1;
  } else {
    // Reset streak on incorrect answer
    questionState.currentStreak = 0;
    questionState.incorrectTries = (questionState.incorrectTries || 0) + 1;
    
    // Set firstAttemptCorrect to false if this was the first attempt
    if (questionState.firstAttemptCorrect === null) {
        questionState.firstAttemptCorrect = false;
    }
    
    // Handle incorrect answer logging
    const allQuestions = [...state.complete, ...state.working];
    const flagged = allQuestions.filter(q => q.incorrectTries > 0);
    await logFlaggedQuestions(flagged).catch(e => console.error('Logging failed:', e));
  }

  // Move the question to the end of the working set if present
  const currentIndex = state.working.findIndex(q => q.index === currentItem.ref.index);
  if (currentIndex > -1) {
    const removed = state.working.splice(currentIndex, 1);
    if (removed.length > 0) {
      const movedQuestion = removed[0];
      if (movedQuestion?.index !== undefined) {
        state.working.push(movedQuestion);
      }
    }
  }

  // Preserve lastIndex to prevent immediate repetition
  state.lastIndex = currentItem.ref.index;

  // Increment tries
  if (!('tries' in questionState)) questionState.tries = 0;
  questionState.tries++;

  // Mastery condition - requires either:
  // 1. Fastmode with first attempt correct, OR
  // 2. Current streak of 2 correct answers (after initial incorrect)
  let mastered = false;
  switch(mode) {
    case 'fastmode':
      if (correct) {
        if (questionState.firstAttemptCorrect === true) {
          mastered = true;
        } else if (questionState.currentStreak >= 3) {
          mastered = true;
        }
      }
      break;
    default:
      // Default mode - master after 3 correct answers in a row
      mastered = questionState.currentStreak >= 3;
  }

  if (mastered) {
    // Remove from working array
    state.working = state.working.filter(q => q.index !== questionState.index);
    
    // Add to complete if not already there
    if (!state.complete.some(c => c.index === questionState.index)) {
      state.complete.push(questionState);
    }
    state.lastIndex = -1; // Reset lastIndex
  }

  await saveState();

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
    
    // Check if callback is provided and is a function
    if (typeof callback === 'function') {
      callback();
    }
  } catch (e) {
    // console.error("Failed to save state:", e);
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

// Enhanced hash function
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

async function handleEndSession() {
  try {
    const sessionId = getParam('session');
    const quizName = getParam('src');
    
    // Delete flagged log
    await fetch('/delete-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizName, sessionId })
    });
    
    // Delete session state
    await deleteEndSession();

  } catch (error) {
    console.error('Session termination failed:', error);
    return;
  }
}

async function generateNewQuizzes() {
  // 1. Get selected category from radio buttons
  const selectedRadio = document.querySelector('.category-radio:checked');
  if (!selectedRadio) {
    alert('Please select a category first');
    return;
  }
  const category = [selectedRadio.value];
  
  // 2. Get session information
  const sessionId = getParam('session');
  const quizName = getParam('src');

  // 3. Validate required parameters
  if (!quizName || !sessionId) {
    console.error('Missing quiz name or session ID');
    alert('Session expired - please start a new session');
    window.location.reload();
    return;
  }

  // 4. Get flagged questions from state
  const flaggedQuestions = state.complete
    .filter(q => q.incorrectTries > 0)
    .map(q => ({
      index: q.index,
      incorrectTries: q.incorrectTries
    }));

  // 5. Generate unique suffix using category
  const suffix = category[0].replace('+', '');

  // 6. Prepare payload
  const payload = {
    sourceQuiz: quizName,
    category,
    flaggedQuestions,
    suffix
  };

  // 7. Add loading state
  const generateBtn = document.getElementById('generateButton');
  const originalText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    // 8. Make the request
    const response = await fetch('/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || 'Server error');
    }

    // 9. Handle successful response
    // console.log('[DEBUG] Generation successful:', responseData);
    
    // Reset button state
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;

    // Create or get the links container
    let linksContainer = document.getElementById('generated-quizzes-container');
    if (!linksContainer) {
      linksContainer = document.createElement('div');
      linksContainer.id = 'generated-quizzes-container';
      linksContainer.style.textAlign = 'center';
      linksContainer.style.marginTop = '20px';
      linksContainer.style.display = 'flex';
      linksContainer.style.flexDirection = 'column';
      linksContainer.style.gap = '10px';
      E("choice_form").append(new Element(linksContainer));
    }

    if (responseData.newQuiz) {
      // Create individual quiz link container
      const quizLinkContainer = document.createElement('div');
      quizLinkContainer.style.display = 'flex';
      quizLinkContainer.style.alignItems = 'center';
      quizLinkContainer.style.justifyContent = 'center';
      quizLinkContainer.style.gap = '10px';

      // Create the quiz link
      const quizLink = document.createElement('a');
      quizLink.href = '#';
      quizLink.textContent = `Start: ${responseData.newQuiz}`;
      quizLink.style.color = '#0066cc';
      quizLink.style.textDecoration = 'underline';
      quizLink.style.cursor = 'pointer';
      
      // Add creation timestamp
      const timestamp = document.createElement('span');
      timestamp.textContent = new Date().toLocaleTimeString();
      timestamp.style.color = '#666';
      timestamp.style.fontSize = '0.9em';

      // Click handler
      quizLink.onclick = async (e) => {
        e.preventDefault();
        try {
          const originalText = quizLink.textContent;
          quizLink.textContent = 'Ending session...';
          quizLink.style.pointerEvents = 'none';
          
          await handleEndSession();
          window.location.href = `?src=${responseData.newQuiz}&session=${makeid(128)}`;
        } catch (error) {
          console.error('Redirect failed:', error);
          quizLink.textContent = `Start ${responseData.newQuiz}`;
          quizLink.style.pointerEvents = 'auto';
          E("result").html = `❌ Error: ${error.message}`;
          E("result").e.className = "incorrect";
        }
      };

      // Add delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.style.background = '#ff4444';
      deleteBtn.style.color = 'white';
      deleteBtn.style.border = 'none';
      deleteBtn.style.borderRadius = '50%';
      deleteBtn.style.width = '20px';
      deleteBtn.style.height = '20px';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        quizLinkContainer.remove();
      };

      // Append all elements
      quizLinkContainer.appendChild(deleteBtn);
      quizLinkContainer.appendChild(quizLink);
      quizLinkContainer.appendChild(timestamp);
      linksContainer.appendChild(quizLinkContainer);
    }
  } catch (error) {  
    // 10. Error handling
    console.error('[DEBUG] Generation error:', error);
    
    // Reset button state
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
    
    // Show error without redirect
    E("result").html = `❌ Error: ${error.message}`;
    E("result").e.className = "incorrect";
  }
}


function showCompletionScreen() {
  const allQuestions = state.complete;
  let incorrectCounts = { 1: 0, 2: 0, 3: 0, '4+': 0 };

  allQuestions.forEach(q => {
    const count = q.incorrectTries;
    if (count >= 4) incorrectCounts['4+']++;
    else if (count === 3) incorrectCounts[3]++;
    else if (count === 2) incorrectCounts[2]++;
    else if (count === 1) incorrectCounts[1]++;
  });

  E("question").html = `Quiz Complete! 🎉`;
  
  // Generate radio buttons instead of checkboxes
  E("choice_form").html = `
    <p>Generate new quizzes or end session.</p>
    <div class="category-list">
      ${Object.entries(incorrectCounts)
        .filter(([_, count]) => count > 0)
        .map(([label, count]) => `
          <label>
            <input type="radio" name="category" value="${label}" class="category-radio">
            ${label === '1' ? 'First attempt' : `${label}x`} (${count} questions)
          </label>
        `).join('')}
    </div>
    <div class="completion-buttons">
      <button id="generateButton" onclick="generateNewQuizzes()">Generate New Quiz</button>
      <button id="exitButton" onclick="await handleEndSession()">Exit to Start</button>
    </div>
  `;

  E("result").html = "";
  E("submitbtn").attr = false;
}

function number_to_suffix(num) {
  if (num < 1) return '';
  let letters = [];
  while (num > 0) {
    num--;
    letters.push(String.fromCharCode(97 + (num % 26)));
    num = Math.floor(num / 26);
  }
  return letters.reverse().join('');
}

window.submitAnswer = submitAnswer;
window.show = show;
window.handleEndSession = handleEndSession;
window.generateNewQuizzes = generateNewQuizzes;
})(); // End IIFE
