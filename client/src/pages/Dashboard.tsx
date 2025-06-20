import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Document {
  id: string;
  title: string;
  createdAt: string;
  pageCount: number | null;
}

const Dashboard: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch user's documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await axios.get('/api/documents');
        setDocuments(response.data);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      }
    };

    fetchDocuments();
  }, []);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', file.name.replace('.pdf', ''));

    try {
      const response = await axios.post('/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setDocuments(prev => [response.data.document, ...prev]);
    } catch (error) {
      console.error('Failed to upload document:', error);
      setUploadError('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle document deletion
  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/documents/${id}`);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Welcome, {user?.fullName}</h1>
        <label className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded cursor-pointer">
          Upload PDF
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {uploadError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {uploadError}
        </div>
      )}

      {isUploading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          Uploading document...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold mb-2">{doc.title}</h3>
            <p className="text-gray-600 mb-4">
              Added on {new Date(doc.createdAt).toLocaleDateString()}
            </p>
            {doc.pageCount && (
              <p className="text-gray-600 mb-4">{doc.pageCount} pages</p>
            )}
            <div className="flex justify-between">
              <button
                onClick={() => navigate(`/study/${doc.id}`)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Study
              </button>
              <button
                onClick={() => handleDelete(doc.id)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {documents.length === 0 && !isUploading && (
        <div className="text-center text-gray-600 mt-8">
          No documents yet. Upload a PDF to get started!
        </div>
      )}
    </div>
  );
};

export default Dashboard; 