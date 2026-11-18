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

// @desc Get all managers and team leaders with direct reports count & teams
// @route GET /api/managers
export const getManagers = async (req, res) => {
  try {
    const { search, department, team, status, page = 1, limit = 50 } = req.query;

    const query = {
      role: { $in: ['Manager', 'Admin'] },
    };

    if (department) query.department = department;
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

    const managers = await User.find(query)
      .populate('department', 'name code')
      .populate('assignedTeam', 'name leader')
      .populate('assignedProjects', 'name clientName status')
      .populate('reportingManager', 'fullName employeeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-password');

    const total = await User.countDocuments(query);

    // Compute direct reports count and managed teams for each manager
    const managerData = await Promise.all(
      managers.map(async (m) => {
        const directReportsCount = await User.countDocuments({
          reportingManager: m._id,
          employmentStatus: { $ne: 'Terminated' },
        });

        const managedTeams = await Team.find({ leader: m._id }).select('name status members');

        const mObj = m.toObject();
        mObj.directReportsCount = directReportsCount;
        mObj.managedTeams = managedTeams;
        return mObj;
      })
    );

    res.status(200).json({
      success: true,
      managers: managerData,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch managers.',
    });
  }
};

// @desc Get single manager profile details with direct reports
// @route GET /api/managers/:id
export const getManagerById = async (req, res) => {
  try {
    const manager = await User.findById(req.params.id)
      .populate('department', 'name code')
      .populate('assignedTeam', 'name leader')
      .populate('assignedProjects', 'name clientName status')
      .populate('reportingManager', 'fullName employeeId')
      .select('-password');

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found.' });
    }

    // Direct reports
    const directReports = await User.find({ reportingManager: manager._id })
      .populate('department', 'name code')
      .populate('assignedTeam', 'name')
      .select('fullName employeeId email designation department assignedTeam employmentStatus');

    // Managed teams
    const managedTeams = await Team.find({ leader: manager._id }).populate('department', 'name');

    const managerObj = manager.toObject();
    managerObj.directReports = directReports;
    managerObj.directReportsCount = directReports.length;
    managerObj.managedTeams = managedTeams;

    res.status(200).json({
      success: true,
      manager: managerObj,
      directReports,
      directReportsCount: directReports.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve manager.' });
  }
};

// @desc Create a new manager account (Admin only)
// @route POST /api/managers
export const createManager = async (req, res) => {
  try {
    const fullName = req.body.fullName || req.body.name;
    const {
      email,
      password,
      role = 'Manager',
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
        message: 'Full Name, Work Email, and temporary Password are required.',
      });
    }

    // Duplicate email check
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Duplicate / generate employee ID
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

    // Safely resolve department
    let departmentId = null;
    if (department) {
      if (mongoose.Types.ObjectId.isValid(department)) {
        departmentId = department;
      } else {
        const foundDept = await Department.findOne({
          $or: [{ name: new RegExp(`^${department}$`, 'i') }, { code: String(department).toUpperCase() }],
        });
        if (foundDept) departmentId = foundDept._id;
      }
    }

    // Safely resolve team
    let teamId = null;
    if (assignedTeam) {
      if (mongoose.Types.ObjectId.isValid(assignedTeam)) {
        teamId = assignedTeam;
      } else {
        const foundTeam = await Team.findOne({ name: new RegExp(`^${assignedTeam}$`, 'i') });
        if (foundTeam) teamId = foundTeam._id;
      }
    }

    // Safely resolve reporting manager
    let repMgrId = null;
    if (reportingManager && mongoose.Types.ObjectId.isValid(reportingManager)) {
      repMgrId = reportingManager;
    }

    const validProjects = Array.isArray(assignedProjects)
      ? assignedProjects.filter((p) => mongoose.Types.ObjectId.isValid(p))
      : [];

    const newManager = await User.create({
      employeeId: employeeId.toUpperCase().trim(),
      fullName,
      email: email.toLowerCase().trim(),
      password,
      role: role === 'Admin' ? 'Admin' : 'Manager',
      department: departmentId,
      designation: designation || 'Team Leader',
      reportingManager: repMgrId,
      assignedTeam: teamId,
      assignedProjects: validProjects,
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

    // If assigned to a team, add to members
    if (teamId) {
      await Team.findByIdAndUpdate(teamId, { $addToSet: { members: newManager._id } });
    }

    // If assigned to projects, add to members
    if (validProjects.length > 0) {
      await Project.updateMany(
        { _id: { $in: validProjects } },
        { $addToSet: { members: newManager._id } }
      );
    }

    // Auto-initialize leave balances
    const leaveTypes = await LeaveType.find({ status: 'Active' });
    const currentYear = new Date().getFullYear();
    for (const lt of leaveTypes) {
      await LeaveBalance.create({
        user: newManager._id,
        leaveType: lt._id,
        year: currentYear,
        allocated: lt.defaultDaysPerYear,
        used: 0,
      });
    }

    await logAudit({
      req,
      action: 'CREATE_MANAGER',
      entityType: 'User',
      entityId: newManager._id,
      changeSummary: `Created manager account ${newManager.fullName} (${newManager.employeeId})`,
    });

    const userObj = newManager.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: 'Manager account created successfully.',
      manager: userObj,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create manager.' });
  }
};

// @desc Update manager profile (Admin only)
// @route PUT /api/managers/:id
export const updateManager = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Manager not found.' });
    }

    // Duplicate Email check
    if (req.body.email && req.body.email.toLowerCase().trim() !== targetUser.email) {
      const duplicateEmail = await User.findOne({
        email: req.body.email.toLowerCase().trim(),
        _id: { $ne: targetUser._id },
      });
      if (duplicateEmail) {
        return res.status(400).json({
          success: false,
          message: 'Another account already uses this email address.',
        });
      }
      targetUser.email = req.body.email.toLowerCase().trim();
    }

    // Duplicate Employee ID check
    if (req.body.employeeId && req.body.employeeId.toUpperCase().trim() !== targetUser.employeeId) {
      const duplicateId = await User.findOne({
        employeeId: req.body.employeeId.toUpperCase().trim(),
        _id: { $ne: targetUser._id },
      });
      if (duplicateId) {
        return res.status(400).json({
          success: false,
          message: 'Another account already uses this Employee ID.',
        });
      }
      targetUser.employeeId = req.body.employeeId.toUpperCase().trim();
    }

    // Prevent demoting the only remaining Admin
    if (targetUser.role === 'Admin' && req.body.role && req.body.role !== 'Admin') {
      const activeAdminCount = await User.countDocuments({ role: 'Admin', employmentStatus: 'Active' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the only remaining active Administrator account.',
        });
      }
    }

    // Sync Team assignment
    const previousTeam = targetUser.assignedTeam ? targetUser.assignedTeam.toString() : null;
    const newTeam = req.body.assignedTeam ? req.body.assignedTeam.toString() : null;
    if (previousTeam && previousTeam !== newTeam) {
      await Team.findByIdAndUpdate(previousTeam, { $pull: { members: targetUser._id } });
    }
    if (newTeam && previousTeam !== newTeam) {
      await Team.findByIdAndUpdate(newTeam, { $addToSet: { members: targetUser._id } });
    }

    // Sync Project assignments
    if (req.body.assignedProjects !== undefined) {
      const previousProjects = (targetUser.assignedProjects || []).map((p) => p.toString());
      const newProjects = Array.isArray(req.body.assignedProjects)
        ? req.body.assignedProjects.map((p) => p.toString())
        : [];

      const removedProjects = previousProjects.filter((p) => !newProjects.includes(p));
      if (removedProjects.length > 0) {
        await Project.updateMany({ _id: { $in: removedProjects } }, { $pull: { members: targetUser._id } });
      }

      const addedProjects = newProjects.filter((p) => !previousProjects.includes(p));
      if (addedProjects.length > 0) {
        await Project.updateMany({ _id: { $in: addedProjects } }, { $addToSet: { members: targetUser._id } });
      }

      targetUser.assignedProjects = newProjects;
    }

    if (req.body.name && !req.body.fullName) {
      targetUser.fullName = req.body.name;
    }

    if (req.body.department !== undefined) {
      if (!req.body.department || req.body.department === '') {
        targetUser.department = null;
      } else if (mongoose.Types.ObjectId.isValid(req.body.department)) {
        targetUser.department = req.body.department;
      } else {
        const foundDept = await Department.findOne({
          $or: [{ name: new RegExp(`^${req.body.department}$`, 'i') }, { code: String(req.body.department).toUpperCase() }],
        });
        targetUser.department = foundDept ? foundDept._id : null;
      }
    }

    if (req.body.assignedTeam !== undefined) {
      if (!req.body.assignedTeam || req.body.assignedTeam === '') {
        targetUser.assignedTeam = null;
      } else if (mongoose.Types.ObjectId.isValid(req.body.assignedTeam)) {
        targetUser.assignedTeam = req.body.assignedTeam;
      } else {
        const foundTeam = await Team.findOne({ name: new RegExp(`^${req.body.assignedTeam}$`, 'i') });
        targetUser.assignedTeam = foundTeam ? foundTeam._id : null;
      }
    }

    if (req.body.reportingManager !== undefined) {
      if (!req.body.reportingManager || req.body.reportingManager === '' || !mongoose.Types.ObjectId.isValid(req.body.reportingManager)) {
        targetUser.reportingManager = null;
      } else {
        targetUser.reportingManager = req.body.reportingManager;
      }
    }

    const editableFields = [
      'fullName',
      'role',
      'designation',
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

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        targetUser[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    if (req.body.password && req.body.password.trim() !== '') {
      targetUser.password = req.body.password;
    }

    await targetUser.save();

    await logAudit({
      req,
      action: 'UPDATE_MANAGER',
      entityType: 'User',
      entityId: targetUser._id,
      changeSummary: `Updated manager profile for ${targetUser.fullName} (${targetUser.employeeId})`,
    });

    const populatedManager = await User.findById(targetUser._id)
      .populate('department', 'name code')
      .populate('assignedTeam', 'name leader')
      .populate('assignedProjects', 'name clientName status')
      .populate('reportingManager', 'fullName employeeId')
      .select('-password');

    res.status(200).json({
      success: true,
      message: 'Manager profile updated successfully.',
      manager: populatedManager,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update manager.' });
  }
};

// @desc Toggle manager account status (Activate / Deactivate)
// @route PATCH /api/managers/:id/status
export const toggleManagerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive', 'Probation', 'Terminated'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Manager not found.' });
    }

    // Safety guard
    if (user.role === 'Admin' && status !== 'Active') {
      const activeAdminCount = await User.countDocuments({ role: 'Admin', employmentStatus: 'Active' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the only remaining active Administrator account.',
        });
      }
    }

    user.employmentStatus = status;
    await user.save();

    await logAudit({
      req,
      action: 'CHANGE_MANAGER_STATUS',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `Changed status of manager ${user.fullName} (${user.employeeId}) to ${status}`,
    });

    const userObj = user.toObject();
    userObj.status = user.employmentStatus;

    res.status(200).json({
      success: true,
      message: `Manager status changed to ${status}.`,
      user: userObj,
      manager: userObj,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to change status.' });
  }
};

