import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Team } from '../models/Team.js';
import { Project } from '../models/Project.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';
import { logAudit } from '../utils/audit.js';

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

// @desc Get all employees (Admin can view all, Manager can view team members or all directory)
// @route GET /api/users
export const getUsers = async (req, res) => {
  try {
    const { department, role, status, team, search, page = 1, limit = 50 } = req.query;

    const query = {};

    if (department) query.department = department;
    if (role) query.role = role;
    if (status) query.employmentStatus = status;
    if (team) query.assignedTeam = team;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const users = await User.find(query)
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId email role')
      .populate('assignedTeam', 'name')
      .populate('assignedProjects', 'name clientName status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-password');

    const total = await User.countDocuments(query);

    // Restrict sensitive employment documents: Employees cannot view other employees' documents
    const isEmployee = req.user.role === 'Employee';
    const sanitizedUsers = users.map((u) => {
      const obj = u.toObject();
      if (isEmployee && String(obj._id) !== String(req.user._id)) {
        delete obj.documents;
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      users: sanitizedUsers,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employees.',
    });
  }
};

// @desc Get single employee by ID
// @route GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId email role')
      .populate('assignedTeam', 'name leader')
      .populate('assignedProjects', 'name clientName status')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    const userObj = user.toObject();

    // Restrict sensitive documents to authorized users (Admins, Managers, or the employee themselves)
    const isEmployee = req.user.role === 'Employee';
    if (isEmployee && String(req.user._id) !== String(user._id)) {
      delete userObj.documents;
    }

    res.status(200).json({
      success: true,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employee.',
    });
  }
};

// @desc Create new employee (Admin only)
// @route POST /api/users
export const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role = 'Employee',
      department,
      designation,
      reportingManager,
      assignedTeam,
      assignedProjects,
      employmentType,
      phone,
      dateOfBirth,
      joiningDate,
      address,
      shiftTiming,
      weeklyOff,
      emergencyContact,
      documents,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Email, and temporary Password are required.',
      });
    }

    // Role safety: only Admin can assign role
    if (req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only Administrators can create new accounts.',
      });
    }

    // Check duplicate email
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Generate unique employee ID
    let employeeId = req.body.employeeId;
    if (!employeeId) {
      employeeId = await generateNextEmployeeId();
    } else {
      const existingId = await User.findOne({ employeeId: employeeId.toUpperCase().trim() });
      if (existingId) {
        return res.status(400).json({
          success: false,
          message: 'An employee with this Employee ID already exists.',
        });
      }
    }

    const newUser = await User.create({
      employeeId: employeeId.toUpperCase().trim(),
      fullName,
      email: email.toLowerCase().trim(),
      password,
      role,
      department: department || null,
      designation: designation || 'Associate',
      reportingManager: reportingManager || null,
      assignedTeam: assignedTeam || null,
      assignedProjects: Array.isArray(assignedProjects) ? assignedProjects : [],
      employmentType: employmentType || 'Full-Time',
      employmentStatus: 'Active',
      phone: phone || '',
      dateOfBirth: dateOfBirth || null,
      joiningDate: joiningDate || Date.now(),
      address: address || '',
      shiftTiming: shiftTiming || { startTime: '09:30', endTime: '18:30', graceMinutes: 15 },
      weeklyOff: weeklyOff || ['Saturday', 'Sunday'],
      emergencyContact: emergencyContact || {},
      documents: Array.isArray(documents) ? documents : [],
    });

    // If assigned to a team, add user to team's member list
    if (assignedTeam) {
      await Team.findByIdAndUpdate(assignedTeam, { $addToSet: { members: newUser._id } });
    }

    // If assigned to projects, add user to project member lists
    if (Array.isArray(assignedProjects) && assignedProjects.length > 0) {
      await Project.updateMany(
        { _id: { $in: assignedProjects } },
        { $addToSet: { members: newUser._id } }
      );
    }

    // Auto-initialize leave balances for current year
    const leaveTypes = await LeaveType.find({ status: 'Active' });
    const currentYear = new Date().getFullYear();
    for (const lt of leaveTypes) {
      await LeaveBalance.create({
        user: newUser._id,
        leaveType: lt._id,
        year: currentYear,
        allocated: lt.defaultDaysPerYear,
        used: 0,
      });
    }

    await logAudit({
      req,
      action: 'CREATE_EMPLOYEE',
      entityType: 'User',
      entityId: newUser._id,
      changeSummary: `Created employee ${newUser.fullName} (${newUser.employeeId}, Role: ${newUser.role})`,
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create employee.',
    });
  }
};

