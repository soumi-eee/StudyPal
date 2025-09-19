 // Firebase Auth and App Logic
const auth = firebase.auth();

// Backend API URL - change this to your Flask server URL
const API_BASE_URL = 'http://localhost:8000';

// Global variables
let currentUser = null;
let uploadedFiles = {};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupFileUpload();
    checkAuthState();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('signupBtn').addEventListener('click', signup);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('uploadTab').addEventListener('click', () => showSection('upload'));
    document.getElementById('chatTab').addEventListener('click', () => showSection('chat'));
    document.getElementById('questionsTab').addEventListener('click', () => showSection('questions'));
    
    // Listeners from your full project
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                askAI();
            }
        });
    }
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', askAI);
    }
    
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateQuestions);
    }

    document.getElementById('loginPassword').addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
    document.getElementById('signupPassword').addEventListener('keypress', (e) => { if (e.key === 'Enter') signup(); });
}

// Setup file upload with drag and drop
function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Add click listener to the whole area
    uploadArea.addEventListener('click', (event) => {
        event.preventDefault(); // Prevents page reload
        fileInput.click();      // Opens file explorer
    });
    
    // Add drag and drop listeners
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFileUpload(e.dataTransfer.files);
    });

    // Add change listener to the hidden file input to handle file selection
    fileInput.addEventListener('change', (e) => {
        handleFileUpload(e.target.files);
    });
}

// Authentication Functions
function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return showMessage('Please fill in all fields', 'error');
    showLoading(true);
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            currentUser = userCredential.user;
            showApp();
            showMessage('Welcome back!', 'success');
        })
        .catch((error) => showMessage(getErrorMessage(error.code), 'error'))
        .finally(() => showLoading(false));
}

function signup() {
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    if (!email || !password) return showMessage('Please fill in all fields', 'error');
    if (password.length < 6) return showMessage('Password must be at least 6 characters', 'error');
    showLoading(true);
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            currentUser = userCredential.user;
            showApp();
            showMessage('Account created successfully!', 'success');
        })
        .catch((error) => showMessage(getErrorMessage(error.code), 'error'))
        .finally(() => showLoading(false));
}

function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        uploadedFiles = {};
        showAuth();
        showMessage('Logged out successfully', 'success');
    });
}

function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            showApp();
        } else {
            currentUser = null;
            showAuth();
        }
        showLoading(false);
    });
}

// UI Functions
function showAuth() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('app-section').style.display = 'none';
}

function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }
    showSection('upload');
}

