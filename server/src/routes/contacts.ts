import express, { Response } from 'express';
import Contact from '../models/Contact';
import User from '../models/User';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

// @route   GET /api/contacts
// @desc    List the current user's saved contacts
// @access  Private
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const contacts = await Contact.list(currentUserId);

    res.status(200).json({
      success: true,
      data: { contacts },
    });
  } catch (error) {
    const err = error as Error;
    console.error('List contacts error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   POST /api/contacts
// @desc    Add a user to the current user's saved contacts
// @access  Private
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { contactId } = req.body;

    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const parsedContactId = parseInt(contactId);
    if (!contactId || isNaN(parsedContactId)) {
      res.status(400).json({ success: false, message: 'A valid contactId is required' });
      return;
    }

    if (parsedContactId === currentUserId) {
      res.status(400).json({ success: false, message: 'You cannot add yourself as a contact' });
      return;
    }

    const targetUser = await User.findById(parsedContactId);
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await Contact.add(currentUserId, parsedContactId);

    res.status(201).json({
      success: true,
      message: 'Contact added',
      data: {
        contact: { ...targetUser, addedAt: new Date().toISOString() },
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Add contact error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   DELETE /api/contacts/:contactId
// @desc    Remove a user from the current user's saved contacts
// @access  Private
router.delete('/:contactId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const contactId = parseInt(req.params.contactId);

    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!contactId || isNaN(contactId)) {
      res.status(400).json({ success: false, message: 'Invalid contact id' });
      return;
    }

    await Contact.remove(currentUserId, contactId);

    res.status(200).json({
      success: true,
      message: 'Contact removed',
    });
  } catch (error) {
    const err = error as Error;
    console.error('Remove contact error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

export default router;
