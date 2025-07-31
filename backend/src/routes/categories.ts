import express from 'express';
import { getAllCategories, getCategoryKeywords } from '../services/categorizationService';
import { auth, AuthRequest } from '../middleware/auth';
import { Receipt } from '../models/Receipt';

const router = express.Router();

// @route   GET /api/categories
// @desc    Get all available categories
// @access  Public
router.get('/', async (req, res) => {
  try {
    const categories = getAllCategories();
    
    res.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching categories',
    });
  }
});

// @route   GET /api/categories/:category/keywords
// @desc    Get keywords for a specific category
// @access  Public
router.get('/:category/keywords', async (req, res) => {
  try {
    const { category } = req.params;
    const keywords = getCategoryKeywords(category);
    
    if (keywords.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      data: { category, keywords },
    });
  } catch (error) {
    console.error('Get category keywords error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching category keywords',
    });
  }
});

// @route   GET /api/categories/stats
// @desc    Get category statistics for user
// @access  Private
router.get('/stats', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    
    // Get category statistics
    const categoryStats = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          isArchived: false,
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          avgAmount: { $avg: '$totalAmount' },
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          avgAmount: { $round: ['$avgAmount', 2] },
          _id: 0,
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    // Get monthly category trends
    const monthlyTrends = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          isArchived: false,
          date: {
            $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) // Last 12 months
          }
        }
      },
      {
        $group: {
          _id: {
            category: '$category',
            month: { $month: '$date' },
            year: { $year: '$date' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        }
      },
      {
        $project: {
          category: '$_id.category',
          month: '$_id.month',
          year: '$_id.year',
          count: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          _id: 0,
        }
      },
      {
        $sort: { year: -1, month: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        categoryStats,
        monthlyTrends,
      },
    });
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching category statistics',
    });
  }
});

export default router;
