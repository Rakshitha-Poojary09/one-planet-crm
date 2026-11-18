import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: false,
      default: null,
    },
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
    },
    allocated: {
      type: Number,
      default: 12,
    },
    used: {
      type: Number,
      default: 0,
    },
    // Monthly Accrual & Carry-Forward Trackers
    monthlyAccrued: {
      type: Number,
      default: 0,
    },
    carriedForward: {
      type: Number,
      default: 0,
    },
    currentMonthEarned: {
      type: Number,
      default: 0,
    },
    leaveTakenInMonth: {
      type: Number,
      default: 0,
    },
    pendingDays: {
      type: Number,
      default: 0,
    },
    availableBalance: {
      type: Number,
      default: 0,
    },
    lopDays: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

leaveBalanceSchema.virtual('remaining').get(function () {
  return this.availableBalance !== undefined && this.availableBalance !== null
    ? this.availableBalance
    : Math.max(0, this.allocated - this.used);
});

leaveBalanceSchema.set('toJSON', { virtuals: true });
leaveBalanceSchema.set('toObject', { virtuals: true });
leaveBalanceSchema.index({ user: 1, leaveType: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
