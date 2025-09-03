// quiz.js
(() => { // IIFE to encapsulate scope
if (new URLSearchParams(window.location.search).get('mode') === 'review') {
  const submitBtn = document.getElementById('submitbtn');
  if (submitBtn) submitBtn.remove();
  return;
}

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
  
  // Detect fresh sessions using sessionStorage flag
  const isNewSession = sessionStorage.getItem('newSession') === 'true';

  try {
    if (!content) {
      content = await fetch(`quizzes/${source}.json`)
        .then(res => {
          return res.json();
        });
    }

    content = await fetch(`quizzes/${source}.json`)
      .then(res => {
        if (!res.ok) {
          alert(`Quiz "${source}" not found!`);
          window.location = window.location.origin;
          return;
        }
        return res.json();
      })
      .catch(error => {
        alert(`Failed to load quiz: ${error.message}`);
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
    window.location = window.location.origin;
    return;
  }
  if (!state || !state.unseen || !state.working) {
    window.location = window.location.origin;
    return;
  }
  if (!document.getElementById('complete-quiz-btn')) {
    const btn = document.createElement('button');
    btn.id = 'complete-quiz-btn';
    btn.textContent = '❌';
    btn.onclick = showCompletionScreen;
    document.body.appendChild(btn);
  }

  // Remove red background at start of new question
  const choiceForm = document.getElementById('choice_form');
  if (choiceForm) {
    choiceForm.classList.remove('incorrect-background');
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

  const modeDisplayNames = {
    'default': 'standard',
    'fastmode': 'fast',
    'lightning': 'lightning',
    'review': 'review'
  };

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

  // Check if currentItem is still undefined (all questions are avoidIndex)
  if (!currentItem) {
      // Check if any questions remain
      const remainingQuestions = [...state.working, ...state.unseen];
      if (remainingQuestions.length === 0) {
          showCompletionScreen();
          return;
      } else {
          // Select the first available question and reset avoidIndex
          currentItem = remainingQuestions[0];
          state.lastIndex = -1;
      }
  }

  // Ensure currentItem is defined before proceeding
  if (!currentItem) {
      showCompletionScreen();
      return;
  }

  shuffle(state.working);
  state.lastIndex = currentItem.index;

  E("stats").html = `
    <span style="margin-right: 1vw">${source} (${modeDisplayNames[mode]})</span>
    mastered: ${state.complete.length} ・ 
    in-flight: ${state.working.length} ・ 
    unseen: ${state.unseen.length}
  `;

  saveState(() => {
    const currentItem = cur();
    
    // Add validation checks for currentItem and its properties
    if (!currentItem || !currentItem.item || !currentItem.item.q) {
      console.error('Invalid currentItem in show():', currentItem);
      showCompletionScreen();
      return;
    }

        inputs = {};
        labels = {};
        
        E("question").html = processTextWithCode(currentItem.item.q);
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
                    label.html = `${choiceLetter}: ${processTextWithCode(val)}`;
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
                    label.text = processTextWithCode(val);
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
  // console.log(currentItem.ref.index);
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
  const choiceForm = document.getElementById('choice_form');

  Object.values(labels).forEach(label => {
    label.e.className = '';
  });

  if (numAnswers == 1 && numChoices == 1) {
    // Text input handling
    if (inputs.value.trim() === '' || inputs.value.toUpperCase() !== answers[0].toUpperCase()) {
        correct = false;
        inputs.e.style.backgroundColor = '#a82b0e';
    } else {
        inputs.e.style.backgroundColor = '#246464';
    }
  } else {
    // Multiple-choice handling
    const selected = [];
    for (const [choice, input] of Object.entries(inputs)) {
      if (input.checked) {
        selected.push(choice);
      }
    }

    // Add multi-select validation
    if (numAnswers > 1) {
      const selectedCount = Object.values(inputs).filter(input => input.checked).length;
      if (selectedCount < numAnswers) {
        alert(`Question requires ${numAnswers} answers!`);
        return;
      }
    }
    // Must select all correct answers
    correct = selected.length === answers.length && 
              answers.every(a => selected.includes(a));
    
    // Reset labels
    Object.values(labels).forEach(label => {
      label.e.className = '';
      label.e.style.color = '';
    });

    // Highlight correct answers in green
    answers.forEach(correctAnswer => {
      if (labels[correctAnswer]) {
        labels[correctAnswer].e.classList.add('correct-answer');
      }
    });

    // Mark all incorrect answers as gray
    Object.keys(labels).forEach(choice => {
      if (!answers.includes(choice)) {
        labels[choice].e.style.color = '#666666';
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
                labels[choice].e.style.color = '#666666';
                correct = false;
                choiceForm.classList.add('incorrect-background');
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
      
    case 'lightning':
      mastered = questionState.currentStreak >= 1;
      break;

    default:
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
      resultMessage += `<br><br>${processTextWithCode(item.e)}`;
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
  } else if (e.key === "Enter" || e.key === " ") {
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

    // Delete flagged log file
    await fetch('/delete-flagged-log', {
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
  const selectedRadio = document.querySelector('.category-radio:checked');
  if (!selectedRadio) {
    alert('Please select a category first');
    return;
  }
  
  const category = [selectedRadio.value];
  const sessionId = getParam('session');
  const quizName = getParam('src');

  if (!quizName || !sessionId) {
    console.error('Missing quiz name or session ID');
    alert('Session expired - please start a new session');
    window.location.reload();
    return;
  }

  let flaggedQuestions = [];
  let suffix = '';

  if (category[0] === '0') {
    // Weighted questions (N copies per question)
    state.complete.forEach(q => {
      if (q.incorrectTries === 0) return;
      const questionCategory = getAttemptCategory(q.incorrectTries);

      for (let i = 0; i < q.incorrectTries; i++) {
        flaggedQuestions.push({
          index: q.index,
          incorrectTries: q.incorrectTries,
          sequence: i + 1
        });
      }
    });
    suffix = category[0].replace('+', '');
  } 
  else if (category[0] === 'a') {
      // Only add each question ONCE
      const uniqueIndices = new Set();
      state.complete.forEach(q => {
          if (q.incorrectTries === 0) return;
          if (uniqueIndices.has(q.index)) return; // Prevent duplicates
          
          uniqueIndices.add(q.index);
          flaggedQuestions.push({
              index: q.index,
              incorrectTries: q.incorrectTries,
              sequence: 1  // Only one copy
          });
      });
      suffix = 'a';
  }
  else {
      // Specific attempt counts - KEEP AS IS
      const attemptCount = parseInt(category[0]);
      state.complete.forEach(q => {
          const questionCategory = getAttemptCategory(q.incorrectTries);
          if (q.incorrectTries === attemptCount) {
              flaggedQuestions.push({
                  index: q.index,
                  incorrectTries: q.incorrectTries,
                  sequence: 1  // Only one copy
              });
          }
      });
      suffix = category[0].replace('+', '');
  }

  if (flaggedQuestions.length === 0) {
  throw new Error('No valid questions after final filtering');
  }

  const payload = {
    sourceQuiz: quizName,
    category,
    flaggedQuestions,
    suffix
  };
  // console.log('[DEBUG] Final payload:', JSON.stringify(payload, null, 2));

  // Add loading state
  const generateBtn = document.getElementById('generateButton');
  const originalText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const response = await fetch('/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || 'Server error');
    }

    // Reset button state
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;

    // Initialize or get the links container
    let linksContainer = document.getElementById('generated-quizzes-container');
    if (!linksContainer) {
      linksContainer = document.createElement('div');
      linksContainer.id = 'generated-quizzes-container';
      linksContainer.style.textAlign = 'center';
      linksContainer.style.marginTop = '20px';
      linksContainer.style.display = 'flex';
      linksContainer.style.flexDirection = 'column';
      linksContainer.style.gap = '10px';
      
      // Insert the container after the completion buttons
      const completionButtons = document.querySelector('.completion-buttons');
      if (completionButtons) {
        completionButtons.after(linksContainer);
      } else {
        // Fallback if completion buttons can't be found
        document.querySelector('.category-list').after(linksContainer);
      }
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
      quizLink.textContent = `Start: ${responseData.newQuiz}-${flaggedQuestions.length}`;
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
          window.location.href = `?src=${responseData.newQuiz}&session=${makeid(128)}&mode=fastmode`;
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
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          // Show deleting state
          deleteBtn.textContent = '...';
          deleteBtn.disabled = true;
          
          // Call server to delete the quiz
          const deleteResponse = await fetch('/delete-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizName: responseData.newQuiz })
          });

          if (!deleteResponse.ok) {
            throw new Error('Failed to delete quiz');
          }

          // Remove the link from UI
          quizLinkContainer.remove();
        } catch (error) {
          console.error('Delete failed:', error);
          deleteBtn.textContent = '×';
          deleteBtn.disabled = false;
          E("result").html = `❌ Error deleting quiz: ${error.message}`;
          E("result").e.className = "incorrect";
        }
      };

      // Append all elements
      quizLinkContainer.appendChild(deleteBtn);
      quizLinkContainer.appendChild(quizLink);
      quizLinkContainer.appendChild(timestamp);
      linksContainer.appendChild(quizLinkContainer);
    }
  } catch (error) {  
    
    // Reset button state
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
    
    // Show error without redirect
    E("result").html = `❌ Error: ${error.message}`;
    E("result").e.className = "incorrect";
  }
}

function showCompletionScreen() {
  E("homeButton").visible = false
  const allQuestions = state.complete;
  let incorrectCounts = { 0: allQuestions.length, 1: 0, 2: 0, 3: 0, '4+': 0 };

  const modeDisplayNames = {
    'default': 'standard',
    'fastmode': 'fast',
    'lightning': 'lightning',
    'review': 'review'
  };
  
  E("stats").html = `
    <span style="margin-right: 1vw">${source} (${modeDisplayNames[mode]})</span>
    mastered: ${state.complete.length} ・ 
    in-flight: 0 ・ 
    unseen: 0
  `;

  const btn = document.getElementById('complete-quiz-btn');
  if (btn) btn.remove();

  allQuestions.forEach(q => {
    const count = q.incorrectTries;
    
    // Only count questions with at least 1 incorrect attempt
    if (count > 0) {
      if (count >= 4) incorrectCounts['4+']++;
      else if (count === 3) incorrectCounts[3]++;
      else if (count === 2) incorrectCounts[2]++;
      else if (count === 1) incorrectCounts[1]++;
      incorrectCounts[0]++;
    }
  });

  const uniqueCount = allQuestions.filter(q => q.incorrectTries > 0).length;
  const weightedCount = allQuestions.reduce((sum, q) => sum + q.incorrectTries, 0);
  
  // Check if there are any incorrect answers
  const hasIncorrectAnswers = uniqueCount > 0;
  // Check if all questions were answered correctly on first try
  const allCorrectFirstTry = allQuestions.every(q => q.incorrectTries === 0);

  E("question").html = `<h1>🎉 Quiz Complete 🎉<h1>`;
  let formHtml = ``;
  
  if (hasIncorrectAnswers) {
    formHtml += `
      <p>Generate new quizzes based on incorrect answers or end session.</p>
      <div class="category-list" id="categoryList">
        ${Object.entries(incorrectCounts)
          .filter(([label, count]) => label !== '0' && count > 0)
          .map(([label, count]) => `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;" class="category-item">
              <label style="flex-grow: 1;">
                <input type="radio" name="category" value="${label}" class="category-radio">
                ${label === '1' ? 'First attempt' : `${label}+`} (${count})
              </label>
            </div>
          `).join('')}
      </div>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="radio" name="category" value="a" class="category-radio" checked>
        All questions (${uniqueCount})
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="radio" name="category" value="0" class="category-radio">
        All questions, weighted (${weightedCount})
      </label>
    `;
  } else {
    formHtml += `<p>🎉 Congratulations! You answered all questions correctly on the first try!</p>`;
  }
  
  formHtml += `
    <div class="completion-buttons">
      ${hasIncorrectAnswers ? 
        `<button id="generateButton" class="completion-buttons" type="button" onclick="generateNewQuizzes()">Generate</button>` : 
        ''}
      ${allCorrectFirstTry ? 
        `<button id="retireButton" class="completion-buttons" type="button" onclick="handleRetireQuiz()">
          Retire Quiz</button>` : 
        ''}
      <button id="exitButton" class="completion-buttons" type="button" onclick="handleEndSession()">Exit Session</button>
    </div>
  `;
  
  E("choice_form").html = formHtml;
  E("result").html = "";
  E("submitbtn").attr = false;
}

function handleRetireQuiz() {
  const quizName = getParam('src');
  if (!quizName) {
    alert('Quiz name not found');
    return;
  }

  // Add loading state
  const retireBtn = document.getElementById('retireButton');
  const originalText = retireBtn.textContent;
  retireBtn.disabled = true;
  retireBtn.textContent = "Retiring...";

  // Call server to retire quiz
  fetch('/retire-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizName })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to retire quiz');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      handleEndSession();
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Retire error:', error);
    alert(`Error: ${error.message}`);
    // Reset button state
    retireBtn.disabled = false;
    retireBtn.textContent = originalText;
  });
}

// Helper function for escaping code blocks
function processTextWithCode(text) {
    if (!text) return text; // handle undefined or null

    // Split text into segments (code blocks and regular text)
    const segments = text.split(/(<code>[\s\S]*?<\/code>)/g);
    let result = '';

    segments.forEach(segment => {
        if (segment.startsWith('<code>') && segment.endsWith('</code>')) {
            // Process code block: escape HTML entities
            const inner = segment.substring(6, segment.length - 7);
            const escaped = inner.replace(/&/g, '&amp;')
                                  .replace(/</g, '&lt;')
                                  .replace(/>/g, '&gt;');
            result += `<code>${escaped}</code>`;
        } else {
            // Process regular text: preserve newlines
            result += segment;
        }
    });
    return result;
}


function getAttemptCategory(attempts) {
  if (attempts >= 4) return '4+';
  if (attempts >=3) return '3';
  if (attempts >= 2) return '2';
  return '1';
}

window.submitAnswer = submitAnswer;
window.show = show;
window.handleEndSession = handleEndSession;
window.generateNewQuizzes = generateNewQuizzes;
window.getAttemptCategory = getAttemptCategory;
window.showCompletionScreen = showCompletionScreen;
window.handleRetireQuiz = handleRetireQuiz;
})(); // End IIFE
