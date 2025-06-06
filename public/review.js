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
      if (!params.src) {
      alert('Missing quiz source parameter');
      return;
    }
    loadQuizData(params.src)
      .then(quizData => {
        state.quizData = quizData;
        state.questions = Array.isArray(quizData) ? quizData : quizData.questions;
        initializeQuizInterface();
        createEditSelectionModal();
        createEditModal();
        createAnswerEditorModal();
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
  const submitBtn = document.getElementById('submitbtn');
    if (submitBtn) submitBtn.remove();

    resetQuizState();
    displayQuestion(state.questions[0]);
    setupNavigationControls();
    setupKeyboardNavigation();
    initializeEditHandlers();
}

function createEditSelectionModal() {
  const modal = document.createElement('div');
  modal.id = 'editSelectionModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-modal">&times;</span>
      <div id="editSelectionContent"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

function createResultsDiv() {
  const container = document.createElement('div');
  return container;
}

function openEditSelectionModal() {
  const modal = document.getElementById('editSelectionModal');
  const contentDiv = modal.querySelector('#editSelectionContent');
  const currentQuestion = state.questions[state.currentQuestionIndex];
  
  let html = '<h3>Select Element to Edit</h3><ul>';
  // Question with current text
  html += `<li data-target-type="question" class="truncate-item">❓ ${currentQuestion.q}</li>`;
  
  // Choices with current text
  currentQuestion.c.forEach((choiceText, index) => {
    html += `<li data-target-type="choice" data-target-index="${index}" class="truncate-item">${choiceText}</li>`;
  });
  // Add a choice
    html += '<li data-target-type="add-choice">☐ ➕ [ Add New Choice ]</li>';

  // Add Answer button
  html += `<li data-target-type="answer">✅ Edit Answer</li>`;

  // Explanation with current text
  html += `<li data-target-type="explanation" class="truncate-item">📖 ${currentQuestion.e}</li></ul>`;
  
  contentDiv.innerHTML = html;
  
  // Add click handlers (existing code)
  contentDiv.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', (e) => {
      const targetType = li.dataset.targetType;
      const targetIndex = li.dataset.targetIndex ? parseInt(li.dataset.targetIndex) : null;
      handleEditSelection(targetType, targetIndex);
      modal.style.display = 'none';
    });
  });
  modal.style.display = 'block';
}

// Add utility function to truncate long text
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

// New function to handle choice addition
function addNewChoice(currentQuestion) {
  // Create new choice with default text
  const newChoice = "New Choice";
  currentQuestion.c.push(newChoice);
  
  // Open edit modal for the new choice
  const newIndex = currentQuestion.c.length - 1;
  handleEditSelection('choice', newIndex);
  
  // Refresh UI
  displayQuestion(currentQuestion);
}

function createEditModal() {
  const modal = document.createElement('div');
  modal.id = 'EditModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <div id="editModalContent"></div>
      <textarea id="modalTextarea" placeholder="Enter new text..."></textarea>
      <div class="modal-buttons">
        <button id="modalBack">Back</button>
        <button id="modalSubmit">Submit</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add new back button handler
  modal.querySelector('#modalBack').addEventListener('click', () => {
    closeEditModal();
    document.getElementById('editSelectionModal').style.display = 'block';
  });
  modal.querySelector('.close').addEventListener('click', closeEditModal);

  // Existing close handlers
  modal.querySelector('.close').addEventListener('click', closeEditModal);

  modal.querySelector('#modalSubmit').addEventListener('click', () => {
    const editType = modal.dataset.editType;
    const targetType = modal.dataset.targetType;
    const targetIndex = modal.dataset.targetIndex ? parseInt(modal.dataset.targetIndex) : null;
    const content = modal.querySelector('#modalTextarea').value.trim();
    handleModalSubmit(editType, content, targetType, targetIndex);
    closeEditModal();
  });
}

function openEditModal(content, editType, targetType, targetIndex) {
  const modal = document.getElementById('EditModal'); // Corrected ID
  modal.dataset.editType = editType;
  modal.dataset.targetType = targetType;
  modal.dataset.targetIndex = targetIndex;

  const contentDiv = modal.querySelector('#editModalContent');
  contentDiv.innerHTML = `
    <h3>Edit ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}</h3>
  `;

  const textarea = modal.querySelector('#modalTextarea');
  textarea.value = content;
  modal.style.display = 'block';
}

