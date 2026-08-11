import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { protect } from '../middleware/auth';
import { AuthRequest, AuthResponse } from '../types';

const router = express.Router();

// Generate JWT Token
const generateToken = (id: number): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req: Request, res: Response<AuthResponse>) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
      return;
    }

    // Check if user already exists
    const userExists = await User.findByEmail(email);
    if (userExists) {
      res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
      return;
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    // Generate token
    const token = generateToken(user.id);

    // Return user data (without password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          lastActive: user.lastActive,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Signup error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req: Request, res: Response<AuthResponse>) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
      return;
    }

    // Check for user and include password for comparison
    const user = await User.findByEmailWithPassword(email);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Check if password matches
    const isMatch = await User.matchPassword(password, user.password!);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate token
    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          lastActive: user.lastActive,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          lastActive: user.lastActive,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Get user error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   PUT /api/auth/status
// @desc    Heartbeat - update current user's presence status
// @access  Private
router.put('/status', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { status } = req.body;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (status !== 'online' && status !== 'away') {
      res.status(400).json({
        success: false,
        message: 'Status must be "online" or "away"',
      });
      return;
    }

    await User.updateStatus(currentUserId, status);

    res.status(200).json({
      success: true,
      message: 'Status updated',
    });
  } catch (error) {
    const err = error as Error;
    console.error('Update status error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update current user's name
// @access  Private
router.put('/profile', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { name } = req.body;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Name is required',
      });
      return;
    }

    if (name.trim().length > 50) {
      res.status(400).json({
        success: false,
        message: 'Name must be 50 characters or fewer',
      });
      return;
    }

    const user = await User.updateProfile(currentUserId, name.trim());

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: { user },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Update profile error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

// @route   PUT /api/auth/avatar
// @desc    Update current user's avatar image (base64 data URL)
// @access  Private
router.put('/avatar', protect, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { avatarUrl } = req.body;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.startsWith('data:image/')) {
      res.status(400).json({
        success: false,
        message: 'A valid image is required',
      });
      return;
    }

    // Roughly 2MB decoded limit (base64 is ~1.37x the decoded size)
    if (avatarUrl.length > 2.8 * 1024 * 1024) {
      res.status(400).json({
        success: false,
        message: 'Image is too large. Please choose a smaller image.',
      });
      return;
    }

    const user = await User.updateAvatar(currentUserId, avatarUrl);

    res.status(200).json({
      success: true,
      message: 'Avatar updated',
      data: { user },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Update avatar error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

export default router;

