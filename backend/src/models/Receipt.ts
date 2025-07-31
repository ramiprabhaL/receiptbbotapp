import mongoose, { Document, Schema } from 'mongoose';

export interface IReceipt extends Document {
  userId: mongoose.Types.ObjectId;
  merchantName: string;
  totalAmount: number;
  currency: string;
  date: Date;
  category: string;
  subcategory?: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    category?: string;
  }[];
  tags: string[];
  paymentMethod: 'cash' | 'card' | 'digital' | 'other';
  taxAmount?: number;
  tipAmount?: number;
  description?: string;
  imageUrl?: string;
  ocrText?: string;
  confidence: number;
  isVerified: boolean;
  isArchived: boolean;
  location?: {
    address: string;
    city: string;
    state: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const receiptItemSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    trim: true,
  },
});

const locationSchema = new Schema({
  address: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  country: {
    type: String,
    trim: true,
  },
  coordinates: {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
});

const receiptSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  merchantName: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    index: true,
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
    minlength: 3,
    maxlength: 3,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true,
    enum: [
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Entertainment',
      'Healthcare',
      'Travel',
      'Utilities',
      'Education',
      'Business',
      'Personal Care',
      'Home & Garden',
      'Insurance',
      'Investments',
      'Gifts & Donations',
      'Other'
    ],
  },
  subcategory: {
    type: String,
    trim: true,
  },
  items: [receiptItemSchema],
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'digital', 'other'],
    default: 'card',
  },
  taxAmount: {
    type: Number,
    min: 0,
  },
  tipAmount: {
    type: Number,
    min: 0,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  ocrText: {
    type: String,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true,
  },
  location: locationSchema,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
receiptSchema.index({ userId: 1, date: -1 });
receiptSchema.index({ userId: 1, category: 1 });
receiptSchema.index({ userId: 1, merchantName: 1 });
receiptSchema.index({ userId: 1, totalAmount: -1 });
receiptSchema.index({ createdAt: -1 });

// Virtual for formatted total amount
receiptSchema.virtual('formattedAmount').get(function() {
  return `${this.currency} ${this.totalAmount.toFixed(2)}`;
});

// Pre-save middleware to ensure data consistency
receiptSchema.pre('save', function(next) {
  // Ensure date is not in the future
  if (this.date > new Date()) {
    this.date = new Date();
  }
  
  // Calculate confidence based on available data
  let confidence = 0.5;
  if (this.merchantName && this.totalAmount) confidence += 0.2;
  if (this.items && this.items.length > 0) confidence += 0.2;
  if (this.ocrText) confidence += 0.1;
  
  this.confidence = Math.min(confidence, 1);
  
  next();
});

export const Receipt = mongoose.model<IReceipt>('Receipt', receiptSchema);
