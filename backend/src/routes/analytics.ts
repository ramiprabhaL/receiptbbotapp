import express from 'express';
import { Receipt } from '../models/Receipt';
import { auth, AuthRequest } from '../middleware/auth';

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics
// @access  Private
router.get('/dashboard', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const now = new Date();
    
    // Current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // Previous month
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // Get current month stats
    const currentMonthStats = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: currentMonthStart, $lt: nextMonthStart },
          isArchived: false,
        }
      },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          avgAmount: { $avg: '$totalAmount' },
        }
      }
    ]);

    // Get previous month stats for comparison
    const prevMonthStats = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: prevMonthStart, $lt: currentMonthStart },
          isArchived: false,
        }
      },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          avgAmount: { $avg: '$totalAmount' },
        }
      }
    ]);

    // Get category breakdown for current month
    const categoryBreakdown = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: currentMonthStart, $lt: nextMonthStart },
          isArchived: false,
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          _id: 0,
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    // Get recent receipts
    const recentReceipts = await Receipt.find({
      userId: userId,
      isArchived: false,
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('merchantName totalAmount currency date category createdAt');

    // Calculate percentage changes
    const current = currentMonthStats[0] || { totalReceipts: 0, totalAmount: 0, avgAmount: 0 };
    const previous = prevMonthStats[0] || { totalReceipts: 0, totalAmount: 0, avgAmount: 0 };

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const dashboard = {
      currentMonth: {
        totalReceipts: current.totalReceipts,
        totalAmount: Math.round(current.totalAmount * 100) / 100,
        avgAmount: Math.round(current.avgAmount * 100) / 100,
      },
      changes: {
        receiptsChange: Math.round(calculateChange(current.totalReceipts, previous.totalReceipts) * 100) / 100,
        amountChange: Math.round(calculateChange(current.totalAmount, previous.totalAmount) * 100) / 100,
        avgAmountChange: Math.round(calculateChange(current.avgAmount, previous.avgAmount) * 100) / 100,
      },
      categoryBreakdown,
      recentReceipts,
    };

    res.json({
      success: true,
      data: { dashboard },
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard analytics',
    });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get spending trends over time
// @access  Private
router.get('/trends', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const monthsBack = parseInt(req.query.months as string) || 12;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const trends = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: startDate },
          isArchived: false,
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          totalAmount: { $sum: '$totalAmount' },
          receiptCount: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' },
        }
      },
      {
        $project: {
          year: '$_id.year',
          month: '$_id.month',
          totalAmount: { $round: ['$totalAmount', 2] },
          receiptCount: 1,
          avgAmount: { $round: ['$avgAmount', 2] },
          _id: 0,
        }
      },
      {
        $sort: { year: 1, month: 1 }
      }
    ]);

    res.json({
      success: true,
      data: { trends },
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching trends',
    });
  }
});

// @route   GET /api/analytics/top-merchants
// @desc    Get top merchants by spending
// @access  Private
router.get('/top-merchants', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const topMerchants = await Receipt.aggregate([
      {
        $match: {
          userId: userId,
          isArchived: false,
        }
      },
      {
        $group: {
          _id: '$merchantName',
          totalAmount: { $sum: '$totalAmount' },
          receiptCount: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' },
          lastVisit: { $max: '$date' },
        }
      },
      {
        $project: {
          merchantName: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          receiptCount: 1,
          avgAmount: { $round: ['$avgAmount', 2] },
          lastVisit: 1,
          _id: 0,
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: limit
      }
    ]);

    res.json({
      success: true,
      data: { topMerchants },
    });
  } catch (error) {
    console.error('Get top merchants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching top merchants',
    });
  }
});

export default router;
