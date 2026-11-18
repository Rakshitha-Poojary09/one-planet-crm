import mongoose from 'mongoose';

const questionReplySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['Admin', 'Manager', 'Employee'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const policyQuestionSchema = new mongoose.Schema(
  {
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyPolicy',
      required: true,
      index: true,
    },
    policyVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    question: {
      type: String,
      required: [true, 'Question content is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['Open', 'Answered', 'Resolved', 'Closed'],
      default: 'Open',
      index: true,
    },
    isPrivate: {
      type: Boolean,
      default: true,
    },
    isFAQ: {
      type: Boolean,
      default: false,
    },
    replies: [questionReplySchema],
  },
  {
    timestamps: true,
  }
);

policyQuestionSchema.index({ policy: 1, user: 1, createdAt: -1 });
policyQuestionSchema.index({ policy: 1, isFAQ: 1 });

export const PolicyQuestion = mongoose.model('PolicyQuestion', policyQuestionSchema);