function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${section}-section`).classList.add('active');
    document.querySelectorAll('.nav-links a').forEach(item => item.classList.remove('active'));
    document.getElementById(`${section}Tab`).classList.add('active');
}

function showLoading(show) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }
}

function showMessage(message, type) {
    const messageElement = document.getElementById('authMessage');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    setTimeout(() => { messageElement.style.display = 'none'; }, 5000);
}

function getErrorMessage(code) {
    switch (code) {
        case 'auth/user-not-found': return 'No user found with this email.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/email-already-in-use': return 'This email is already registered.';
        default: return 'An authentication error occurred.';
    }
}

// File Upload Functions
function handleFileUpload(files) {
    for (let file of files) uploadFile(file);
}

async function uploadFile(file) {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) return showUploadResult('Unsupported file type.', 'error');
    if (file.size > 10 * 1024 * 1024) return showUploadResult('File too large (Max 10MB).', 'error');

    const formData = new FormData();
    formData.append('file', file);
    showLoading(true);
    showUploadResult(`Uploading ${file.name}...`, 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok && result.success) {
            uploadedFiles[result.file_id] = result;
            showUploadResult(`✅ ${result.filename} uploaded successfully!`, 'success');
            updateFilesList();
            updateDocumentSelects();
        } else {
            showUploadResult(`❌ ${result.error || 'Upload failed.'}`, 'error');
        }
    } catch (error) {
        showUploadResult('❌ Upload failed. Is the backend server running?', 'error');
    } finally {
        showLoading(false);
    }
}

function showUploadResult(message, type) {
    document.getElementById('uploadResult').innerHTML = `<div class="message ${type}">${message}</div>`;
}

function updateFilesList() {
    const filesList = document.getElementById('filesList');
    if (Object.keys(uploadedFiles).length === 0) {
        filesList.innerHTML = '';
        return;
    }
    let html = '<h4>📁 Uploaded Files:</h4><div class="files-grid">';
    for (let [fileId, fileData] of Object.entries(uploadedFiles)) {
        html += `
            <div class="file-card">
                <div class="file-icon">${fileData.file_type === 'PDF' ? '📄' : '🖼️'}</div>
                <div class="file-info">
                    <div class="file-name">${fileData.filename}</div>
                    <div class="file-details">${fileData.file_type} • ${fileData.text_length} chars</div>
                </div>
                <button class="delete-btn" onclick="removeFile('${fileId}')">🗑️</button>
            </div>`;
    }
    html += '</div>';
    filesList.innerHTML = html;
}

function removeFile(fileId) {
    delete uploadedFiles[fileId];
    updateFilesList();
    updateDocumentSelects();
    showUploadResult('File removed.', 'info');
}

function updateDocumentSelects() {
    const selects = ['documentSelect', 'questionDocument'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select a document</option>';
        for (let [fileId, fileData] of Object.entries(uploadedFiles)) {
            const option = document.createElement('option');
            option.value = fileId;
            option.textContent = fileData.filename;
            select.appendChild(option);
        }
        if (currentValue && uploadedFiles[currentValue]) {
            select.value = currentValue;
        }
    });
}

// AI Chat Functions
async function askAI() {
    const chatInput = document.getElementById('chatInput');
    const question = chatInput.value.trim();
    if (!question) return;

    addChatMessage(question, 'user');
    chatInput.value = '';
    const typingId = addChatMessage('AI is thinking...', 'ai', true);

    try {
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                file_id: document.getElementById('documentSelect').value || null
            })
        });
        const result = await response.json();
        document.getElementById(typingId)?.remove();
        addChatMessage(result.response || result.error, 'ai');
    } catch (error) {
        document.getElementById(typingId)?.remove();
        addChatMessage('Sorry, an error occurred. Is the backend server running?', 'ai');
    }
}

function addChatMessage(message, sender, isTyping = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now();
    messageDiv.id = messageId;
    messageDiv.className = `${sender}-message ${isTyping ? 'typing' : ''}`;
    
    const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');

    if (sender === 'user') {
        messageDiv.innerHTML = `<div class="message-content">${sanitizedMessage}</div>`;
    } else {
        messageDiv.innerHTML = `<div class="message-content"><strong>StudyPal AI:</strong><div>${sanitizedMessage}</div></div>`;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageId;
}

// Generate Questions Functions
async function generateQuestions() {
    const fileId = document.getElementById('questionDocument').value;
    const questionsContainer = document.getElementById('generatedQuestions');
    if (!fileId) {
        questionsContainer.innerHTML = '<div class="message error">Please select a document first.</div>';
        return;
    }
    showLoading(true);
    questionsContainer.innerHTML = '<div class="message info">Generating questions...</div>';
    try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: fileId,
                type: document.querySelector('input[name="questionType"]:checked').value,
                count: parseInt(document.getElementById('questionCount').value)
            })
        });
        const result = await response.json();
        if (result.success) {
            displayGeneratedQuestions(result.questions);
        } else {
            questionsContainer.innerHTML = `<div class="message error">Error: ${result.error}</div>`;
        }
    } catch (error) {
        questionsContainer.innerHTML = '<div class="message error">Failed to generate questions. Is the backend running?</div>';
    } finally {
        showLoading(false);
    }
}

function displayGeneratedQuestions(questions) {
    const container = document.getElementById('generatedQuestions');
    if (!questions || questions.length === 0) {
        container.innerHTML = '<div class="message info">No questions were generated.</div>';
        return;
    }
    let html = '<h4>Generated Questions:</h4><div class="questions-list">';
    questions.forEach((q, index) => {
        html += `<div class="question-item">
                    <div class="question-number">Question ${index + 1}</div>
                    <p class="question-text">${q.question}</p>`;
        if (q.type === 'multiple_choice') {
            html += '<div class="options">';
            q.options.forEach(opt => html += `<label class="option"><input type="radio" name="q${index}"><span>${opt}</span></label>`);
            html += `</div><div class="answer" style="display:none;"><strong>Answer:</strong> ${q.correct_answer}</div>`;
        } else if (q.type === 'true_false') {
            html += `<div class="answer" style="display:none;"><strong>Answer:</strong> ${q.correct_answer}</div>`;
        } else {
            html += `<textarea class="short-answer" placeholder="Your answer..."></textarea>
                     <div class="answer" style="display:none;"><strong>Sample Answer:</strong> ${q.sample_answer}</div>`;
        }
        html += `<button class="show-answer-btn" onclick="toggleAnswer(this)">Show Answer</button></div>`;
    });
    html += `</div><div class="questions-actions">
                <button class="show-all-answers-btn" onclick="toggleAllAnswers(true)">Show All Answers</button>
                <button class="hide-all-answers-btn" onclick="toggleAllAnswers(false)">Hide All Answers</button>
            </div>`;
    container.innerHTML = html;
}

function toggleAnswer(button) {
    const answerDiv = button.closest('.question-item').querySelector('.answer');
    const isHidden = answerDiv.style.display === 'none';
    answerDiv.style.display = isHidden ? 'block' : 'none';
    button.textContent = isHidden ? 'Hide Answer' : 'Show Answer';
}

function toggleAllAnswers(show) {
    document.querySelectorAll('.question-item').forEach(item => {
        item.querySelector('.answer').style.display = show ? 'block' : 'none';
        item.querySelector('.show-answer-btn').textContent = show ? 'Hide Answer' : 'Show Answer';
    });
}