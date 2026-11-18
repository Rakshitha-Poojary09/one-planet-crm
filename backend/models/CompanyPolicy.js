import mongoose from 'mongoose';

const versionHistorySchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    changeSummary: {
      type: String,
      default: '',
    },
    targetAudience: {
      type: String,
      enum: ['All', 'Departments', 'Roles'],
      default: 'All',
    },
    targetDepartments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    targetRoles: [
      {
        type: String,
        enum: ['Admin', 'Manager', 'Employee'],
      },
    ],
    pdfFile: {
      originalName: { type: String, default: '' },
      fileName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: 'application/pdf' },
      uploadedAt: { type: Date, default: Date.now },
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const companyPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Policy title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Policy category is required'],
      trim: true,
      default: 'General',
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    effectiveDate: {
      type: Date,
      required: [true, 'Effective date is required'],
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Archived'],
      default: 'Draft',
    },
    version: {
      type: Number,
      default: 1,
    },
    targetAudience: {
      type: String,
      enum: ['All', 'Departments', 'Roles'],
      default: 'All',
    },
    targetDepartments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    targetRoles: [
      {
        type: String,
        enum: ['Admin', 'Manager', 'Employee'],
      },
    ],
    pdfFile: {
      originalName: { type: String, default: '' },
      fileName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: 'application/pdf' },
      uploadedAt: { type: Date, default: Date.now },
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    versionHistory: [versionHistorySchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
companyPolicySchema.index({ status: 1, category: 1 });
companyPolicySchema.index({ title: 'text', description: 'text', content: 'text' });
companyPolicySchema.index({ targetAudience: 1 });

export const CompanyPolicy = mongoose.model('CompanyPolicy', companyPolicySchema);
