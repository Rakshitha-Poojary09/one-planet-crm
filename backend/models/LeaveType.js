import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String, // e.g., CL, SL, EL
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    defaultDaysPerYear: {
      type: Number,
      default: 12,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
    carryForwardDays: {
      type: Number,
      default: 0,
    },
    carryForwardEnabled: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
