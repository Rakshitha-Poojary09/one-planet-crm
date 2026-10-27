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
  },
  {
    timestamps: true,
  }
);

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
