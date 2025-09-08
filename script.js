// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// DOM Elements
const pdfViewer = document.getElementById('pdfViewer');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
const chatHistory = document.getElementById('chatHistory');
const uploadStatus = document.getElementById('uploadStatus');
const pageJumpInput = document.getElementById('pageJumpInput');
const jumpToPageBtn = document.getElementById('jumpToPage');
const questionInput = document.getElementById('questionInput');
const submitQuestionBtn = document.getElementById('submitQuestionBtn');
const questionsContainer = document.getElementById('questionsContainer');

// State management
let currentPDF = null;
let currentPage = 1;
let pageCount = 0;
let isProcessing = false;
let activeTab = 'ask-ai';

// API Configuration
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const GEMINI_API_KEY = 'AIzaSyCR0ZP97p6vnI13jBCuRQgeQbSKUyc3L1U';

// Add cache for AI responses
let answerCache = {};

// Retry function for API calls
async function apiCallWithRetry(url, options, maxRetries = 3, baseDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // If it's a 503 (overloaded) error, retry with exponential backoff
            if (response.status === 503 && attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            // Wait before retrying
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Consolidated AI response function
async function getAIResponse(question, userAnswer = "", context = "") {
    const cacheKey = `${question}-${userAnswer}-${context}`;

    if (answerCache[cacheKey]) {
        return answerCache[cacheKey];
    }

    let messages = [
        {
            role: "system",
            content: "You are an educational assistant evaluating answers. Your response MUST be in this exact JSON format:\n" +
                "{\n" +
                "  \"feedback\": \"Detailed analysis of the submitted answer, including:\n" +
                "   - What's correct in the answer\n" +
                "   - What's missing or incorrect\n" +
                "   - Suggestions for improvement\n" +
                "   - Key points that should be included\",\n" +
                "  \"correctAnswer\": \"The complete correct answer based on the PDF content\"\n" +
                "}\n" +
                "Make sure to:\n" +
                "1. Be specific and accurate in your feedback\n" +
                "2. Focus on the content from the PDF\n" +
                "3. Provide constructive criticism\n" +
                "4. Highlight both strengths and areas for improvement"
        }
    ];

    if (context) {
        messages.push({ role: "user", content: `Context from PDF: ${context}` });
    }

    messages.push({ role: "user", content: `Question: ${question}` });

    if (userAnswer) {
        messages.push({ role: "user", content: `User's Answer: ${userAnswer}` });
    }

    try {
        // Convert messages to Gemini format
        const prompt = messages.map(msg => {
            if (msg.role === 'system') {
                return `Instructions: ${msg.content}`;
            } else if (msg.role === 'user') {
                return `User: ${msg.content}`;
            }
            return msg.content;
        }).join('\n\n');

        const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 0.5,
                    maxOutputTokens: 1500,
                    stopSequences: []
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response.";

        let answer;
        try {
            answer = JSON.parse(responseText);
        } catch (e) {
            answer = {
                feedback: responseText,
                correctAnswer: ""
            };
        }

        answerCache[cacheKey] = answer;
        return answer;
    } catch (error) {
        console.error('Gemini API request error:', error);
        if (error.message.includes('API_KEY')) {
            throw new Error('Invalid Gemini API key. Please check your API key.');
        }
        throw new Error(`Failed to get AI response: ${error.message}`);
    }
}

// Tab switching functionality
function switchTab(tabName) {
    // Update active tab
    activeTab = tabName;
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-tab') === tabName) {
            nav.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    setTimeout(() => {
        const activeTabElement = document.getElementById(tabName + '-tab');
        if (activeTabElement) {
            activeTabElement.classList.add('active');
        }
    }, 150);
}

// Handle ask AI question submission
function handleAskAI() {
    const question = questionInput?.value?.trim();
    if (question) {
        handleQuestion(question);
    }
}

// Load PDF page
async function loadPage(pageNumber) {
    try {
        if (!currentPDF) {
            throw new Error('No PDF loaded');
        }

        const page = await currentPDF.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        pdfViewer.innerHTML = '';
        pdfViewer.appendChild(canvas);

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        currentPage = pageNumber;
        pageInfo.textContent = `Page ${currentPage} of ${pageCount}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= pageCount;

    } catch (error) {
        console.error('Error loading page:', error);
        showError('Failed to load PDF page');
    }
}

// Load PDF file
async function loadPDF(file) {
    try {
        if (!file || file.type !== 'application/pdf') {
            throw new Error('Please select a valid PDF file');
        }

        if (file.size > 10 * 1024 * 1024) {
            throw new Error('PDF file is too large (max 10MB)');
        }

        uploadStatus.textContent = 'Loading PDF...';

        const arrayBuffer = await file.arrayBuffer();
        currentPDF = await pdfjsLib.getDocument(arrayBuffer).promise;
        pageCount = currentPDF.numPages;

        uploadStatus.textContent = `PDF loaded: ${file.name}`;
        pageInfo.textContent = `Page ${currentPage} of ${pageCount}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= pageCount;

        await loadPage(1);

        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        pageInfo.style.display = 'inline-block';

    } catch (error) {
        console.error('PDF loading error:', error);
        uploadStatus.textContent = `Error: ${error.message}`;
        resetPDFState();
    }
}

// Get text from current page
async function getCurrentPageText() {
    try {
        if (!currentPDF) return '';
        const page = await currentPDF.getPage(currentPage);
        const textContent = await page.getTextContent();
        return textContent.items.map(item => item.str).join(' ').trim();
    } catch (error) {
        console.error('Error getting current page text:', error);
        return '';
    }
}

// Extract relevant text for question
async function extractRelevantText(question) {
    if (!currentPDF) return "";
    const page = await currentPDF.getPage(currentPage);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str).join(" ");
    return text.includes(question) ? text : "No relevant text found.";
}

// Levenshtein distance implementation
function levenshtein(a, b) {
    let tmp, i, j, prev, val, row;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    if (a.length > b.length) { tmp = a; a = b; b = tmp; }

    row = Array(a.length + 1).fill(0).map((_, i) => i);

    for (i = 1; i <= b.length; i++) {
        prev = i;
        for (j = 1; j <= a.length; j++) {
            val = (b[i - 1] === a[j - 1]) ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            row[j - 1] = prev;
            prev = val;
        }
        row[a.length] = prev;
    }
    return row[a.length];
}

// String similarity function
function stringSimilarity(str1, str2) {
    let len1 = str1.length, len2 = str2.length;
    let maxLen = Math.max(len1, len2);
    let distance = levenshtein(str1, str2);
    return 1 - (distance / maxLen);
}

// Answer comparison function
function isAnswerCorrect(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    let userClean = userAnswer.toLowerCase().trim();
    let correctClean = correctAnswer.toLowerCase().trim();
    let similarity = stringSimilarity(userClean, correctClean);
    return similarity > 0.75;
}

// Compare words between answers
function compareWords(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return { missingWords: [], incorrectWords: [] };

    userAnswer = userAnswer.toLowerCase().trim();
    correctAnswer = correctAnswer.toLowerCase().trim();

    let userWords = new Set(userAnswer.split(/\s+/).filter(word => word.length > 0));
    let correctWords = new Set(correctAnswer.split(/\s+/).filter(word => word.length > 0));

    let missingWords = [...correctWords].filter(word => !userWords.has(word));
    let incorrectWords = [...userWords].filter(word => !correctWords.has(word));

    return { missingWords, incorrectWords };
}

// Check for short answers
function handleShortAnswers(userAnswer) {
    userAnswer = userAnswer.trim().toLowerCase();
    if (userAnswer === "i don't know" || userAnswer.length < 5) {
        return {
            feedback: "Your answer is too short or doesn't provide relevant information. Please elaborate more on the topic."
        };
    }
    return null;
}

// Show feedback in UI
function showFeedback(message, button, userAnswer = "", correctAnswer = "") {
    const questionContainer = button.closest('.question-container');
    if (!questionContainer) return;

    const feedbackContent = questionContainer.querySelector('.feedback-content');
    if (!feedbackContent) return;

    let feedbackHTML = `
        <div class="feedback-message">
            <div class="feedback-section">
                <strong>Feedback on Your Answer:</strong>
                <div class="feedback-content">
                    ${message}
                </div>
            </div>
    `;

    // Add AI's detailed feedback if available
    if (message.includes("needs some improvements")) {
        feedbackHTML += `
            <div class="feedback-details">
                <div class="changes-needed">
                    <strong>Changes Needed:</strong>
                    <div class="feedback-content">
                        ${message}
                    </div>
                </div>
                <div class="improved-answer">
                    <strong>Improved Answer:</strong>
                    <div class="answer-content">${correctAnswer}</div>
                </div>
            </div>
        `;
    }

    feedbackHTML += `</div>`;
    feedbackContent.innerHTML = feedbackHTML;
}

// Handle answer submission
async function handleAnswerSubmission(question, userAnswer, button) {
    if (isProcessing) return;

    isProcessing = true;
    button.disabled = true;
    button.textContent = 'Checking Answer...';
    hideError();

    try {
        const shortAnswerCheck = handleShortAnswers(userAnswer);
        if (shortAnswerCheck) {
            showFeedback(shortAnswerCheck.feedback, button);
            return;
        }

        const currentPageText = await getCurrentPageText();

        // Get feedback and correct answer using Gemini API with retry logic
        const response = await apiCallWithRetry(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an educational assistant. Based on the PDF content below, evaluate the user's answer to the question and provide feedback.

PDF Content:
${currentPageText}

Question: ${question}
User's Answer: ${userAnswer}

Please provide:
1. Feedback on the user's answer (what's correct, what's missing, suggestions for improvement)
2. The correct/complete answer based on the PDF content

Format your response clearly with feedback first, then the correct answer.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topK: 10,
                    topP: 0.8,
                    maxOutputTokens: 800,
                    stopSequences: []
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Sorry, I couldn't evaluate your answer.";

        // Parse the AI response to determine if answer is good or needs improvement
        const responseText = aiResponse.toLowerCase();

        // Check if the user's answer is obviously insufficient
        const insufficientAnswers = [
            'i dont know', "i don't know", 'i do not know',
            'no idea', 'not sure', 'maybe', 'yes', 'no',
            'i think', 'probably', 'possibly'
        ];

        const isInsufficientAnswer = insufficientAnswers.some(phrase =>
            userAnswerLower === phrase || userAnswerLower.startsWith(phrase + ' ') || userAnswerLower.endsWith(' ' + phrase));

        // Check for clear negative indicators about the user's answer specifically
        const strongNegativeIndicators = [
            'completely insufficient', 'insufficient', 'lack of understanding',
            'prevents any learning', 'needs to actively engage', 'doesn\'t demonstrate',
            'stating "i don\'t know"', 'simply stating', 'too brief', 'too vague'
        ];

        const hasStrongNegative = strongNegativeIndicators.some(indicator =>
            responseText.includes(indicator));

        // Check if AI response starts with positive assessment of the user's answer
        const startsWithPositive = responseText.match(/^(good|excellent|correct|well done|accurate|right answer)/);

        // More strict evaluation - only consider good if:
        // 1. Answer is substantial (>= 25 characters)
        // 2. Not an insufficient/vague answer
        // 3. AI doesn't indicate strong negatives about the answer
        // 4. AI response starts with positive assessment
        const isShortAnswer = userAnswer.length < 25;

        let isGoodAnswer = false;
        if (!isInsufficientAnswer &&
            !isShortAnswer &&
            !hasStrongNegative &&
            startsWithPositive &&
            userAnswer.length >= 25) {
            isGoodAnswer = true;
        }

        if (isGoodAnswer) {
            showFeedback("✅ Good answer! " + aiResponse, button);
        } else {
            let feedbackMessage = "❌ Your answer needs improvement.\n\n";

            if (isInsufficientAnswer) {
                feedbackMessage = "❌ Your answer shows lack of engagement with the material. Please provide a substantive response.\n\n";
            } else if (isShortAnswer) {
                feedbackMessage = "❌ Your answer is too brief. Please provide more detail and explanation.\n\n";
            }

            showFeedback(feedbackMessage + aiResponse, button, userAnswer);
        }

    } catch (error) {
        console.error('API Error:', error);
        showError("Sorry, there was an error checking your answer. Please try again.");
    } finally {
        isProcessing = false;
        button.disabled = false;
        button.textContent = 'Submitted';
    }
}

// Handle question submission
async function handleQuestion(question = null) {
    if (isProcessing) return;

    if (!currentPDF) {
        showError('Please upload a PDF file first.');
        return;
    }

    if (!question) {
        showError('Please provide a question.');
        return;
    }

    isProcessing = true;
    hideError();

    try {
        const currentPageText = await getCurrentPageText();

        if (!currentPageText || currentPageText.trim().length < 10) {
            throw new Error('No content found on the current page.');
        }

        addMessageToChat('user', question);

        // Use a direct approach to answer questions with retry logic
        const response = await apiCallWithRetry(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Based on the following content from the PDF, please answer this question clearly and concisely:

Question: ${question}

PDF Content:
${currentPageText}

Please provide a direct, informative answer based only on the content provided.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topK: 10,
                    topP: 0.8,
                    maxOutputTokens: 500,
                    stopSequences: []
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Sorry, I couldn't generate an answer. Please try again.";

        addMessageToChat('ai', answer);
        
        // Clear the input
        if (questionInput) {
            questionInput.value = '';
        }

    } catch (error) {
        console.error('API Error:', error);
        showError(`Failed to process question: ${error.message}`);
    } finally {
        isProcessing = false;
    }
}

// Generate questions with retry logic
async function generateQuestions() {
    if (isProcessing) return;

    if (!currentPDF) {
        showError('Please upload a PDF file first.');
        return;
    }

    isProcessing = true;
    generateQuestionsBtn.disabled = true;
    generateQuestionsBtn.textContent = 'Generating...';
    hideError();

    const questionsDiv = document.createElement('div');
    questionsDiv.className = 'message ai-message';

    try {
        const currentPageText = await getCurrentPageText();

        if (!currentPageText || currentPageText.trim().length < 50) {
            throw new Error('Not enough content on this page to generate meaningful questions.');
        }

        // Try API call with retry logic
        const response = await apiCallWithRetry(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Based on the following text content, generate exactly 5 important study questions. Format each question on a new line starting with 'Q: '. Make the questions clear, specific, and educational.

Text content:
${currentPageText}

Generate 5 questions now:`
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 10,
                    topP: 0.8,
                    maxOutputTokens: 800,
                    stopSequences: []
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 503) {
                throw new Error('AI service is temporarily overloaded. Please try again in a few moments.');
            }
            throw new Error(`Gemini API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const generatedContent = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No questions generated.";

        // Extract questions that start with "Q:"
        const questionLines = generatedContent.split('\n').filter(line =>
            line.trim().startsWith('Q:') || line.match(/^\d+\./));

        if (questionLines.length === 0) {
            // Fallback: split by common patterns
            const fallbackQuestions = generatedContent.split(/\n/).filter(line =>
                line.includes('?') && line.length > 10);

            if (fallbackQuestions.length > 0) {
                questionLines.push(...fallbackQuestions.slice(0, 5));
            }
        }

        if (questionLines.length === 0) {
            throw new Error('No questions could be extracted from the generated content.');
        }

        const formattedQuestions = questionLines.slice(0, 5).map((q, index) => {
            // Clean up the question text
            let questionText = q.replace(/^(Q:|Q\d+:|Question \d+:|\d+\.)\s*/, '').trim();
            if (!questionText.endsWith('?')) {
                questionText += '?';
            }

            return `
                <div class="question-item" id="question-${index + 1}">
                    <h3>Question ${index + 1}</h3>
                    <p>${questionText}</p>
                    <div class="answer-form" style="margin-top: 1rem;">
                        <textarea class="answer-input" placeholder="Enter your answer here..." style="width: 100%; margin-bottom: 1rem;"></textarea>
                        <button class="submit-answer-btn" onclick="submitAnswer('${questionText.replace(/'/g, "\\'")}', this)">Submit Answer</button>
                        <div class="feedback-content" style="margin-top: 1rem;"></div>
                    </div>
                </div>
            `;
        }).join('');

        questionsContainer.innerHTML = formattedQuestions;

        // Switch to questions tab and scroll to first question
        switchTab('generate-questions');
        setTimeout(() => {
            const firstQuestionElement = document.getElementById('question-1');
            if (firstQuestionElement) {
                firstQuestionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 300);

    } catch (error) {
        console.error('API Error:', error);
        // Fallback mechanism for API failure
        if (error.message.includes('AI service is temporarily overloaded') || error.message.includes('Failed to fetch') || error.message.includes('Unknown error')) {
            console.warn('API completely unavailable, using fallback questions');
            const fallbackQuestions = [
                "What is the main topic or subject discussed in this page?",
                "What are the key points or important concepts mentioned?",
                "Can you identify any definitions or explanations provided?",
                "What examples or illustrations are given on this page?",
                "How does this content relate to the overall document theme?"
            ];

            // Remove loading message if it exists
            const loadingMessage = document.querySelector('.loading-message');
            if (loadingMessage) {
                chatHistory.removeChild(loadingMessage);
            }

            const formattedQuestions = fallbackQuestions.map((questionText, index) => {
                return `
                    <div class="question-container" id="question-${index + 1}">
                        <div class="question-content">
                            <div class="question-link" onclick="selectQuestion('${questionText.replace(/'/g, "\\'")}')">${index + 1}. ${questionText}</div>
                            <div class="answer-form">
                                <textarea class="answer-input" placeholder="Enter your answer here..."></textarea>
                                <button class="submit-answer-btn" onclick="submitAnswer('${questionText.replace(/'/g, "\\'")}', this)">Submit Answer</button>
                            </div>
                        </div>
                        <div class="feedback-content"></div>
                    </div>
                `;
            }).join('');

            questionsDiv.innerHTML = `<strong>AI:</strong> ⚠️ AI service unavailable. Here are general study questions for page ${currentPage}:<br><br>${formattedQuestions}`;
            chatHistory.appendChild(questionsDiv);

            setTimeout(() => {
                const firstQuestion = document.getElementById('question-1');
                if (firstQuestion) {
                    firstQuestion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 100);

            return; // Exit early since we provided fallback questions
        }
        // General error handling for other issues
        showError(`Failed to generate questions: ${error.message}`);
    } finally {
        isProcessing = false;
        generateQuestionsBtn.disabled = false;
        generateQuestionsBtn.textContent = 'Generate Questions';
    }
}

// Helper functions
function selectQuestion(question) {
    // This function now just triggers the AI to answer the question directly
    handleQuestion(question);
}

function submitAnswer(question, button) {
    const answerForm = button.parentElement;
    const answerInput = answerForm.querySelector('.answer-input');
    const userAnswer = answerInput.value.trim();

    if (!userAnswer) {
        showError('Please enter your answer before submitting.');
        return;
    }

    answerInput.disabled = true;
    button.disabled = true;
    button.textContent = 'Checking Answer...';

    handleAnswerSubmission(question, userAnswer, button);
}

function addMessageToChat(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = `<strong>${role === 'user' ? 'You' : 'AI'}:</strong> ${content}`;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showError(message) {
    let errorDiv = document.getElementById("error-message");
    errorDiv.innerText = message;
    errorDiv.style.display = "block";
}

function hideError() {
    let errorDiv = document.getElementById("error-message");
    errorDiv.style.display = "none";
}

function resetPDFState() {
    currentPDF = null;
    currentPage = 1;
    pageCount = 0;
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    pageInfo.style.display = 'none';
    pdfViewer.innerHTML = 'Please upload a PDF file';
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Navigation event listeners
    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            if (tabName) {
                switchTab(tabName);
            }
        });
    });

    // File input event listener
    if (document.getElementById('fileInput')) {
        document.getElementById('fileInput').addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                loadPDF(file);
            }
        });
    }

    // Navigation buttons
    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (currentPage > 1) loadPage(currentPage - 1);
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (currentPage < pageCount) loadPage(currentPage + 1);
    });

    if (jumpToPageBtn) jumpToPageBtn.addEventListener('click', () => {
        const pageNumber = parseInt(pageJumpInput.value);
        if (pageNumber >= 1 && pageNumber <= pageCount) {
            loadPage(pageNumber);
        }
    });

    // Chat input event listeners
    if (submitQuestionBtn) {
        submitQuestionBtn.addEventListener('click', handleAskAI);
    }

    if (questionInput) {
        questionInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskAI();
            }
        });
    }

    // Generate questions button
    if (generateQuestionsBtn) {
        generateQuestionsBtn.addEventListener('click', generateQuestions);
    }

    // Initialize with Ask AI tab active
    switchTab('ask-ai');
});

// Event listeners
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            await loadPDF(file);
        } catch (error) {
            console.error('Error loading PDF:', error);
            showError(error.message);
        }
    }
});

prevBtn.addEventListener('click', () => {
    if (currentPage > 1) loadPage(currentPage - 1);
});

nextBtn.addEventListener('click', () => {
    if (currentPage < pageCount) loadPage(currentPage + 1);
});

jumpToPageBtn.addEventListener('click', () => {
    const targetPage = parseInt(pageJumpInput.value);
    if (targetPage >= 1 && targetPage <= pageCount) {
        loadPage(targetPage);
        pageJumpInput.value = '';
    } else {
        showError(`Please enter a page number between 1 and ${pageCount}`);
    }
});

pageJumpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        jumpToPageBtn.click();
    }
});

generateQuestionsBtn.addEventListener('click', generateQuestions);

// Add event listener for Ask AI button to get question via prompt
document.getElementById('askAiBtn').addEventListener('click', () => {
    if (!currentPDF) {
        showError('Please upload a PDF file first.');
        return;
    }

    // Create a prompt for the user to ask a question
    const question = prompt("Ask a question about the current page:");
    if (question && question.trim()) {
        handleQuestion(question.trim());
    }
});