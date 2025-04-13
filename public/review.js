// review.js
(() => {

  const sessionId = document.body.dataset.sessionId;
  const choiceLetters = "ABCDEFGHIJ";

  function getParam(name) {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get(name);
  }

  let state = {
    questions: [],
    currentQuestionIndex: 0,
    quizData: null
  };

  // Core initialization
  function initializeReviewMode() {
    const params = getUrlParams();
    if (params.mode === 'review') {
      loadQuizData(params.src)
        .then(quizData => {
          state.quizData = quizData;
          state.questions = Array.isArray(quizData) ? quizData : quizData.questions;
          initializeQuizInterface();
        })
        .catch(error => handleError(error));
    }
  }

  // Data handling functions
  function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      mode: urlParams.get('mode'),
      src: urlParams.get('src')
    };
  }

  async function loadQuizData(src) {
    const response = await fetch(`/quizzes/${src}.json`);
    return await response.json();
  }

  // UI components
  function initializeQuizInterface() {
    setTimeout(() => {
      resetQuizState();
      displayQuestion(state.questions[0]);
      setupNavigationControls();
      // Disable submit button in review mode
      const submitBtn = document.getElementById('submitbtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.removeAttribute('onclick');
      }
    }, 50);
  }

  function resetQuizState() {
    state.currentQuestionIndex = 0;
    clearElement('question');
    clearElement('choice_form');
    clearElement('result');
  }

  function displayQuestion(question) {
    updateQuestionText(question);
    createChoiceElements(question);
    displayAnswerResults(question);
  }

  function updateQuestionText(question) {
    const questionEl = document.getElementById('question');
    questionEl.innerHTML = question.q.replace(/\n/g, '<br>');
  }

  function createChoiceElements(question) {
    const choicesForm = document.getElementById('choice_form');
    clearElement(choicesForm);
    
    question.c.forEach((choiceText, index) => {
      choicesForm.appendChild(createChoiceElement(choiceText, index));
    });
  }

  function createChoiceElement(choiceText, index) {
    const answerDiv = document.createElement('div');
    answerDiv.innerHTML = `${choiceLetters[index]}: ${choiceText}`;
    return answerDiv;
  }

  // Answer processing
  function displayAnswerResults(question) {
    const resultEl = document.getElementById('result');
    const answerIndices = getCorrectAnswerIndices(question);
    
    resultEl.innerHTML = buildResultHTML(question, answerIndices);
    highlightCorrectChoices(answerIndices);
  }

  function getCorrectAnswerIndices(question) {
    return question.a.map(answer => 
      question.c.findIndex(c => c.trim().toLowerCase() === answer.trim().toLowerCase())
    ).filter(index => index >= 0);
  }

  function buildResultHTML(question, answerIndices) {
    return `
      <div class="correct"></div>
      <div class="answers">
        ${answerIndices.length > 0 
          ? `<br>Answer: ${answerIndices.map(i => 
            `<span class="correct"> ${question.c[i]}</span>`
          ).join(', ')}`
          : '⚠️ No valid answers found'
        }
      </div>
      <div class="correct">
        ${question.e 
          ? `<br>Explanation: ${question.e.replace(/\n/g, '<br>')}`
          : '<br>No explanation provided'
        }
      </div>
    `;
  }

  function highlightCorrectChoices(answerIndices) {
    const choicesForm = document.getElementById('choice_form');
    answerIndices.forEach(index => {
      if (choicesForm.children[index]) {
        choicesForm.children[index].classList.add('correct');
        choicesForm.children[index].innerHTML += ' ✓';
      }
    });
  }

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

  // Navigation controls
  function setupNavigationControls() {
    createNextButton();
    document.getElementById('nextButton').addEventListener('click', handleNextQuestion);
  }

  function createNextButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.innerHTML = `<input type="button" id="nextButton" value="Next Question">`;
    document.getElementById('choices').appendChild(buttonContainer);
  }

  function handleNextQuestion() {
    if (state.currentQuestionIndex + 1 < state.questions.length) {
      state.currentQuestionIndex++;
      displayQuestion(state.questions[state.currentQuestionIndex]);
    } else {
      endReviewSession();
    }
  }

  // Utility functions
  function clearElement(elementId) {
    const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    element.innerHTML = '';
  }

  function handleError(error) {
    console.error('Error loading quiz data:', error);
    alert('Failed to load quiz data. Please try again.');
  }

  function endReviewSession(sessionId) {
    alert('Review session complete! 🎉');
    deleteEndSession()
    window.location = window.location.origin;
  }

  // Initialization
  document.addEventListener('DOMContentLoaded',initializeReviewMode);
})();