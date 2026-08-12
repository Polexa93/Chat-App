import express, { Response } from 'express';
import Message from '../models/Message';
import User from '../models/User';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../types';
import { emitNewMessage } from '../socket';

const router = express.Router();

// @route   GET /api/messages/contacts
// @desc    Get all users that have conversations with current user
// @access  Private
router.get('/contacts', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const contacts = await Message.getConversationPartners(currentUserId);

    res.status(200).json({
      success: true,
      data: {
        contacts,
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Get contacts error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   GET /api/messages/:contactId
// @desc    Get conversation between current user and contact
// @access  Private
router.get('/:contactId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const contactId = parseInt(req.params.contactId);

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!contactId || isNaN(contactId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid contact ID',
      });
      return;
    }

    const before = req.query.before ? parseInt(req.query.before as string) : undefined;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;

    const { messages, hasMore } = await Message.getConversation(currentUserId, contactId, { before, limit });

    res.status(200).json({
      success: true,
      data: {
        messages,
        hasMore,
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Get messages error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { receiverId, text } = req.body;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!receiverId || !text || !text.trim()) {
      res.status(400).json({
        success: false,
        message: 'Receiver ID and message text are required',
      });
      return;
    }

    const message = await Message.create(
      { receiverId: parseInt(receiverId), text: text.trim() },
      currentUserId
    );

    // Get sender name for response
    const sender = await User.findById(currentUserId);
    const messageWithSender = {
      ...message,
      senderName: sender?.name || 'Unknown',
    };

    // Push it to both participants in real time
    emitNewMessage(currentUserId, message.receiverId, messageWithSender);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: messageWithSender,
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Send message error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

export default router;

