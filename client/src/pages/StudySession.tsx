import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Document {
  id: string;
  title: string;
  filePath: string;
  extractedText: string;
  pageCount: number;
}

interface Question {
  id: string;
  questionText: string;
  answerText: string;
  createdAt: string;
}

const StudySession: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pageText, setPageText] = useState('');

  // Fetch document and questions
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch document details
        const docResponse = await axios.get(`/api/documents/${documentId}`);
        setDocument(docResponse.data);

        // Fetch questions for this document
        const questionsResponse = await axios.get(`/api/questions?documentId=${documentId}`);
        setQuestions(questionsResponse.data);

        // Load PDF document
        const pdf = await pdfjsLib.getDocument(docResponse.data.filePath).promise;
        setPdfDocument(pdf);
        loadPage(1, pdf);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load document');
      }
    };

    fetchData();
  }, [documentId]);

  // Load PDF page
  const loadPage = async (pageNumber: number, pdf = pdfDocument) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(' ');
      setPageText(text);
      setCurrentPage(pageNumber);
    } catch (error) {
      console.error('Error loading page:', error);
      setError('Failed to load page');
    }
  };

  // Handle page navigation
  const handlePageChange = (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= pdfDocument.numPages) {
      loadPage(newPage);
    }
  };

  // Handle asking questions
  const handleAskQuestion = async () => {
    if (!currentQuestion.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/questions', {
        documentId,
        questionText: currentQuestion,
        context: pageText // Send current page text as context
      });

      setQuestions(prev => [response.data, ...prev]);
      setCurrentQuestion('');
    } catch (error) {
      console.error('Error asking question:', error);
      setError('Failed to get answer');
    } finally {
      setIsLoading(false);
    }
  };

  if (!document) {
    return <div className="text-center mt-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{document.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PDF Viewer */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => handlePageChange(-1)}
              disabled={currentPage === 1}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Previous
            </button>
            <span>Page {currentPage} of {pdfDocument?.numPages || '?'}</span>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === (pdfDocument?.numPages || 1)}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Next
            </button>
          </div>
          <div className="border p-4 h-[600px] overflow-y-auto">
            {pageText}
          </div>
        </div>

        {/* Q&A Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <textarea
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              placeholder="Ask a question about the document..."
              className="w-full p-2 border rounded"
              rows={3}
            />
            <button
              onClick={handleAskQuestion}
              disabled={isLoading || !currentQuestion.trim()}
              className="bg-green-500 text-white px-4 py-2 rounded mt-2 w-full disabled:bg-gray-300"
            >
              {isLoading ? 'Getting Answer...' : 'Ask Question'}
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {questions.map(question => (
              <div key={question.id} className="border rounded p-4">
                <p className="font-semibold">Q: {question.questionText}</p>
                <p className="mt-2">A: {question.answerText}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(question.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudySession; 