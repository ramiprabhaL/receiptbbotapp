import express from 'express';
import multer from 'multer';
import { body, validationResult, query } from 'express-validator';
import { Receipt } from '../models/Receipt';
import { auth, AuthRequest } from '../middleware/auth';
import { processReceiptOCR } from '../services/ocrService';
import { categorizeReceipt } from '../services/categorizationService';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  },
});

// @route   POST /api/receipts
// @desc    Create a new receipt
// @access  Private
router.post('/', auth, upload.single('receipt'), [
  body('merchantName').optional().trim().isLength({ min: 1 }).withMessage('Merchant name cannot be empty'),
  body('totalAmount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('date').optional().isISO8601().withMessage('Date must be in ISO format'),
  body('category').optional().isIn([
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Healthcare',
    'Travel', 'Utilities', 'Education', 'Business', 'Personal Care',
    'Home & Garden', 'Insurance', 'Investments', 'Gifts & Donations', 'Other'
  ]).withMessage('Invalid category'),
  body('paymentMethod').optional().isIn(['cash', 'card', 'digital', 'other']).withMessage('Invalid payment method'),
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

    let receiptData: any = {
      userId: req.user?.userId,
      ...req.body,
    };

    // Process uploaded file with OCR
    if (req.file) {
      try {
        const ocrResult = await processReceiptOCR(req.file.path);
        
        // Merge OCR data with manual input (manual input takes precedence)
        receiptData = {
          ...ocrResult,
          ...receiptData,
          imageUrl: `/uploads/receipts/${req.file.filename}`,
          ocrText: ocrResult.rawText,
        };
      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError);
        // Continue without OCR data
        receiptData.imageUrl = `/uploads/receipts/${req.file.filename}`;
      }
    }

    // Auto-categorize if category not provided
    if (!receiptData.category && receiptData.merchantName) {
      try {
        receiptData.category = await categorizeReceipt({
          merchantName: receiptData.merchantName,
          items: receiptData.items || [],
          description: receiptData.description,
        });
      } catch (categorizationError) {
        console.error('Categorization failed:', categorizationError);
        receiptData.category = 'Other';
      }
    }

    // Set default values
    receiptData.date = receiptData.date ? new Date(receiptData.date) : new Date();
    receiptData.currency = receiptData.currency || 'USD';
    receiptData.paymentMethod = receiptData.paymentMethod || 'card';

    const receipt = new Receipt(receiptData);
    await receipt.save();

    res.status(201).json({
      success: true,
      message: 'Receipt created successfully',
      data: { receipt },
    });
  } catch (error) {
    console.error('Create receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating receipt',
    });
  }
});

// @route   GET /api/receipts
// @desc    Get user's receipts
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be in ISO format'),
  query('endDate').optional().isISO8601().withMessage('End date must be in ISO format'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('Minimum amount must be positive'),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('Maximum amount must be positive'),
  query('search').optional().isString().withMessage('Search must be a string'),
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: any = {
      userId: req.user?.userId,
      isArchived: false,
    };

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filter.date.$lte = new Date(req.query.endDate as string);
      }
    }

    if (req.query.minAmount || req.query.maxAmount) {
      filter.totalAmount = {};
      if (req.query.minAmount) {
        filter.totalAmount.$gte = parseFloat(req.query.minAmount as string);
      }
      if (req.query.maxAmount) {
        filter.totalAmount.$lte = parseFloat(req.query.maxAmount as string);
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filter.$or = [
        { merchantName: searchRegex },
        { description: searchRegex },
        { 'items.name': searchRegex },
      ];
    }

    // Get receipts with pagination
    const receipts = await Receipt.find(filter)
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Receipt.countDocuments(filter);

    res.json({
      success: true,
      data: {
        receipts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching receipts',
    });
  }
});

// @route   GET /api/receipts/:id
// @desc    Get receipt by ID
// @access  Private
router.get('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const receipt = await Receipt.findOne({
      _id: req.params.id,
      userId: req.user?.userId,
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    res.json({
      success: true,
      data: { receipt },
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching receipt',
    });
  }
});

// @route   PUT /api/receipts/:id
// @desc    Update receipt
// @access  Private
router.put('/:id', auth, [
  body('merchantName').optional().trim().isLength({ min: 1 }).withMessage('Merchant name cannot be empty'),
  body('totalAmount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('date').optional().isISO8601().withMessage('Date must be in ISO format'),
  body('category').optional().isIn([
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Healthcare',
    'Travel', 'Utilities', 'Education', 'Business', 'Personal Care',
    'Home & Garden', 'Insurance', 'Investments', 'Gifts & Donations', 'Other'
  ]).withMessage('Invalid category'),
  body('paymentMethod').optional().isIn(['cash', 'card', 'digital', 'other']).withMessage('Invalid payment method'),
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

    const receipt = await Receipt.findOne({
      _id: req.params.id,
      userId: req.user?.userId,
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    // Update fields
    Object.assign(receipt, req.body);
    receipt.isVerified = true; // Mark as verified when manually updated

    await receipt.save();

    res.json({
      success: true,
      message: 'Receipt updated successfully',
      data: { receipt },
    });
  } catch (error) {
    console.error('Update receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating receipt',
    });
  }
});

// @route   DELETE /api/receipts/:id
// @desc    Delete receipt
// @access  Private
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const receipt = await Receipt.findOne({
      _id: req.params.id,
      userId: req.user?.userId,
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    await Receipt.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting receipt',
    });
  }
});

// @route   PUT /api/receipts/:id/archive
// @desc    Archive/unarchive receipt
// @access  Private
router.put('/:id/archive', auth, async (req: AuthRequest, res) => {
  try {
    const receipt = await Receipt.findOne({
      _id: req.params.id,
      userId: req.user?.userId,
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    receipt.isArchived = !receipt.isArchived;
    await receipt.save();

    res.json({
      success: true,
      message: `Receipt ${receipt.isArchived ? 'archived' : 'unarchived'} successfully`,
      data: { receipt },
    });
  } catch (error) {
    console.error('Archive receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error archiving receipt',
    });
  }
});

export default router;
