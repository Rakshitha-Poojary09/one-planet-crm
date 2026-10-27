import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';
import { Attendance } from '../models/Attendance.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { logAudit } from '../utils/audit.js';

// @desc Get Leave Types
// @route GET /api/leave-types
export const getLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveType.find({ status: 'Active' });
    res.status(200).json({ success: true, leaveTypes: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create Leave Type (Admin)
// @route POST /api/leave-types
export const createLeaveType = async (req, res) => {
  try {
    const { name, code, defaultDaysPerYear, isPaid, description, carryForwardDays, carryForwardEnabled } = req.body;
    const leaveType = await LeaveType.create({
      name,
      code: code.toUpperCase().trim(),
      defaultDaysPerYear: defaultDaysPerYear || 12,
      isPaid: isPaid !== undefined ? isPaid : true,
      description,
      carryForwardDays: carryForwardDays || 0,
      carryForwardEnabled: !!carryForwardEnabled,
    });
    res.status(201).json({ success: true, leaveType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get current user's leave balances
// @route GET /api/leaves/balances/my
export const getMyLeaveBalances = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const balances = await LeaveBalance.find({ user: req.user._id, year: currentYear })
      .populate('leaveType');

    res.status(200).json({ success: true, balances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all leave balances (Admin / Manager)
// @route GET /api/leaves/balances
export const getAllLeaveBalances = async (req, res) => {
  try {
    const { user, year } = req.query;
    const query = {};
    if (user) query.user = user;
    if (year) query.year = Number(year);

    const balances = await LeaveBalance.find(query)
      .populate('user', 'fullName employeeId department')
      .populate('leaveType')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, balances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Allocate / Set Leave Balance for Employee (Admin)
// @route POST /api/leaves/balances
export const allocateLeaveBalance = async (req, res) => {
  try {
    const { user, leaveType, year, allocated } = req.body;
    if (!user || !leaveType || allocated === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User, leave type, and allocated days are required.',
      });
    }

    const targetYear = year ? Number(year) : new Date().getFullYear();
    const balance = await LeaveBalance.findOneAndUpdate(
      { user, leaveType, year: targetYear },
      { allocated: Number(allocated) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('leaveType');

    await logAudit({
      req,
      action: 'ALLOCATE_LEAVE_BALANCE',
      entityType: 'LeaveBalance',
      entityId: balance._id,
      changeSummary: `Allocated ${allocated} days for leave type ${leaveType} to user ${user} for year ${targetYear}`,
    });

    res.status(200).json({
      success: true,
      message: 'Leave quota balance allocated successfully.',
      balance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Apply for leave
// @route POST /api/leaves
export const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, isHalfDay, halfDayPeriod, reason, attachment } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, start date, end date, and reason are required.',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date.',
      });
    }

    // Calculate days
    let numberOfDays = 0;
    if (isHalfDay) {
      numberOfDays = 0.5;
    } else {
      const diffTime = Math.abs(end - start);
      numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Check conflicting leave requests
    const conflict = await LeaveRequest.findOne({
      user: req.user._id,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending or approved leave request covering these dates.',
      });
    }

    // Verify balance
    const currentYear = new Date().getFullYear();
    const balance = await LeaveBalance.findOne({
      user: req.user._id,
      leaveType,
      year: currentYear,
    });

    if (!balance || (balance.allocated - balance.used) < numberOfDays) {
      const remaining = balance ? Math.max(0, balance.allocated - balance.used) : 0;
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You have ${remaining} days available for this category. Please contact an administrator to allocate leave quota if needed.`,
      });
    }

    const leaveRequest = await LeaveRequest.create({
      user: req.user._id,
      leaveType,
      startDate: start,
      endDate: end,
      isHalfDay: !!isHalfDay,
      halfDayPeriod: halfDayPeriod || 'None',
      numberOfDays,
      reason,
      attachment: attachment || '',
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully.',
      leaveRequest,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Leave Requests (Self, or authorized team/reports for Manager, all for Admin)
// @route GET /api/leaves
export const getLeaves = async (req, res) => {
  try {
    const { status, user, department } = req.query;
    const query = {};

    if (req.user.role === 'Employee') {
      query.user = req.user._id;
    } else if (req.user.role === 'Manager') {
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const allowedUserIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReports.map((u) => u._id.toString()), req.user._id.toString()])
      );
      if (user) {
        if (!allowedUserIds.includes(String(user))) {
          return res.status(200).json({ success: true, leaves: [] });
        }
        query.user = user;
      } else {
        query.user = { $in: allowedUserIds };
      }
    } else if (user) {
      query.user = user;
    }

    if (status) query.status = status;

    let leaves = await LeaveRequest.find(query)
      .populate({
        path: 'user',
        select: 'fullName employeeId email department designation',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('leaveType', 'name code isPaid carryForwardDays')
      .populate('reviewedBy', 'fullName employeeId')
      .sort({ createdAt: -1 });

    if (department && req.user.role !== 'Employee') {
      leaves = leaves.filter(
        (l) => l.user && l.user.department && l.user.department._id.toString() === department
      );
    }

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Cancel own pending leave
// @route PUT /api/leaves/:id/cancel
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

    if (leave.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending leave requests can be cancelled directly.',
      });
    }

    leave.status = 'Cancelled';
    await leave.save();

    res.status(200).json({ success: true, message: 'Leave request cancelled.', leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Review leave request (Approve/Reject) (Admin or Manager)
// @route PUT /api/leaves/:id/review
export const reviewLeave = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected' });
    }

    const leave = await LeaveRequest.findById(req.params.id).populate('leaveType');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This leave request is already ${leave.status}.`,
      });
    }

    // Role permission check for Manager
    if (req.user.role === 'Manager') {
      if (leave.user.toString() === req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Managers cannot approve their own leave applications.',
        });
      }
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const allowedUserIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReports.map((u) => u._id.toString())])
      );
      if (!allowedUserIds.includes(leave.user.toString())) {
        return res.status(403).json({
          success: false,
          message: 'You can only review leave applications for your assigned team members.',
        });
      }
    }

    leave.status = status;
    leave.reviewNotes = reviewNotes || '';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    // If approved, update leave balance and populate attendance record with 'On Leave'
    if (status === 'Approved') {
      const currentYear = new Date(leave.startDate).getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { user: leave.user, leaveType: leave.leaveType._id, year: currentYear },
        { $inc: { used: leave.numberOfDays } },
        { upsert: true }
      );

      // Create or update attendance dates as On Leave
      const cur = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0];
        await Attendance.findOneAndUpdate(
          { user: leave.user, date: dateStr },
          {
            status: leave.isHalfDay ? 'Half Day' : 'On Leave',
            notes: `Approved Leave: ${leave.leaveType.name} (${leave.reason})`,
          },
          { upsert: true }
        );
        cur.setDate(cur.getDate() + 1);
      }
    }

    await logAudit({
      req,
      action: 'REVIEW_LEAVE',
      entityType: 'LeaveRequest',
      entityId: leave._id,
      changeSummary: `${status} leave application for user ${leave.user} (${leave.numberOfDays} days)`,
    });

    res.status(200).json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully.`,
      leave,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Delete leave request (Admin or Employee for their own cancelled/rejected leave)
// @route DELETE /api/leaves/:id
export const deleteLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const isOwner = leave.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this leave record' });
    }

    // If leave was Approved, roll back used days and attendance
    if (leave.status === 'Approved') {
      const currentYear = new Date(leave.startDate).getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { user: leave.user, leaveType: leave.leaveType, year: currentYear },
        { $inc: { used: -leave.numberOfDays } }
      );

      const cur = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0];
        const att = await Attendance.findOne({ user: leave.user, date: dateStr });
        if (att && (att.status === 'On Leave' || att.status === 'Half Day')) {
          if (!att.checkIn) {
            await Attendance.deleteOne({ _id: att._id });
          } else {
            att.status = 'Present';
            att.notes = '';
            await att.save();
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_LEAVE',
      entityType: 'LeaveRequest',
      entityId: leave._id,
      changeSummary: `Deleted leave record (${leave.numberOfDays} days) for user ${leave.user}`,
    });

    res.status(200).json({ success: true, message: 'Leave request deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
