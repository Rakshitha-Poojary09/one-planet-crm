import mongoose from 'mongoose';

const policyAcknowledgementSchema = new mongoose.Schema(
  {
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyPolicy',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    employeeName: {
      type: String,
      default: '',
      trim: true,
    },
    policyVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    firstOpenedAt: {
      type: Date,
      default: null,
    },
    latestOpenedAt: {
      type: Date,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    isAcknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['Not Opened', 'Opened', 'Acknowledged'],
      default: 'Not Opened',
      index: true,
    },
    statement: {
      type: String,
      default: 'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.',
    },
    signatureImage: {
      type: String, // Base64 data URL: data:image/png;base64,...
      default: '',
    },
    signedPdf: {
      fileName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      pageCount: { type: Number, default: 0 },
      generatedAt: { type: Date, default: null },
      status: {
        type: String,
        enum: ['None', 'Pending', 'Generated', 'Failed'],
        default: 'None',
      },
    },
    originalPdf: {
      fileName: { type: String, default: '' },
      filePath: { type: String, default: '' },
    },
    confirmationRecord: {
      confirmed: { type: Boolean, default: false },
      confirmedBy: { type: String, default: '' },
      confirmedAt: { type: Date, default: null },
      ipAddress: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      acknowledgementType: {
        type: String,
        default: 'Internal Drawn Electronic Signature',
      },
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring one tracking/acknowledgement record per user per policy version
policyAcknowledgementSchema.index({ policy: 1, user: 1, policyVersion: 1 }, { unique: true });
policyAcknowledgementSchema.index({ policy: 1, status: 1 });
policyAcknowledgementSchema.index({ policy: 1, isAcknowledged: 1 });

export const PolicyAcknowledgement = mongoose.model(
  'PolicyAcknowledgement',
  policyAcknowledgementSchema
);
