# StudyPal

## Overview

StudyPal is an AI-powered study assistant web application that allows users to upload PDF documents and interact with them through AI-generated questions and answers. The application provides a comprehensive learning experience by combining PDF viewing capabilities with intelligent content analysis using Google's Gemini AI model.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application follows a traditional client-side web architecture built with vanilla HTML, CSS, and JavaScript. Key architectural decisions include:

- **Single Page Application (SPA)**: All functionality is contained within a single HTML page with dynamic content updates
- **Modular CSS Design**: Uses CSS custom properties (variables) for consistent theming and easy maintenance
- **Responsive Layout**: Grid-based layout that adapts to different screen sizes
- **Component-based UI**: Logical separation of UI elements (header, upload section, PDF viewer, chat section)

### PDF Processing
- **PDF.js Integration**: Uses Mozilla's PDF.js library (version 3.4.120) loaded via CDN for client-side PDF rendering
- **Page Navigation**: Implements custom navigation controls with previous/next buttons and direct page jumping
- **Text Extraction**: Extracts text content from PDFs for AI processing

### AI Integration Architecture
- **Direct API Integration**: Makes direct HTTP requests to Google's Gemini 1.5 Flash API from the client
- **Retry Logic**: Implements exponential backoff retry mechanism for handling API rate limits and service unavailability
- **Response Caching**: Includes client-side caching system to avoid redundant API calls for the same queries
- **Error Handling**: Comprehensive error handling for API failures and network issues

### State Management
- **Client-side State**: Manages application state using JavaScript variables for current PDF, page numbers, and processing status
- **No Framework Dependencies**: Implements custom state management without external frameworks

### Security Considerations
- **API Key Exposure**: Currently stores Gemini API key directly in client-side code (security concern for production)
- **Client-side Processing**: All PDF processing and AI interactions happen on the client side

## External Dependencies

### AI Services
- **Google Gemini 1.5 Flash API**: Primary AI service for content analysis and question generation
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
  - Used for: PDF content analysis, question generation, and interactive Q&A

### JavaScript Libraries
- **PDF.js (v3.4.120)**: Mozilla's JavaScript PDF rendering library loaded via CDN
  - Purpose: Client-side PDF parsing, rendering, and text extraction
  - Worker: Uses dedicated web worker for PDF processing

### HTTP Client
- **Axios (v1.8.2)**: Promise-based HTTP client for API requests
  - Primary use: Making requests to Gemini AI API with retry logic

### UI Resources
- **Google Fonts**: Poppins font family for modern typography
- **CSS Grid and Flexbox**: Native browser layout systems for responsive design

### Development Dependencies
- **Node.js Package Management**: Uses npm for dependency management
- **pdfjs-dist (v4.10.38)**: Node.js distribution of PDF.js (likely unused in current implementation)