function handleModalSubmit(editType, content, targetType, targetIndex) {
  const currentQuestion = state.questions[state.currentQuestionIndex];
  
  switch(targetType) {
    case 'question':
      currentQuestion.q = content;
      updateQuestionText(currentQuestion);
      break;
      
    case 'choice':
      currentQuestion.c[targetIndex] = content;
      createChoiceElements(currentQuestion);
      break;
      
    case 'explanation':
      currentQuestion.e = content;
      refreshExplanationDisplay();
      break;
      
    case 'answer':
      currentQuestion.a = content.split(',').map(s => s.trim());
      refreshAnswerDisplay();
      break;
  }

  persistChanges().catch(error => {
    console.error('Failed to persist changes:', error);
    alert('Failed to save changes to server. Your edits may be lost.');
  });
}

function handleEditSelection(targetType, targetIndex) {
  const currentQuestion = state.questions[state.currentQuestionIndex];
  let content = '';
  if (targetType === 'add-choice') {
    addNewChoice(currentQuestion);
    return;
  }
  if (targetType === 'answer') {
    openAnswerEditorModal();
    return;
  }
  switch(targetType) {
    case 'question': content = currentQuestion.q; break;
    case 'choice': content = currentQuestion.c[targetIndex]; break;
    case 'explanation': content = currentQuestion.e || ''; break;
    case 'answer': content = currentQuestion.a.join(', '); break;
  }
  openEditModal(content, 'edit', targetType, targetIndex);
}

async function persistChanges() {
  const params = new URLSearchParams(window.location.search);
  const quizName = params.get('src');

  try {
    const response = await fetch('/edit-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizName: quizName,
        content: state.questions
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save edit');
    }

    // console.log('Edits saved successfully!');
  } catch (error) {
    console.error('Edit failed:', error);
    alert(`Edit failed: ${error.message}`);
  }
}

