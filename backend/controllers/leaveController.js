import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';
import { Attendance } from '../models/Attendance.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { logAudit } from '../utils/audit.js';
import { getEmployeeLeaveAccrualSummary } from '../utils/leaveAccrual.js';
import { calculateWorkingDays } from '../utils/workingDays.js';

// @desc Get Leave Types (Kept for historical record queries and backwards compatibility)
// @route GET /api/leaves/types
export const getLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveType.find();
    res.status(200).json({ success: true, leaveTypes: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create Leave Type (Admin)
// @route POST /api/leaves/types
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

// @desc Get current user's leave balance & accrual summary under Single Leave Policy
// @route GET /api/leaves/balances/my
export const getMyLeaveBalances = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const accrualSummary = await getEmployeeLeaveAccrualSummary(req.user._id, { year: currentYear });
    const unifiedBalance = await LeaveBalance.findOne({ user: req.user._id, year: currentYear, leaveType: null });
    const balances = await LeaveBalance.find({ user: req.user._id, year: currentYear }).populate('leaveType');

    res.status(200).json({
      success: true,
      balances,
      unifiedBalance: unifiedBalance || {
        allocated: accrualSummary.annualEntitlement,
        used: accrualSummary.totalLeaveTakenYear,
        availableBalance: accrualSummary.availableBalance,
        pendingDays: accrualSummary.pendingDays,
      },
      availableLeave: accrualSummary.availableBalance,
      totalAllowance: accrualSummary.annualEntitlement,
      leaveUsed: accrualSummary.totalLeaveTakenYear,
      pendingRequests: accrualSummary.pendingRequestsCount,
      accrualSummary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Employee Monthly Leave Accrual & Carry-Forward Summary
// @route GET /api/leaves/accrual-summary
export const getMyAccrualSummary = async (req, res) => {
  try {
    const { user: requestedUser, year, asOfDate } = req.query;
    let targetUserId = req.user._id;

    if (requestedUser && (req.user.role === 'Admin' || req.user.role === 'Manager')) {
      targetUserId = requestedUser;
    }

    const summary = await getEmployeeLeaveAccrualSummary(targetUserId, {
      year: year ? Number(year) : undefined,
      asOfDate: asOfDate ? new Date(asOfDate) : undefined,
    });

    res.status(200).json({
      success: true,
      summary,
      availableLeave: summary.availableBalance,
      totalAllowance: summary.annualEntitlement,
      leaveUsed: summary.totalLeaveTakenYear,
      pendingRequests: summary.pendingRequestsCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Leave Policy Configuration
// @route GET /api/leaves/policy
export const getLeavePolicy = async (req, res) => {
  try {
    let setting = await SystemSetting.findOne();
    if (!setting) {
      setting = await SystemSetting.create({});
    }
    const policy = setting.leavePolicy || {
      monthlyAccrualRate: 1,
      annualEntitlement: 12,
      carryForwardEnabled: true,
      accrualDayOfMonth: 1,
    };
    res.status(200).json({ success: true, policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update Leave Policy Configuration (Admin only)
// @route PUT /api/leaves/policy
export const updateLeavePolicy = async (req, res) => {
  try {
    const { monthlyAccrualRate, annualEntitlement, carryForwardEnabled, accrualDayOfMonth } = req.body;
    let setting = await SystemSetting.findOne();
    if (!setting) {
      setting = await SystemSetting.create({});
    }

    if (!setting.leavePolicy) {
      setting.leavePolicy = {};
    }

    if (monthlyAccrualRate !== undefined) setting.leavePolicy.monthlyAccrualRate = Number(monthlyAccrualRate);
    if (annualEntitlement !== undefined) setting.leavePolicy.annualEntitlement = Number(annualEntitlement);
    if (carryForwardEnabled !== undefined) setting.leavePolicy.carryForwardEnabled = !!carryForwardEnabled;
    if (accrualDayOfMonth !== undefined) setting.leavePolicy.accrualDayOfMonth = Number(accrualDayOfMonth);

    await setting.save();

    await logAudit({
      req,
      action: 'UPDATE_LEAVE_POLICY',
      entityType: 'SystemSetting',
      entityId: setting._id,
      changeSummary: `Updated leave policy: ${setting.leavePolicy.monthlyAccrualRate} days/mo, ${setting.leavePolicy.annualEntitlement} annual entitlement, carry-forward: ${setting.leavePolicy.carryForwardEnabled}`,
    });

    res.status(200).json({
      success: true,
      message: 'Leave policy updated successfully.',
      policy: setting.leavePolicy,
    });
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
    if (!user || allocated === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User and allocated days are required.',
      });
    }

    const targetYear = year ? Number(year) : new Date().getFullYear();
    const query = { user, year: targetYear };
    if (leaveType) query.leaveType = leaveType;
    else query.leaveType = null;

    const balance = await LeaveBalance.findOneAndUpdate(
      query,
      { allocated: Number(allocated) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('leaveType');

    await logAudit({
      req,
      action: 'ALLOCATE_LEAVE_BALANCE',
      entityType: 'LeaveBalance',
      entityId: balance._id,
      changeSummary: `Allocated ${allocated} days to user ${user} for year ${targetYear}`,
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

// @desc Apply for leave (Single 12-Day Leave Policy, Weekend & Holiday Exclusion, Advance Applications)
// @route POST /api/leaves
export const applyLeave = async (req, res) => {
  try {
    const { startDate, endDate, isHalfDay, halfDayPeriod, reason, attachment, leaveType } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, and reason are required.',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date or end date format.',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date.',
      });
    }

    // Calculate working days strictly excluding Saturdays, Sundays, and Company Holidays
    const workingInfo = await calculateWorkingDays({
      startDate: start,
      endDate: end,
      isHalfDay: !!isHalfDay,
    });

    if (workingInfo.workingDays <= 0) {
      return res.status(400).json({
        success: false,
        message: 'The selected date range contains only weekends or company holidays. No working days requested.',
        excludedDates: workingInfo.excludedDates,
      });
    }

    const numberOfDays = workingInfo.workingDays;

    // Check conflicting overlapping leave requests (only Pending or Approved)
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

    // Project employee available balance as of the requested leave month (Advance application support)
    const leaveYear = start.getFullYear();
    const accrualSummary = await getEmployeeLeaveAccrualSummary(req.user._id, {
      year: leaveYear,
      asOfDate: start,
    });

    const projectedAvailableBalance = accrualSummary.availableBalance;

    // Automatic LOP Calculation:
    // Paid Leave = Minimum(Requested Working Days, Projected Available Balance)
    // LOP Days = Maximum(0, Requested Working Days - Projected Available Balance)
    const paidLeaveDays = Math.min(numberOfDays, Math.max(0, projectedAvailableBalance));
    const lopDays = Math.max(0, Math.round((numberOfDays - paidLeaveDays) * 100) / 100);

    // Create leave application in 'Pending' status (never reject advance application; does NOT deduct balance until approved)
    const leaveRequest = await LeaveRequest.create({
      user: req.user._id,
      leaveType: leaveType || null,
      startDate: start,
      endDate: end,
      isHalfDay: !!isHalfDay,
      halfDayPeriod: halfDayPeriod || 'None',
      numberOfDays,
      paidLeaveDays,
      lopDays,
      availableBalanceAtRequest: projectedAvailableBalance,
      reason,
      attachment: attachment || '',
      status: 'Pending',
    });

    const statusMessage = lopDays > 0
      ? `Leave application submitted for ${numberOfDays} working day(s). Breakdown: ${paidLeaveDays} Paid day(s), ${lopDays} Loss of Pay (LOP) day(s). Pending review.`
      : `Leave application submitted for ${numberOfDays} working day(s). Pending review.`;

    res.status(201).json({
      success: true,
      message: statusMessage,
      leaveRequest,
      breakdown: {
        requestedDays: numberOfDays,
        workingDays: numberOfDays,
        totalCalendarDays: workingInfo.totalCalendarDays,
        weekendDays: workingInfo.weekendDays,
        holidayDays: workingInfo.holidayDays,
        availableBalance: projectedAvailableBalance,
        paidLeaveDays,
        lopDays,
        excludedDates: workingInfo.excludedDates,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Preview working days and LOP Breakdown before submission
// @route GET /api/leaves/preview-lop
export const previewLopBreakdown = async (req, res) => {
  try {
    const { startDate, endDate, isHalfDay } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ success: false, message: 'Invalid date range.' });
    }

    // Exclude weekends and official company holidays
    const workingInfo = await calculateWorkingDays({
      startDate: start,
      endDate: end,
      isHalfDay: isHalfDay === 'true' || isHalfDay === true,
    });

    const numberOfDays = workingInfo.workingDays;
    const leaveYear = start.getFullYear();

    // Project balance as of leave start date
    const accrualSummary = await getEmployeeLeaveAccrualSummary(req.user._id, {
      year: leaveYear,
      asOfDate: start,
    });

    const availableBalance = accrualSummary.availableBalance;
    const paidLeaveDays = Math.min(numberOfDays, Math.max(0, availableBalance));
    const lopDays = Math.max(0, Math.round((numberOfDays - paidLeaveDays) * 100) / 100);

    res.status(200).json({
      success: true,
      breakdown: {
        requestedDays: numberOfDays,
        workingDays: numberOfDays,
        totalCalendarDays: workingInfo.totalCalendarDays,
        weekendDays: workingInfo.weekendDays,
        holidayDays: workingInfo.holidayDays,
        availableBalance,
        paidLeaveDays,
        lopDays,
        hasLop: lopDays > 0,
        excludedDates: workingInfo.excludedDates,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Leave Requests
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

// @desc Cancel leave request (Employee own leave; handles pending or approved cancellation)
// @route PUT /api/leaves/:id/cancel
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (leave.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this request' });
    }

    if (leave.status === 'Cancelled' || leave.status === 'Rejected') {
      return res.status(400).json({ success: false, message: `Leave is already ${leave.status.toLowerCase()}` });
    }

    // If leave was Approved, roll back used paid days and attendance records
    if (leave.status === 'Approved') {
      const currentYear = new Date(leave.startDate).getFullYear();
      const paidToRollback = leave.paidLeaveDays !== undefined && leave.paidLeaveDays !== null
        ? leave.paidLeaveDays
        : leave.numberOfDays;

      if (paidToRollback > 0) {
        await LeaveBalance.findOneAndUpdate(
          { user: leave.user, year: currentYear, leaveType: null },
          { $inc: { used: -paidToRollback } }
        );
        if (leave.leaveType) {
          await LeaveBalance.findOneAndUpdate(
            { user: leave.user, leaveType: leave.leaveType, year: currentYear },
            { $inc: { used: -paidToRollback } }
          );
        }
      }

      const workingInfo = await calculateWorkingDays({
        startDate: leave.startDate,
        endDate: leave.endDate,
        isHalfDay: leave.isHalfDay,
      });

      for (const dateStr of workingInfo.workingDates) {
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
      }

      leave.paidLeaveDays = 0;
      leave.lopDays = 0;
      await getEmployeeLeaveAccrualSummary(leave.user, { year: currentYear });
    }

    leave.status = 'Cancelled';
    await leave.save();

    await logAudit({
      req,
      action: 'CANCEL_LEAVE',
      entityType: 'LeaveRequest',
      entityId: leave._id,
      changeSummary: `Employee cancelled leave application for ${leave.numberOfDays} days`,
    });

    res.status(200).json({ success: true, message: 'Leave request cancelled successfully.', leave });
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

    // Prevent duplicate approval
    if (leave.status === 'Approved' && status === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'This leave request is already approved.',
      });
    }

    // Handle rejection of previously approved leave (safe rollback)
    if (leave.status === 'Approved' && status === 'Rejected') {
      const currentYear = new Date(leave.startDate).getFullYear();
      const paidToRollback = leave.paidLeaveDays || 0;
      if (paidToRollback > 0) {
        await LeaveBalance.findOneAndUpdate(
          { user: leave.user, year: currentYear, leaveType: null },
          { $inc: { used: -paidToRollback } }
        );
      }

      const workingInfo = await calculateWorkingDays({
        startDate: leave.startDate,
        endDate: leave.endDate,
        isHalfDay: leave.isHalfDay,
      });

      for (const dateStr of workingInfo.workingDates) {
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
      }

      leave.status = 'Rejected';
      leave.paidLeaveDays = 0;
      leave.lopDays = 0;
      leave.reviewNotes = reviewNotes || '';
      leave.reviewedBy = req.user._id;
      leave.reviewedAt = new Date();
      await leave.save();

      await getEmployeeLeaveAccrualSummary(leave.user, { year: currentYear });

      await logAudit({
        req,
        action: 'REVIEW_LEAVE',
        entityType: 'LeaveRequest',
        entityId: leave._id,
        changeSummary: `Rejected previously approved leave application for user ${leave.user}`,
      });

      return res.status(200).json({
        success: true,
        message: 'Leave request rejected and balance rolled back.',
        leave,
      });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This leave request is already ${leave.status}.`,
      });
    }

    // If approved, recalculate working days (excluding weekends & holidays), available balance, deduct ONLY paid days
    if (status === 'Approved') {
      const workingInfo = await calculateWorkingDays({
        startDate: leave.startDate,
        endDate: leave.endDate,
        isHalfDay: leave.isHalfDay,
      });

      const workingDays = workingInfo.workingDays;
      leave.numberOfDays = workingDays;

      const currentYear = new Date(leave.startDate).getFullYear();

      // Recalculate employee balance as of leave start date
      const accrualSummary = await getEmployeeLeaveAccrualSummary(leave.user, {
        year: currentYear,
        asOfDate: leave.startDate,
      });

      const currentAvailable = accrualSummary.availableBalance;
      const approvedPaidDays = Math.min(workingDays, Math.max(0, currentAvailable));
      const approvedLopDays = Math.max(0, Math.round((workingDays - approvedPaidDays) * 100) / 100);

      leave.paidLeaveDays = approvedPaidDays;
      leave.lopDays = approvedLopDays;
      leave.status = status;
      leave.reviewNotes = reviewNotes || '';
      leave.reviewedBy = req.user._id;
      leave.reviewedAt = new Date();
      await leave.save();

      // Deduct ONLY approved paid leave days from unified balance (preventing duplicate deduction)
      if (approvedPaidDays > 0) {
        await LeaveBalance.findOneAndUpdate(
          { user: leave.user, year: currentYear, leaveType: null },
          { $inc: { used: approvedPaidDays } },
          { upsert: true }
        );

        if (leave.leaveType) {
          await LeaveBalance.findOneAndUpdate(
            { user: leave.user, leaveType: leave.leaveType._id || leave.leaveType, year: currentYear },
            { $inc: { used: approvedPaidDays } },
            { upsert: true }
          );
        }
      }

      // Create or update attendance records ONLY for working dates (strictly excluding weekends & holidays)
      let paidDayCounter = 0;
      for (const dateStr of workingInfo.workingDates) {
        let dayNote = `Approved Leave (${leave.reason})`;
        if (approvedLopDays > 0) {
          if (paidDayCounter < approvedPaidDays) {
            dayNote = `Approved Paid Leave (${leave.reason})`;
          } else {
            dayNote = `Approved Leave - Loss of Pay (LOP) (${leave.reason})`;
          }
        }
        await Attendance.findOneAndUpdate(
          { user: leave.user, date: dateStr },
          {
            status: leave.isHalfDay ? 'Half Day' : 'On Leave',
            notes: dayNote,
          },
          { upsert: true }
        );
        paidDayCounter += leave.isHalfDay ? 0.5 : 1;
      }

      // Synchronize monthly accrual calculations
      await getEmployeeLeaveAccrualSummary(leave.user, { year: currentYear });
    } else {
      leave.status = status;
      leave.reviewNotes = reviewNotes || '';
      leave.reviewedBy = req.user._id;
      leave.reviewedAt = new Date();
      await leave.save();
    }

    await logAudit({
      req,
      action: 'REVIEW_LEAVE',
      entityType: 'LeaveRequest',
      entityId: leave._id,
      changeSummary: `${status} leave application for user ${leave.user} (${leave.numberOfDays} working days, ${leave.paidLeaveDays || 0} paid, ${leave.lopDays || 0} LOP)`,
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

    // If leave was Approved, roll back used paid days and attendance
    if (leave.status === 'Approved') {
      const currentYear = new Date(leave.startDate).getFullYear();
      const paidToRollback = leave.paidLeaveDays !== undefined && leave.paidLeaveDays !== null
        ? leave.paidLeaveDays
        : leave.numberOfDays;

      if (paidToRollback > 0) {
        await LeaveBalance.findOneAndUpdate(
          { user: leave.user, year: currentYear, leaveType: null },
          { $inc: { used: -paidToRollback } }
        );
        if (leave.leaveType) {
          await LeaveBalance.findOneAndUpdate(
            { user: leave.user, leaveType: leave.leaveType, year: currentYear },
            { $inc: { used: -paidToRollback } }
          );
        }
      }

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

      await getEmployeeLeaveAccrualSummary(leave.user, { year: currentYear });
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
