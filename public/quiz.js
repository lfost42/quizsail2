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
const storageSessions = getStorageSessions();
const MAX_WORKING = 10;

const updateSessions = (url, course) => {
    const d = new Date();
    const date = d.toLocaleString();
    if (storageSessions[url]) {
        storageSessions[url].lastAccess = date;
    }
    else {
        storageSessions[url] = {
            course,
            lastAccess: date,
            startedOn: date
        }
    }
    localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));
}

// To delete session when a quiz is completed. 
async function deleteSession() {
  const session = getParam('session');
  const fullUrl = document.location.href; // Keep full URL with session ID
  
  // Delete server session
  try {
      const hashedSession = await hash(session);
      await fetch(`/state/${hashedSession}`, { 
          method: 'DELETE' 
      });
  } catch (e) {
      console.warn("Cleanup error:", e);
  }
  
  // Delete client session using FULL URL as key
  delete storageSessions[fullUrl];
  localStorage.setItem(SAVED_SESSIONS, JSON.stringify(storageSessions));
  
  // Navigate to start page
  setTimeout(() => {
      window.location.href = window.location.origin;
  }, 3000);
}

async function start() {
  console.log("starting!", getParam('session'));
  let session = getParam('session');
  
  if (!session) {
    const newSession = makeid(128);
    // Use URLSearchParams to handle parameters correctly
    const params = new URLSearchParams(window.location.search);
    params.set('session', newSession);
    window.location.search = params.toString();
    return;
}

  updateSessions(document.location, source);
  
  try {
    const h = await hash(session).catch(() => "fallback_hash");
    const res = await fetch(`/state/${h}`);
    const [quizContent, savedState] = await Promise.all([
        fetch(`${source}.json`).then(res => {
            if (!res.ok) throw new Error('Quiz not found');
            return res.json();
        }),
        (async () => {
            const h = await hash(session);
            const res = await fetch(`/state/${h}`);
            return res.status === 200 ? res.json() : null;
        })()
    ]);

    // Ensure content is valid
    if (!quizContent?.length) throw new Error('Invalid quiz format');
    
    content = quizContent;
    state = savedState || {
      complete: [],
      working: [],
      unseen: Array.from({length: content.length}, (_, i) => ({
          index: i,
          count: 0,
          tries: 0,
          firstAttemptCorrect: null,  // New field
          currentStreak: 0           // New field
      })),
      lastIndex: -1
  };
  
    show();
} catch (error) {
    console.error('Initialization error:', error);
    alert(`Failed to start quiz: ${error.message}`);
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
    E("choice_form").html = "Returning to start .......";
    E("result").html = "";
    E("submitbtn").attr = false;
    deleteSession();
    return;
  }
  
  let currentItem;
  const lastIndex = state.lastIndex || -1;

  if (state.unseen.length === 0 && state.working.length > 0) {
    // Rotate questions ensuring no consecutive repeats
    let nextIndex;
        let attempts = 0;
        do {
            nextIndex = Math.floor(Math.random() * state.working.length);
            attempts++;
        } while (attempts < 100 && // Add escape clause
              state.working.length > 1 && 
              state.working[nextIndex].index === state.lastIndex);
        
        const nextItem = state.working.splice(nextIndex, 1)[0];
        state.working.push(nextItem);
        currentItem = nextItem; // Add this line
    }
    else {
    // if the working set is at max, grab a question from the working set

    if (state.working.length === MAX_WORKING) {
    // Get from working set (ensure not last shown)
      do {
          const nextid = Math.floor(Math.random() * state.working.length/2);
          currentItem = state.working.splice(nextid, 1)[0];
          state.working.push(currentItem);
      } while (currentItem.index === lastIndex);
          } else if (state.working.length === 0 || cur().ref.tries > 0) {
              // Get from unseen set (ensure not last shown)
              if (state.working.length < MAX_WORKING && state.unseen.length > 0) {
                  let randomUnseen;
                  do {
                      randomUnseen = Math.floor(Math.random() * state.unseen.length);
                      currentItem = state.unseen[randomUnseen];
                  } while (currentItem.index === lastIndex && state.unseen.length > 1);
                  state.unseen.splice(randomUnseen, 1);
                  state.working.push(currentItem);
              }
          }
  }
  // Store current index as last shown
  state.lastIndex = currentItem?.index || -1;

    saveState(()=>{
        const currentItem = cur();
        if (!currentItem) return; // Add null check

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
        return null;
    }
    const questionRef = state.working[state.working.length-1];
    return {
        item: content[questionRef.index],
        ref: questionRef
    }
}

function submitAnswer() {
  console.log('submit!')
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
      
      if (questionState.count >= 3) {
          state.complete.push(questionState);
          state.working.pop();
      }
  } else {
      // Handle incorrect answers
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
    ++currentItem.ref.tries;
    if (correct===true) {
        if (allowQuickComplete===1) {
            currentItem.ref.count=3;
        } else
        {
            currentItem.ref.count+=1;
        }
        if (currentItem.ref.count>=3) {
            state.complete.push(currentItem.ref);
            state.working.pop();
            state.lastIndex = currentItem.ref.index; // Track the last shown question
        }
    } else {
        currentItem.ref.count = 0;
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
    console.log(a);
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
      const hashedSession = await hash(session);
      await fetch(`/state/${hashedSession}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify(state)
      });
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