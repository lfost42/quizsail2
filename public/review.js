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
          createEditSelectionModal();
          createEditModal(); // Add this line to create the modal
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
      initializeEditHandlers();
      const submitBtn = document.getElementById('submitbtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.removeAttribute('onclick');
      }
    }, 50);
  }

  function createEditSelectionModal() {
    const modal = document.createElement('div');
    modal.id = 'editSelectionModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <div id="editSelectionContent"></div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('.close').addEventListener('click', () => {
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
    html += `<li data-target-type="question">${truncateText(currentQuestion.q, 40)}</li>`;
    
    // Choices with current text
    currentQuestion.c.forEach((choiceText, index) => {
      html += `<li data-target-type="choice" data-target-index="${index}">
        &#x2022; ${truncateText(choiceText, 30)}
      </li>`;
    });
    // Add a choice
      html += '<li data-target-type="add-choice">➕ Add New Choice</li>';
      // Answer with current values
      html += `<li data-target-type="answer">Answer: ${
      currentQuestion.a.map(a => truncateText(a, 20)).join(', ')
    }</li>`;
  
    // Explanation with current text
    html += `<li data-target-type="explanation">${
      truncateText(currentQuestion.e || "No explanation provided", 40)
    }</li></ul>`;
    
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
    // persistChanges();
  }

  function handleEditSelection(targetType, targetIndex) {
    const currentQuestion = state.questions[state.currentQuestionIndex];
    let content = '';
    if (targetType === 'add-choice') {
      addNewChoice(currentQuestion);
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
          choicesForm.appendChild(createChoiceElement(choiceText, index));
      });
  }

  function createChoiceElement(choiceText, index) {
      const answerDiv = document.createElement('div');
      answerDiv.classList.add('incorrect-answer'); // Default to gray
      answerDiv.innerHTML = `${choiceLetters[index]}: ${choiceText}`;
      answerDiv.appendChild(createResultsDiv('choice', index));
      return answerDiv;
  }


  // Answer processing
  function displayAnswerResults(question) {
    const resultEl = document.getElementById('result');
    const answerIndices = getCorrectAnswerIndices(question);
    
    resultEl.innerHTML = buildResultHTML(question, answerIndices);
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
    return `
      <div class="correct"></div>
        ${answerIndices.length > 0 
          ? `<br>Answer: ${answerIndices.map(i => 
            `<span class="correct-answer"> ${question.c[i]}</span>`
          ).join(', ')}`
          : '⚠️ No valid answers found'
        }
        ${question.e 
          ? `<br><br>${question.e.replace(/\n/g, '<br>')}</div>`
          : '<br><br>No explanation provided'
        }
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

  // Navigation controls
  function setupNavigationControls() {
    createNextButton();
    document.getElementById('editButton').addEventListener('click', openEditSelectionModal);
    document.getElementById('nextButton').addEventListener('click', handleNextQuestion);
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