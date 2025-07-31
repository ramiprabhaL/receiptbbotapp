import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { auth, AuthRequest } from '../middleware/auth';

const router = express.Router();

// @route   GET /api/users/preferences
// @desc    Get user preferences
// @access  Private
router.get('/preferences', auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: { preferences: user.preferences },
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching preferences',
    });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', auth, [
  body('defaultCurrency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('autoCategorizationEnabled').optional().isBoolean().withMessage('Auto categorization must be boolean'),
  body('receiptRetentionPeriod').optional().isInt({ min: 1, max: 120 }).withMessage('Retention period must be 1-120 months'),
  body('emailNotifications').optional().isBoolean().withMessage('Email notifications must be boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('Push notifications must be boolean'),
  body('theme').optional().isIn(['light', 'dark', 'auto']).withMessage('Theme must be light, dark, or auto'),
  body('language').optional().isLength({ min: 2, max: 5 }).withMessage('Language must be 2-5 characters'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update preferences
    Object.assign(user.preferences, req.body);
    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences },
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating preferences',
    });
  }
});

// @route   GET /api/users/subscription
// @desc    Get user subscription info
// @access  Private
router.get('/subscription', auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: { 
        subscription: user.subscription,
        apiUsage: user.apiUsage,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching subscription',
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    
    // This would typically use the Receipt model
    // For now, return basic user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const stats = {
      memberSince: user.createdAt,
      lastLogin: user.lastLoginAt,
      isVerified: user.isVerified,
      subscriptionPlan: user.subscription.plan,
      apiUsage: user.apiUsage,
    };

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user statistics',
    });
  }
});

export default router;
