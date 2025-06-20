import express from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticateToken } from '../middleware/auth.middleware';
import { getAnswerFromAI } from '../services/ai.service';

const router = express.Router();

// Validation schema for questions
const questionSchema = z.object({
  documentId: z.string().uuid(),
  questionText: z.string().min(1),
  context: z.string().optional() // Optional context from current page
});

// Create question and get answer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { documentId, questionText, context } = questionSchema.parse(req.body);

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: req.user!.id
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Get answer from AI
    const answerText = await getAnswerFromAI(
      questionText,
      context || document.extractedText || ''
    );

    // Create question record
    const question = await prisma.question.create({
      data: {
        questionText,
        answerText,
        userId: req.user!.id,
        documentId,
        sessionId: null // You might want to add session tracking later
      }
    });

    res.status(201).json(question);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Error processing question:', error);
    res.status(500).json({ message: 'Failed to process question' });
  }
});

// Get questions for a document
router.get('/', authenticateToken, async (req, res) => {
  try {
    const documentId = req.query.documentId as string;
    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    const questions = await prisma.question.findMany({
      where: {
        documentId,
        userId: req.user!.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

// Delete question
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const question = await prisma.question.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    await prisma.question.delete({
      where: {
        id: req.params.id
      }
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Failed to delete question' });
  }
});

export default router; 