function createAnswerEditorModal() {
  const modal = document.createElement('div');
  modal.id = 'answerEditorModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-modal">&times;</span>
      <div class="answer-section">
        <h4>Correct Answers</h4>
        <div id="selectedAnswers" class="answer-list"></div>
      </div>
      <div class="answer-section">
        <h4>Incorrect Answers</h4>
        <div id="unselectedAnswers" class="answer-list"></div>
      </div>
      <div class="modal-buttons">
        <button id="answerEditorBack">Back</button>
        <button id="answerEditorSubmit">Submit</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.querySelector('#answerEditorBack').addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

function openAnswerEditorModal() {
  const modal = document.getElementById('answerEditorModal');
  if (!modal) return;
  
  const currentQuestion = state.questions[state.currentQuestionIndex];
  const selectedContainer = modal.querySelector('#selectedAnswers');
  const unselectedContainer = modal.querySelector('#unselectedAnswers');
  
  selectedContainer.innerHTML = '';
  unselectedContainer.innerHTML = '';
  
  // Create choice elements for both lists
  currentQuestion.c.forEach((choiceText, index) => {
    const isSelected = currentQuestion.a.includes(choiceText);
    const container = isSelected ? selectedContainer : unselectedContainer;
    
    const choiceEl = document.createElement('div');
    choiceEl.className = 'answer-choice';
    choiceEl.innerHTML = `
      <div class="choice-text">${processTextWithCode(choiceText)}</div>
    `;

    choiceEl.addEventListener('click', () => {
      const index = currentQuestion.c.indexOf(choiceText);
      if (index === -1) return;
      
      if (isSelected) {
        // Remove from selected answers
        const answerIndex = currentQuestion.a.indexOf(choiceText);
        if (answerIndex > -1) {
          currentQuestion.a.splice(answerIndex, 1);
        }
      } else {
        // Add to selected answers
        currentQuestion.a.push(choiceText);
      }
      
      // Reopen modal to refresh lists
      openAnswerEditorModal();
    });
    
    container.appendChild(choiceEl);
  });
  
  // Save button handler
  const saveButton = modal.querySelector('#answerEditorSubmit');
  saveButton.onclick = () => {
    modal.style.display = 'none';
    refreshAnswerDisplay();
    persistChanges().catch(error => {
      console.error('Failed to save answer changes:', error);
      alert('Failed to save answer changes');
    });
  };
  
  modal.style.display = 'block';
}

function displayAnswerResults(question) {
  const resultEl = document.getElementById('result');
  const answerIndices = getCorrectAnswerIndices(question);
  
  resultEl.innerHTML = buildResultHTML(question, answerIndices);
  
  // Add event listener to the new Edit Answer button
  const editAnswerBtn = document.getElementById('editAnswerButton');
  if (editAnswerBtn) {
    editAnswerBtn.addEventListener('click', openAnswerEditorModal);
  }
  
  highlightCorrectChoices(answerIndices);
}

function refreshExplanationDisplay() {
  const resultEl = document.getElementById('result');
  const answerIndices = getCorrectAnswerIndices(state.questions[state.currentQuestionIndex]);
  resultEl.innerHTML = buildResultHTML(state.questions[state.currentQuestionIndex], answerIndices);
}

function refreshAnswerDisplay() {
  const resultEl = document.getElementById('result');
  const answerIndices = getCorrectAnswerIndices(state.questions[state.currentQuestionIndex]);
  resultEl.innerHTML = buildResultHTML(state.questions[state.currentQuestionIndex], answerIndices);
  highlightCorrectChoices(answerIndices);
}

function closeEditModal() {
  document.getElementById('EditModal').style.display = 'none';
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
  updateNavigationButtons();
}

function updateQuestionText(question) {
  const questionEl = document.getElementById('question');
  questionEl.innerHTML = question.q.replace(/\n/g, '<br>');
  questionEl.appendChild(createResultsDiv('question'));
}

function createChoiceElements(question) {
  const choicesForm = document.getElementById('choice_form');
  clearElement(choicesForm);
  
  question.c.forEach((choiceText, index) => {
    const div = document.createElement('div');
    div.className = 'choice-item';
    div.innerHTML = `
      <span class="choice-letter">${choiceLetters[index]}:</span>
      <div class="choice-text">${choiceText}</div>
    `;
    choicesForm.appendChild(div);
  });
}

// Answer processing
function displayAnswerResults(question) {
  const resultEl = document.getElementById('result');
  const answerIndices = getCorrectAnswerIndices(question);
  
  resultEl.innerHTML = buildResultHTML(question, answerIndices);
  
  // Add event listener to the new Edit Answer button
  const editAnswerBtn = document.getElementById('editAnswerButton');
  if (editAnswerBtn) {
    editAnswerBtn.addEventListener('click', openAnswerEditorModal);
  }
  
  highlightCorrectChoices(answerIndices);
}

function initializeEditHandlers() {
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-button');
    if (!btn) return;

    const editType = btn.dataset.editType;
    const targetType = btn.dataset.targetType;
    const targetIndex = btn.dataset.targetIndex;
    const currentQuestion = state.questions[state.currentQuestionIndex];

    let content = '';
    switch(targetType) {
      case 'question':
        content = currentQuestion.q;
        break;
      case 'choice':
        content = currentQuestion.c[targetIndex];
        break;
      case 'explanation':
        content = currentQuestion.e || '';
        break;
      case 'answer':
        content = currentQuestion.a.join(', ');
        break;
    }

    openEditModal(content, editType, targetType, targetIndex);
  });
}

function getCorrectAnswerIndices(question) {
  return question.a.map(answer => 
    question.c.findIndex(c => c.trim().toLowerCase() === answer.trim().toLowerCase())
  ).filter(index => index >= 0);
}

function buildResultHTML(question, answerIndices) {
  const answerHtml = answerIndices.length > 0 
    ? `✅ ${answerIndices.map(i => 
        `<span class="correct-answer">${processTextWithCode(question.c[i])}</span>`
      ).join(', ')}`
    : '⚠️ No valid answers found';
  
  const explanationHtml = question.e 
    ? `<br><br>${processTextWithCode(question.e)}`
    : '<br><br>No explanation provided';
  
  return `
    <div class="correct">
      <br>${answerHtml}
      ${explanationHtml}
    </div>
  `;
}

