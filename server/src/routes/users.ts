import express, { Response } from 'express';
import User from '../models/User';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

// @route   GET /api/users/search
// @desc    Search users by name or email
// @access  Private
router.get('/search', protect, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    const currentUserId = req.user?.id;

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
      return;
    }

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const users = await User.searchUsers(query.trim(), currentUserId);

    res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Search users error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

export default router;

