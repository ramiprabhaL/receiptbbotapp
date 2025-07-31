import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isVerified: boolean;
  preferences: {
    defaultCurrency: string;
    autoCategorizationEnabled: boolean;
    receiptRetentionPeriod: number; // in months
    emailNotifications: boolean;
    pushNotifications: boolean;
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
  subscription: {
    plan: 'free' | 'premium' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    startDate?: Date;
    endDate?: Date;
    features: string[];
  };
  apiUsage: {
    ocrRequestsThisMonth: number;
    maxOcrRequests: number;
    lastResetDate: Date;
  };
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
}

const preferencesSchema = new Schema({
  defaultCurrency: {
    type: String,
    default: 'USD',
    uppercase: true,
    minlength: 3,
    maxlength: 3,
  },
  autoCategorizationEnabled: {
    type: Boolean,
    default: true,
  },
  receiptRetentionPeriod: {
    type: Number,
    default: 24, // 2 years
    min: 1,
    max: 120,
  },
  emailNotifications: {
    type: Boolean,
    default: true,
  },
  pushNotifications: {
    type: Boolean,
    default: true,
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'auto',
  },
  language: {
    type: String,
    default: 'en',
    minlength: 2,
    maxlength: 5,
  },
});

const subscriptionSchema = new Schema({
  plan: {
    type: String,
    enum: ['free', 'premium', 'enterprise'],
    default: 'free',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled'],
    default: 'active',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  features: [{
    type: String,
  }],
});

const apiUsageSchema = new Schema({
  ocrRequestsThisMonth: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxOcrRequests: {
    type: Number,
    default: 50, // Free tier limit
    min: 0,
  },
  lastResetDate: {
    type: Date,
    default: Date.now,
  },
});

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false, // Don't include password in queries by default
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  avatar: {
    type: String,
    trim: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  preferences: {
    type: preferencesSchema,
    default: () => ({}),
  },
  subscription: {
    type: subscriptionSchema,
    default: () => ({}),
  },
  apiUsage: {
    type: apiUsageSchema,
    default: () => ({}),
  },
  lastLoginAt: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  },
  toObject: { virtuals: true },
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get full name method
userSchema.methods.getFullName = function(): string {
  return `${this.firstName} ${this.lastName}`;
};

// Reset API usage at the beginning of each month
userSchema.methods.resetMonthlyApiUsage = function() {
  const now = new Date();
  const lastReset = this.apiUsage.lastResetDate;
  
  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    this.apiUsage.ocrRequestsThisMonth = 0;
    this.apiUsage.lastResetDate = now;
  }
};

export const User = mongoose.model<IUser>('User', userSchema);