function highlightCorrectChoices(answerIndices) {
  const choicesForm = document.getElementById('choice_form');
  Array.from(choicesForm.children).forEach(choice => {
  choice.classList.remove('correct', 'incorrect-answer');
});
  answerIndices.forEach(index => {
    if (choicesForm.children[index]) {
      choicesForm.children[index].classList.add('correct-answer');
    }
  });
  // Add incorrect-answer class to non-correct choices
  Array.from(choicesForm.children).forEach((choice, idx) => {
  if (!answerIndices.includes(idx)) {
    choice.classList.add('incorrect-answer');
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

function escapeInsideCodeBlocks(text) {
    if (!text) return text; // handle undefined or null
    return text.replace(/<code>[\s\S]*?<\/code>/g, function(match) {
        let inner = match.substring(6, match.length - 7);
        inner = inner.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
        return '<code>' + inner + '</code>';
    });
}

function processQuestionText(text) {
    if (!text) return text;
    // Split by code blocks (with capturing group to keep them)
    let segments = text.split(/(<code>[\s\S]*?<\/code>)/g);
    let processed = '';

    for (let segment of segments) {
        if (segment.startsWith('<code>') && segment.endsWith('</code>')) {
            processed += segment;
        } else {
            processed += segment.replace(/\n/g, '<br>');
        }
    }
    return escapeInsideCodeBlocks(processed);
}

function updateQuestionText(question) {
  const questionEl = document.getElementById('question');
  questionEl.innerHTML = processTextWithCode(question.q);
  questionEl.appendChild(createResultsDiv('question'));
}

function createChoiceElements(question) {
  const choicesForm = document.getElementById('choice_form');
  clearElement(choicesForm);
  
  question.c.forEach((choiceText, index) => {
    const div = document.createElement('div');
    div.className = 'choice-item';
    div.innerHTML = `
      <span class="choice-letter">${choiceLetters[index]}:</span>
      <div class="choice-text">${processTextWithCode(choiceText)}</div>
    `;
    choicesForm.appendChild(div);
  });
}

// Navigation controls
function setupNavigationControls() {
  createNextButton();
  document.getElementById('editButton').addEventListener('click', openEditSelectionModal);
  document.getElementById('nextButton').addEventListener('click', handleNextQuestion);
}

function createNavigationButtons() {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'review-buttons';
  buttonContainer.innerHTML = `
    <button id="backButton" class="nav-button circle-button" aria-label="Previous question">
      <span class="nav-arrow">ᐸ</span>
    </button>
    <button id="editButton" class="nav-button">Edit</button>
    <button id="nextButton" class="nav-button circle-button" aria-label="Next question">
      <span class="nav-arrow">ᐳ</span>
    </button>
  `;
  document.getElementById('choices').appendChild(buttonContainer);
}

function setupNavigationControls() {
  createNavigationButtons();
  document.getElementById('editButton').addEventListener('click', openEditSelectionModal);
  document.getElementById('nextButton').addEventListener('click', handleNextQuestion);
  document.getElementById('backButton').addEventListener('click', handlePreviousQuestion);
  updateNavigationButtons(); // Initialize button states
}

function handlePreviousQuestion() {
  if (state.currentQuestionIndex > 0) {
    state.currentQuestionIndex--;
    displayQuestion(state.questions[state.currentQuestionIndex]);
    updateNavigationButtons();
  }
}

function updateNavigationButtons() {
  const backButton = document.getElementById('backButton');
  const nextButton = document.getElementById('nextButton');
  
  if (backButton && nextButton) {
    backButton.disabled = state.currentQuestionIndex === 0;
    nextButton.disabled = state.currentQuestionIndex === state.questions.length - 1;
  }
}

function createNextButton() {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'review-buttons'; // Add class
  buttonContainer.innerHTML = `
    <input type="button" id="editButton" value="Edit">
    <input type="button" id="nextButton" value="Next">
  `;
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

// Add this function to set up keyboard navigation
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (event) => {
        // Ignore if any modal is open
        const editSelectionModal = document.getElementById('editSelectionModal');
        const editModal = document.getElementById('EditModal');
        if ((editSelectionModal && editSelectionModal.style.display === 'block') || 
            (editModal && editModal.style.display === 'block')) {
            return;
        }
        
        // Ignore if focused on input/textarea
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        switch (event.key) {
            case 'ArrowLeft':
                if (!document.getElementById('backButton').disabled) {
                    handlePreviousQuestion();
                }
                break;
            case 'ArrowRight':
                if (!document.getElementById('nextButton').disabled) {
                    handleNextQuestion();
                }
                break;
        }
    });
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

function endReviewSession() {
  alert('Review session complete! 🎉');
  deleteEndSession()
  window.location = window.location.origin;
}

// Initialization
document.addEventListener('DOMContentLoaded',initializeReviewMode);

})();