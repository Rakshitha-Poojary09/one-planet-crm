import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: 'One Planet Technologies',
    },
    companyTimezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    officeStartTime: {
      type: String,
      default: '09:30',
    },
    officeEndTime: {
      type: String,
      default: '18:30',
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15,
    },
    weeklyOffs: {
      type: [String],
      default: ['Saturday', 'Sunday'],
    },
    dailyWorkUpdateDeadline: {
      type: String,
      default: '20:00',
    },
    halfDayHoursThreshold: {
      type: Number,
      default: 4.5,
    },
    fullDayHoursThreshold: {
      type: Number,
      default: 8,
    },
    earlyDepartureThresholdMinutes: {
      type: Number,
      default: 30,
    },
    maxCorrectionDaysAllowed: {
      type: Number,
      default: 7,
    },
    allowCorrectionWeekends: {
      type: Boolean,
      default: true,
    },
    // Monthly Leave Accrual & Carry-Forward Policy
    leavePolicy: {
      monthlyAccrualRate: {
        type: Number,
        default: 1, // 1 leave day per month
      },
      annualEntitlement: {
        type: Number,
        default: 12, // 12 days annual entitlement
      },
      carryForwardEnabled: {
        type: Boolean,
        default: true, // Unused leave carries forward automatically
      },
      accrualDayOfMonth: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
