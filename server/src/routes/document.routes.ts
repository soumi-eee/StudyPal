import express from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticateToken } from '../middleware/auth.middleware';
import { extractTextFromPDF } from '../services/pdf.service';

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: './uploads/pdfs',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Validation schema for document creation
const documentSchema = z.object({
  title: z.string().min(1)
});

// Upload and process PDF
router.post('/upload', authenticateToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file || !req.body.title) {
      return res.status(400).json({ message: 'PDF file and title are required' });
    }

    const { title } = documentSchema.parse(req.body);
    
    // Extract text from PDF
    const extractedText = await extractTextFromPDF(req.file.path);
    
    // Create document record
    const document = await prisma.document.create({
      data: {
        title,
        filePath: req.file.path,
        extractedText,
        userId: req.user!.id,
        pageCount: 0 // This should be updated with actual page count
      }
    });

    res.status(201).json({
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to upload document' });
  }
});

// Get user's documents
router.get('/', authenticateToken, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: {
        userId: req.user!.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// Get single document
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        bookmarks: true
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await prisma.document.delete({
      where: {
        id: req.params.id
      }
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

export default router; 