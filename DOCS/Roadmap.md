# AI Study Pal - JavaScript Version (No Backend)

## 📌 Project Overview
AI Study Pal is a **frontend-only** smart study assistant that reads textbooks, summarizes content, and answers questions using AI. It extracts text from PDFs using JavaScript and sends queries directly to OpenAI API.

## 🚀 Features
- 📖 **Read & Extract Text from PDFs** using `pdf.js`
- 🤖 **AI Chatbot for Q&A** using OpenAI API (no backend needed)
- 📌 **Simplified Explanations** for complex concepts
- 📝 **Summarization** of textbook content
- 💡 **Easy Deployment** (GitHub Pages / Vercel)

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript
- **File Handling**: `pdf.js`
- **AI Model**: OpenAI API (ChatGPT)
- **Deployment**: GitHub Pages / Vercel

## 🏗️ Project Structure
```
AI-Study-Pal/
│── index.html (Main UI)
│── script.js (Main logic)
│── style.css (Styling)
│── README.md (Documentation)
```

## 🔧 Step-by-Step Guide

### 1️⃣ **Setup the Project**
- Create a new folder for the project.
- Inside the folder, create `index.html`, `script.js`, and `style.css` files.
- Include `pdf.js` for extracting text from PDFs.

### 2️⃣ **Build the User Interface (UI)**
- Add a file upload button for selecting PDFs.
- Create a text area to display extracted text.
- Provide an input field for user queries.
- Add a submit button to send questions to AI.

### 3️⃣ **Extract Text from PDFs**
- Use `pdf.js` to read the uploaded PDF.
- Convert extracted content into plain text.
- Display the text in the text area for user reference.

### 4️⃣ **Integrate AI for Q&A**
- Use OpenAI API to process user questions.
- Send extracted text along with the question to the API.
- Receive and display AI-generated responses.

### 5️⃣ **Style the Application**
- Use CSS to make the UI visually appealing.
- Arrange elements properly for ease of use.
- Ensure responsiveness for different screen sizes.

### 6️⃣ **Deploy the Project**
- Upload the project to GitHub.
- Enable **GitHub Pages** for free hosting.
- Alternatively, deploy using **Vercel** for quick setup.

## 🎯 Future Enhancements
- 🎤 **Voice Input for Q&A**
- 🔍 **Keyword-Based Search in PDFs**
- 🌐 **Multilingual Support**

## 📢 Contributing
Pull requests are welcome! For major changes, open an issue first to discuss.

## 🏆 Acknowledgments
- OpenAI for the API
- Mozilla for `pdf.js`
- GitHub Pages / Vercel for free hosting
