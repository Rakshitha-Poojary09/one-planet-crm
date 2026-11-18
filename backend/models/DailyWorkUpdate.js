import mongoose from 'mongoose';

const dailyWorkUpdateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    completedWork: {
      type: String,
      default: '',
    },
    workInProgress: {
      type: String,
      default: '',
    },
    pendingWork: {
      type: String,
      default: '',
    },
    blockers: {
      type: String,
      default: '',
    },
    timeSpentHours: {
      type: Number,
      required: true,
      default: 8,
    },
    status: {
      type: String,
      enum: ['Completed', 'In Progress', 'Blocked'],
      default: 'In Progress',
    },
    nextDayPlan: {
      type: String,
      default: '',
    },
    managerFeedback: {
      type: String,
      default: '',
    },
    feedbackBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    feedbackAt: {
      type: Date,
      default: null,
    },
    needsClarification: {
      type: Boolean,
      default: false,
    },
    clarificationStatus: {
      type: String,
      enum: ['None', 'Requested', 'Resolved'],
      default: 'None',
    },
    comments: [
      {
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ['Feedback', 'Clarification'],
          default: 'Feedback',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    editHistory: [
      {
        editedAt: {
          type: Date,
          default: Date.now,
        },
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        previousCompletedWork: String,
        previousWorkInProgress: String,
        previousPendingWork: String,
        previousBlockers: String,
        previousTimeSpentHours: Number,
        previousStatus: String,
        previousNextDayPlan: String,
        reason: {
          type: String,
          default: '',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Unique index: one submission per employee per day
dailyWorkUpdateSchema.index({ user: 1, date: 1 }, { unique: true });

export const DailyWorkUpdate = mongoose.model('DailyWorkUpdate', dailyWorkUpdateSchema);