// @desc Update employee (Admin full edit, or Employee/Manager self-profile edit)
// @route PUT /api/users/:id
export const updateUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    const isSelf = req.user._id.toString() === req.params.id;
    const isAdmin = req.user.role === 'Admin';

    // Strict Privilege Escalation Protection:
    // If not Admin, users (Employees or Managers) can ONLY update their own contact information
    if (!isAdmin) {
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update your own profile details.',
        });
      }

      // Permitted self-editable fields only
      if (req.body.phone !== undefined) targetUser.phone = req.body.phone;
      if (req.body.address !== undefined) targetUser.address = req.body.address;
      if (req.body.emergencyContact !== undefined) targetUser.emergencyContact = req.body.emergencyContact;

      await targetUser.save();

      await logAudit({
        req,
        action: 'UPDATE_SELF_PROFILE',
        entityType: 'User',
        entityId: targetUser._id,
        changeSummary: `User ${targetUser.fullName} updated personal contact details.`,
      });

      return res.status(200).json({
        success: true,
        message: 'Your profile has been updated.',
        user: targetUser,
      });
    }

    // --- Admin-only updates below ---

    // Prevent demoting the last active administrator
    if (targetUser.role === 'Admin' && req.body.role && req.body.role !== 'Admin') {
      const activeAdminCount = await User.countDocuments({ role: 'Admin', employmentStatus: 'Active' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the only remaining active Administrator account.',
        });
      }
    }

    // Prevent deactivating the last active administrator
    if (targetUser.role === 'Admin' && req.body.employmentStatus && req.body.employmentStatus !== 'Active') {
      const activeAdminCount = await User.countDocuments({ role: 'Admin', employmentStatus: 'Active' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the only remaining active Administrator account.',
        });
      }
    }

    // Duplicate Email Prevention on Edit
    if (req.body.email && req.body.email.toLowerCase().trim() !== targetUser.email) {
      const duplicateEmail = await User.findOne({
        email: req.body.email.toLowerCase().trim(),
        _id: { $ne: targetUser._id },
      });
      if (duplicateEmail) {
        return res.status(400).json({
          success: false,
          message: 'Another employee account already uses this email address.',
        });
      }
      targetUser.email = req.body.email.toLowerCase().trim();
    }

    // Duplicate Employee ID Prevention on Edit
    if (req.body.employeeId && req.body.employeeId.toUpperCase().trim() !== targetUser.employeeId) {
      const duplicateId = await User.findOne({
        employeeId: req.body.employeeId.toUpperCase().trim(),
        _id: { $ne: targetUser._id },
      });
      if (duplicateId) {
        return res.status(400).json({
          success: false,
          message: 'Another employee account already uses this Employee ID.',
        });
      }
      targetUser.employeeId = req.body.employeeId.toUpperCase().trim();
    }

    // Handle Team membership changes
    const previousTeam = targetUser.assignedTeam ? targetUser.assignedTeam.toString() : null;
    const newTeam = req.body.assignedTeam ? req.body.assignedTeam.toString() : null;

    if (previousTeam && previousTeam !== newTeam) {
      await Team.findByIdAndUpdate(previousTeam, { $pull: { members: targetUser._id } });
    }
    if (newTeam && previousTeam !== newTeam) {
      await Team.findByIdAndUpdate(newTeam, { $addToSet: { members: targetUser._id } });
    }

    // Handle Project Assignments synchronization
    if (req.body.assignedProjects !== undefined) {
      const previousProjects = (targetUser.assignedProjects || []).map((p) => p.toString());
      const newProjects = Array.isArray(req.body.assignedProjects)
        ? req.body.assignedProjects.map((p) => p.toString())
        : [];

      // Removed projects
      const removedProjects = previousProjects.filter((p) => !newProjects.includes(p));
      if (removedProjects.length > 0) {
        await Project.updateMany(
          { _id: { $in: removedProjects } },
          { $pull: { members: targetUser._id } }
        );
      }

      // Added projects
      const addedProjects = newProjects.filter((p) => !previousProjects.includes(p));
      if (addedProjects.length > 0) {
        await Project.updateMany(
          { _id: { $in: addedProjects } },
          { $addToSet: { members: targetUser._id } }
        );
      }

      targetUser.assignedProjects = newProjects;
    }

    const adminEditableFields = [
      'fullName',
      'role',
      'department',
      'designation',
      'reportingManager',
      'assignedTeam',
      'employmentType',
      'employmentStatus',
      'phone',
      'dateOfBirth',
      'joiningDate',
      'address',
      'shiftTiming',
      'weeklyOff',
      'emergencyContact',
      'documents',
    ];

    adminEditableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        targetUser[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    // Optional admin password reset for the employee
    if (req.body.password && req.body.password.trim() !== '') {
      targetUser.password = req.body.password;
    }

    await targetUser.save();

    await logAudit({
      req,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'User',
      entityId: targetUser._id,
      changeSummary: `Admin updated profile for ${targetUser.fullName} (${targetUser.employeeId}, Role: ${targetUser.role})`,
    });

    const populatedUser = await User.findById(targetUser._id)
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId email role')
      .populate('assignedTeam', 'name')
      .populate('assignedProjects', 'name clientName status')
      .select('-password');

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully.',
      user: populatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update employee.',
    });
  }
};

// @desc Admin resets employee password
// @route POST /api/users/:id/reset-password
export const resetEmployeePassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    let newPassword = req.body.password;
    if (!newPassword || newPassword.trim() === '') {
      // Generate clean random 10-character password
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
      newPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    user.password = newPassword;
    await user.save();

    await logAudit({
      req,
      action: 'RESET_EMPLOYEE_PASSWORD',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `Admin reset password for ${user.fullName} (${user.employeeId})`,
    });

    res.status(200).json({
      success: true,
      message: `Password has been reset successfully for ${user.fullName}.`,
      temporaryPassword: newPassword,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset password.',
    });
  }
};

// @desc Toggle status or deactivate employee (Admin only)
// @route PATCH /api/users/:id/status
export const toggleUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive', 'Probation', 'Terminated'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Prevent deactivating the last active Admin
    if (user.role === 'Admin' && status !== 'Active') {
      const activeAdminCount = await User.countDocuments({ role: 'Admin', employmentStatus: 'Active' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last remaining active Administrator account.',
        });
      }
    }

    user.employmentStatus = status;
    await user.save();

    await logAudit({
      req,
      action: 'CHANGE_EMPLOYEE_STATUS',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `Changed status of ${user.fullName} (${user.employeeId}) to ${status}`,
    });

    res.status(200).json({
      success: true,
      message: `Employee status changed to ${status}.`,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update status.',
    });
  }
};
