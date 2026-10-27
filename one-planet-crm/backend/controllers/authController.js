import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { logAudit } from '../utils/audit.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'one_planet_technologies_super_secure_jwt_secret_key_2025', {
    expiresIn: '7d',
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

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      console.warn(`[AuthLogin] User not found for email: '${email}'`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.employmentStatus === 'Inactive' || user.employmentStatus === 'Terminated') {
      console.warn(`[AuthLogin] User status is ${user.employmentStatus}`);
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact HR or Management.',
      });
    }

    const isMatch = await user.comparePassword(password);
    console.log(`[AuthLogin] Email: '${user.email}', Password match: ${isMatch}`);
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

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile.',
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
