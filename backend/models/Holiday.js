import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['National', 'Festival', 'Company', 'Optional'],
      default: 'Festival',
    },
    applicableDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null, // Null means all departments
    },
  },
  {
    timestamps: true,
  }
);

export const Holiday = mongoose.model('Holiday', holidaySchema);
