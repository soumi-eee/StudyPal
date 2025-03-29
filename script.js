// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const pdfViewer = document.getElementById('pdfViewer');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const questionInput = document.getElementById('questionInput');
const askBtn = document.getElementById('askBtn');
const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
const chatHistory = document.getElementById('chatHistory');
const uploadStatus = document.getElementById('uploadStatus');
const pageJumpInput = document.getElementById('pageJumpInput');
const jumpToPageBtn = document.getElementById('jumpToPage');

// State management
let currentPDF = null;
let currentPage = 1;
let pageCount = 0;
let isProcessing = false;

// API Configuration
const GROQ_API_KEY = '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';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Add cache for AI responses
let answerCache = {};

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
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Accept": "application/json"
            },
            body: JSON.stringify({
                model: "allam-2-7b",
                messages: messages,
                temperature: 0.1,
                max_tokens: 1500,
                top_p: 0.5,
                frequency_penalty: 0.9,
                presence_penalty: 0.9,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const responseText = data?.choices?.[0]?.message?.content?.trim() || "No response.";
        
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
        console.error('API request error:', error);
        throw new Error(`Failed to get AI response: ${error.message}`);
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
        askBtn.disabled = true;

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
        askBtn.disabled = false;

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

        const response = await getAIResponse(question, userAnswer);
        const correctAnswer = response.correctAnswer || "";
        const feedback = response.feedback || "";

        if (isAnswerCorrect(userAnswer, correctAnswer)) {
            showFeedback("✅ Correct! Well done!", button);
        } else {
            showFeedback(feedback, button, userAnswer, correctAnswer);
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
async function handleQuestion() {
    if (isProcessing) return;
    
    if (!currentPDF) {
        showError('Please upload a PDF file first.');
        return;
    }

    const question = questionInput.value.trim();
    if (!question) {
        showError('Please enter a question.');
        return;
    }

    isProcessing = true;
    askBtn.disabled = true;
    askBtn.textContent = 'Processing...';
    hideError();

    try {
        const relevantText = await extractRelevantText(question);
        
        if (!relevantText) {
            throw new Error('No relevant text found in the current context.');
        }

        addMessageToChat('user', question);

        const response = await getAIResponse(question, "", relevantText);
        const answer = response.feedback || "Sorry, I couldn't generate an answer. Please try again.";

        addMessageToChat('ai', answer);

    } catch (error) {
        console.error('API Error:', error);
        showError(`Failed to process question: ${error.message}`);
    } finally {
        isProcessing = false;
        askBtn.disabled = false;
        askBtn.textContent = 'Ask AI';
        questionInput.value = '';
    }
}

// Generate questions
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

    try {
        const currentPageText = await getCurrentPageText();
        
        const response = await getAIResponse(
            `Generate 5 important questions about this page's content. Format each question on a new line starting with 'Q: '.`,
            "",
            currentPageText
        );

        const questions = response.feedback || "Sorry, I couldn't generate questions. Please try again.";

        const questionsDiv = document.createElement('div');
        questionsDiv.className = 'message ai-message';
        
        const formattedQuestions = questions.split('\n')
            .filter(q => q.trim().startsWith('Q:'))
            .map((q, index) => {
                const questionText = q.replace(/^Q:\s*/, '').trim();
                return `
                    <div class="question-container">
                        <div class="question-content">
                            <div class="question-link" onclick="selectQuestion('${questionText}')">${q}</div>
                            <div class="answer-form">
                                <textarea class="answer-input" placeholder="Enter your answer here..."></textarea>
                                <button class="submit-answer-btn" onclick="submitAnswer('${questionText}', this)">Submit Answer</button>
                            </div>
                        </div>
                        <div class="feedback-content"></div>
                    </div>
                `;
            }).join('');
        
        questionsDiv.innerHTML = `<strong>AI:</strong> Here are some questions about page ${currentPage}:<br><br>${formattedQuestions}`;
        chatHistory.appendChild(questionsDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

    } catch (error) {
        console.error('API Error:', error);
        showError(`Failed to generate questions: ${error.message}`);
    } finally {
        isProcessing = false;
        generateQuestionsBtn.disabled = false;
        generateQuestionsBtn.textContent = 'Generate Questions';
    }
}

// Helper functions
function selectQuestion(question) {
    questionInput.value = question;
    questionInput.focus();
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
    askBtn.disabled = true;
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    pageInfo.style.display = 'none';
    pdfViewer.innerHTML = 'Please upload a PDF file';
}

// Event listeners
fileInput.addEventListener('change', async (e) => {
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

askBtn.addEventListener('click', handleQuestion);
generateQuestionsBtn.addEventListener('click', generateQuestions);