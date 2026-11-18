import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't return password in queries by default
    },
    phone: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['Admin', 'Manager', 'Employee'],
      default: 'Employee',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    designation: {
      type: String,
      default: 'Team Member',
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    assignedProjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
      default: 'Full-Time',
    },
    employmentStatus: {
      type: String,
      enum: ['Active', 'Inactive', 'Probation', 'Terminated'],
      default: 'Active',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    address: {
      type: String,
      default: '',
    },
    profilePicture: {
      type: String,
      default: '',
    },
    shiftTiming: {
      startTime: { type: String, default: '09:30' },
      endTime: { type: String, default: '18:30' },
      graceMinutes: { type: Number, default: 15 },
    },
    weeklyOff: {
      type: [String],
      default: ['Saturday', 'Sunday'],
    },
    emergencyContact: {
      name: { type: String, default: '' },
      relationship: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    documents: [
      {
        name: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        uploadDate: { type: Date, default: Date.now },
      },
    ],
    bio: {
      type: String,
      default: '',
    },
    accountApprovalStatus: {
      type: String,
      enum: ['Approved', 'Pending', 'Rejected'],
      default: 'Approved',
    },
    requestedRole: {
      type: String,
      enum: ['Employee', 'Manager'],
      default: null,
    },
    managerApprovalStatus: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected'],
      default: 'None',
    },
    isSelfRegistered: {
      type: Boolean,
      default: false,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Calculate profile completion metrics dynamically
userSchema.methods.getProfileCompletion = function () {
  const hasPhone = Boolean(this.phone && this.phone.trim());
  const hasAddress = Boolean(this.address && this.address.trim());
  const hasEmergency = Boolean(
    this.emergencyContact &&
    this.emergencyContact.name &&
    this.emergencyContact.name.trim() &&
    this.emergencyContact.phone &&
    this.emergencyContact.phone.trim()
  );
  const hasPhoto = Boolean(this.profilePicture && this.profilePicture.trim());
  const hasDob = Boolean(this.dateOfBirth);

  let score = 40; // Base identity (fullName, email, employeeId, role)
  if (hasPhone) score += 20;
  if (hasAddress) score += 15;
  if (hasEmergency) score += 15;
  if (hasPhoto) score += 5;
  if (hasDob) score += 5;

  const missingFields = [];
  if (!hasPhone) missingFields.push('Contact Phone');
  if (!hasAddress) missingFields.push('Current Address');
  if (!hasEmergency) missingFields.push('Emergency Contact');
  if (!hasPhoto) missingFields.push('Profile Photo');
  if (!hasDob) missingFields.push('Date of Birth');

  return {
    percentage: Math.min(100, score),
    isComplete: hasPhone && hasAddress && hasEmergency,
    missingFields,
  };
};

export const User = mongoose.model('User', userSchema);