// @desc Get employees currently reporting to this manager
// @route GET /api/managers/:id/reports
export const getManagerReports = async (req, res) => {
  try {
    const manager = await User.findById(req.params.id);
    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found.' });
    }

    const directReports = await User.find({ reportingManager: manager._id })
      .populate('department', 'name code')
      .populate('assignedTeam', 'name')
      .select('fullName employeeId email designation department assignedTeam employmentStatus');

    res.status(200).json({
      success: true,
      directReports,
      count: directReports.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch direct reports.' });
  }
};

// @desc Assign / Bulk assign employees to report to this manager
// @route POST /api/managers/:id/assign-reports
export const assignReportsToManager = async (req, res) => {
  try {
    const manager = await User.findById(req.params.id);
    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found.' });
    }

    const { employeeIds } = req.body;
    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ success: false, message: 'employeeIds array is required.' });
    }

    // Prevent self-assignment
    const filteredIds = employeeIds.filter((id) => id.toString() !== manager._id.toString());

    await User.updateMany(
      { _id: { $in: filteredIds } },
      { reportingManager: manager._id }
    );

    await logAudit({
      req,
      action: 'ASSIGN_EMPLOYEES_TO_MANAGER',
      entityType: 'User',
      entityId: manager._id,
      changeSummary: `Assigned ${filteredIds.length} employee(s) to manager ${manager.fullName} (${manager.employeeId})`,
    });

    const updatedReports = await User.find({ reportingManager: manager._id })
      .populate('department', 'name code')
      .select('fullName employeeId email designation department employmentStatus');

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${filteredIds.length} employee(s) to ${manager.fullName}.`,
      directReports: updatedReports,
      count: updatedReports.length,
      assignedCount: filteredIds.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to assign employees.' });
  }
};

// @desc Reassign single employee to another manager or unassign
// @route POST /api/managers/:id/reassign-report
export const reassignReport = async (req, res) => {
  try {
    const { employeeId, newManagerId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'employeeId is required.' });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    let targetManagerName = 'No Manager (Unassigned)';
    if (newManagerId) {
      const newManager = await User.findById(newManagerId);
      if (!newManager) {
        return res.status(404).json({ success: false, message: 'Target manager not found.' });
      }
      targetManagerName = newManager.fullName;
      employee.reportingManager = newManager._id;
    } else {
      employee.reportingManager = null;
    }

    await employee.save();

    await logAudit({
      req,
      action: 'REASSIGN_EMPLOYEE',
      entityType: 'User',
      entityId: employee._id,
      changeSummary: `Reassigned employee ${employee.fullName} to ${targetManagerName}`,
    });

    res.status(200).json({
      success: true,
      message: `Employee ${employee.fullName} reassigned to ${targetManagerName}.`,
      employee,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to reassign employee.' });
  }
};

// @desc Get available employees for manager assignment
// @route GET /api/managers/available-employees
export const getAvailableEmployeesForAssignment = async (req, res) => {
  try {
    const employees = await User.find({ employmentStatus: 'Active' })
      .populate('department', 'name code')
      .populate('reportingManager', 'fullName employeeId')
      .populate('assignedTeam', 'name')
      .select('fullName employeeId email designation department reportingManager assignedTeam')
      .sort({ fullName: 1 });

    res.status(200).json({
      success: true,
      employees,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch employees.' });
  }
};

// @desc Get pending manager self-registration requests (Admin only)
// @route GET /api/managers/pending-registrations
export const getPendingManagerRegistrations = async (req, res) => {
  try {
    const pending = await User.find({ managerApprovalStatus: 'Pending' })
      .select('-password')
      .populate('department', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pendingManagers: pending,
      count: pending.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch pending manager registrations.',
    });
  }
};

// @desc Approve manager registration request (Admin only)
// @route PUT /api/managers/pending-registrations/:id/approve
export const approveManagerRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.managerApprovalStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This user's manager approval status is already "${user.managerApprovalStatus}".`,
      });
    }

    user.role = 'Manager';
    user.managerApprovalStatus = 'Approved';
    if (user.designation === 'Manager (Pending Verification)') {
      user.designation = 'Team Lead';
    }
    await user.save();

    await logAudit({
      req,
      action: 'APPROVE_MANAGER_REGISTRATION',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `Admin approved manager privileges for ${user.fullName} (${user.email}). Role upgraded to Manager.`,
    });

    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: `Manager privileges approved for ${user.fullName}. Their role is now Manager.`,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve manager registration.',
    });
  }
};

// @desc Reject manager registration request (Admin only)
// @route PUT /api/managers/pending-registrations/:id/reject
export const rejectManagerRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.managerApprovalStatus = 'Rejected';
    if (user.designation === 'Manager (Pending Verification)') {
      user.designation = 'Team Member';
    }
    await user.save();

    await logAudit({
      req,
      action: 'REJECT_MANAGER_REGISTRATION',
      entityType: 'User',
      entityId: user._id,
      changeSummary: `Admin rejected manager privileges for ${user.fullName} (${user.email}). Retained role as Employee.`,
    });

    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: `Manager request rejected for ${user.fullName}. Account remains Employee.`,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject manager registration.',
    });
  }
};
