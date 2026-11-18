import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { logAudit } from '../utils/audit.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing or empty. Please configure JWT_SECRET.');
  }
  return secret;
};

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '7d',
  });
};

// Helper to auto-generate next Employee ID (e.g. OPT-1001)
const generateNextEmployeeId = async () => {
  const lastUser = await User.findOne({ employeeId: { $regex: /^OPT-/ } })
    .sort({ createdAt: -1 })
    .lean();
  if (!lastUser || !lastUser.employeeId) {
    return 'OPT-1001';
  }
  const match = lastUser.employeeId.match(/^OPT-(\d+)$/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `OPT-${nextNum}`;
  }
  return `OPT-${Date.now().toString().slice(-4)}`;
};

// @desc Public registration disabled (Admin authorization required)
// @route POST /api/auth/register
export const register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Public self-registration is disabled. Employee accounts can only be created by an Administrator.',
  });

};

// @desc Login user
// @route POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId email role')
      .populate('assignedTeam', 'name leader');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.employmentStatus === 'Inactive' || user.employmentStatus === 'Terminated') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact HR or Management.',
      });
    }

    if (user.accountApprovalStatus === 'Pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account registration is pending administrator approval.',
      });
    }

    if (user.accountApprovalStatus === 'Rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account registration was not approved. Please contact HR.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    // Convert to object and omit password
    const userObj = user.toObject();
    delete userObj.password;
    userObj.profileCompletion = user.getProfileCompletion ? user.getProfileCompletion() : { percentage: 40, isComplete: false, missingFields: [] };

    await logAudit({
      req,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `User ${user.email} (${user.role}) logged in successfully.`,
    });

    res.status(200).json({
      success: true,
      token,
      user: userObj,
      profileCompletion: userObj.profileCompletion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login.',
    });
  }
};

// @desc Get current logged-in user profile
// @route GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId email role')
      .populate('assignedTeam', 'name leader');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const completion = user.getProfileCompletion ? user.getProfileCompletion() : { percentage: 40, isComplete: false, missingFields: [] };
    const userObj = user.toObject();
    userObj.profileCompletion = completion;

    res.status(200).json({
      success: true,
      user: userObj,
      profileCompletion: completion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile.',
    });
  }
};

// @desc Update self profile details (permitted fields only - phone, address, photo, emergencyContact, DOB, bio)
// @route PUT /api/auth/profile
export const updateSelfProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const {
      phone,
      address,
      emergencyContact,
      profilePicture,
      dateOfBirth,
      bio,
    } = req.body;

    // "Do not overwrite existing profile details with empty fields."
    if (phone !== undefined && typeof phone === 'string' && phone.trim() !== '') {
      user.phone = phone.trim();
    }
    if (address !== undefined && typeof address === 'string' && address.trim() !== '') {
      user.address = address.trim();
    }
    if (profilePicture !== undefined && typeof profilePicture === 'string' && profilePicture.trim() !== '') {
      user.profilePicture = profilePicture.trim();
    }
    if (dateOfBirth !== undefined && dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime())) {
        user.dateOfBirth = d;
      }
    }
    if (bio !== undefined && typeof bio === 'string' && bio.trim() !== '') {
      user.bio = bio.trim();
    }

    if (emergencyContact && typeof emergencyContact === 'object') {
      const ec = user.emergencyContact || { name: '', relationship: '', phone: '' };
      if (emergencyContact.name && typeof emergencyContact.name === 'string' && emergencyContact.name.trim() !== '') {
        ec.name = emergencyContact.name.trim();
      }
      if (emergencyContact.relationship && typeof emergencyContact.relationship === 'string' && emergencyContact.relationship.trim() !== '') {
        ec.relationship = emergencyContact.relationship.trim();
      }
      if (emergencyContact.phone && typeof emergencyContact.phone === 'string' && emergencyContact.phone.trim() !== '') {
        ec.phone = emergencyContact.phone.trim();
      }
      user.emergencyContact = ec;
    }

    const completion = user.getProfileCompletion();
    user.isProfileComplete = completion.isComplete;

    await user.save();

    const populatedUser = await User.findById(user._id)
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId email role')
      .populate('assignedTeam', 'name leader');

    await logAudit({
      req,
      action: 'UPDATE_SELF_PROFILE',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `User ${user.email} updated personal profile information.`,
    });

    const userObj = populatedUser.toObject();
    delete userObj.password;
    userObj.profileCompletion = completion;

    res.status(200).json({
      success: true,
      message: 'Profile details saved successfully.',
      user: userObj,
      profileCompletion: completion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save profile changes.',
    });
  }
};

// @desc Update self password
// @route PUT /api/auth/change-password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.',
      });
    }

    user.password = newPassword;
    await user.save();

    await logAudit({
      req,
      action: 'CHANGE_PASSWORD',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `User ${user.email} updated their password.`,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to change password.',
    });
  }
};

// @desc Logout user & terminate session
// @route POST /api/auth/logout
export const logout = async (req, res) => {
  try {
    if (req.user) {
      await logAudit({
        req,
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: req.user._id,
        changeSummary: `User ${req.user.email} (${req.user.role}) logged out successfully.`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Logout failed.',
    });
  }
};
