import { Attendance } from '../models/Attendance.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { logAudit } from '../utils/audit.js';

// Format date helper: YYYY-MM-DD in local time
const getTodayDateString = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Auto-mark missed check-outs for past dates
export const autoMarkMissedCheckouts = async () => {
  try {
    const today = getTodayDateString();
    await Attendance.updateMany(
      {
        date: { $lt: today },
        checkIn: { $ne: null },
        checkOut: null,
        status: { $nin: ['On Leave', 'Weekly Off', 'Absent', 'Missed Check-out'] },
      },
      {
        status: 'Missed Check-out',
        notes: 'System auto-detected missed check-out.',
      }
    );
  } catch (err) {
    console.error('[Attendance] Auto-mark missed checkout error:', err);
  }
};

// @desc Check-in for today
// @route POST /api/attendance/check-in
export const checkIn = async (req, res) => {
  try {
    const today = getTodayDateString();
    const userId = req.user._id;

    // Check existing record to prevent duplicate check-in
    let record = await Attendance.findOne({ user: userId, date: today });
    if (record && record.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for today.',
      });
    }

    const settings = (await SystemSetting.findOne()) || {
      officeStartTime: '09:30',
      gracePeriodMinutes: 15,
    };

    const userShift = req.user.shiftTiming || {};
    const startTimeStr = userShift.startTime || settings.officeStartTime || '09:30';
    const graceMin = userShift.graceMinutes !== undefined ? userShift.graceMinutes : (settings.gracePeriodMinutes || 15);

    const now = new Date();
    // Parse office start time for today
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const officeStartTimeDate = new Date();
    officeStartTimeDate.setHours(startH, startM + graceMin, 0, 0);

    const isLate = now > officeStartTimeDate;
    let lateMinutes = 0;
    if (isLate) {
      lateMinutes = Math.round((now - officeStartTimeDate) / (1000 * 60));
    }

    if (!record) {
      record = new Attendance({
        user: userId,
        date: today,
        checkIn: now,
        status: isLate ? 'Late' : 'Present',
        isLate,
        lateMinutes,
      });
    } else {
      record.checkIn = now;
      record.status = isLate ? 'Late' : 'Present';
      record.isLate = isLate;
      record.lateMinutes = lateMinutes;
    }

    await record.save();

    res.status(200).json({
      success: true,
      message: `Checked in successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ${isLate ? `(Marked Late by ${lateMinutes}m)` : ''}`,
      attendance: record,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An attendance record already exists for today.',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Check-in failed.',
    });
  }
};

// @desc Check-out for today
// @route POST /api/attendance/check-out
export const checkOut = async (req, res) => {
  try {
    const today = getTodayDateString();
    const userId = req.user._id;

    const record = await Attendance.findOne({ user: userId, date: today });
    if (!record || !record.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You cannot check out without checking in first.',
      });
    }

    if (record.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out for today.',
      });
    }

    const settings = (await SystemSetting.findOne()) || {
      officeEndTime: '18:30',
      halfDayHoursThreshold: 4.5,
      fullDayHoursThreshold: 8,
    };

    const userShift = req.user.shiftTiming || {};
    const endTimeStr = userShift.endTime || settings.officeEndTime || '18:30';

    const now = new Date();
    record.checkOut = now;

    // Calculate working hours accurately to 2 decimal places
    const diffMs = now - new Date(record.checkIn);
    const diffHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    record.workingHours = diffHours;

    // Calculate early departure
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const officeEndTimeDate = new Date();
    officeEndTimeDate.setHours(endH, endM, 0, 0);

    const isEarlyDeparture = now < officeEndTimeDate;
    let earlyDepartureMinutes = 0;
    if (isEarlyDeparture) {
      earlyDepartureMinutes = Math.round((officeEndTimeDate - now) / (1000 * 60));
    }
    record.isEarlyDeparture = isEarlyDeparture;
    record.earlyDepartureMinutes = earlyDepartureMinutes;

    // Handle statuses: Half Day, Early Departure, Late, or Present
    if (diffHours < (settings.halfDayHoursThreshold || 4.5)) {
      if (record.status !== 'On Leave') {
        record.status = 'Half Day';
      }
    } else if (isEarlyDeparture && diffHours < (settings.fullDayHoursThreshold || 8)) {
      record.status = 'Early Departure';
    } else if (record.status === 'Half Day') {
      record.status = record.isLate ? 'Late' : 'Present';
    }

    await record.save();

    res.status(200).json({
      success: true,
      message: `Checked out successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Total: ${diffHours} hrs.${isEarlyDeparture ? ` (Left early by ${earlyDepartureMinutes}m)` : ''}`,
      attendance: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Check-out failed.',
    });
  }
};

// @desc Get today's attendance for current user
// @route GET /api/attendance/today
export const getMyTodayAttendance = async (req, res) => {
  try {
    const today = getTodayDateString();
    const record = await Attendance.findOne({ user: req.user._id, date: today });
    res.status(200).json({
      success: true,
      attendance: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get current user attendance history with filters & summaries
// @route GET /api/attendance/my-history
export const getMyAttendanceHistory = async (req, res) => {
  try {
    await autoMarkMissedCheckouts();
    const { month, year, date, status } = req.query;
    const query = { user: req.user._id };

    if (date) query.date = date;
    if (status) query.status = status;

    if (month && year) {
      const padMonth = String(month).padStart(2, '0');
      query.date = { $regex: `^${year}-${padMonth}` };
    }

    const records = await Attendance.find(query).sort({ date: -1 });

    // Summary calculation
    const totalPresent = records.filter((r) => ['Present', 'Late'].includes(r.status)).length;
    const totalLate = records.filter((r) => r.isLate).length;
    const totalHalfDay = records.filter((r) => r.status === 'Half Day').length;
    const totalEarlyDeparture = records.filter((r) => r.status === 'Early Departure' || r.isEarlyDeparture).length;
    const totalMissedCheckout = records.filter((r) => r.status === 'Missed Check-out').length;
    const totalHours = records.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);

    res.status(200).json({
      success: true,
      records,
      summary: {
        totalDays: records.length,
        totalPresent,
        totalLate,
        totalHalfDay,
        totalEarlyDeparture,
        totalMissedCheckout,
        totalHours: parseFloat(totalHours.toFixed(1)),
        avgHours: records.length > 0 ? parseFloat((totalHours / records.length).toFixed(1)) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Admin / Manager view all attendance with comprehensive filters
// @route GET /api/attendance/all
export const getAllAttendance = async (req, res) => {
  try {
    await autoMarkMissedCheckouts();
    const { date, user, status, department, startDate, endDate, month, year, search } = req.query;
    const query = {};

    // Role-based scoping for Manager
    if (req.user.role === 'Manager') {
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const directReportIds = directReports.map((u) => u._id);
      const allowedUserIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReportIds.map(String), req.user._id.toString()])
      );
      if (user && !allowedUserIds.includes(user.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to attendance records outside your team.',
        });
      }
      query.user = user ? user : { $in: allowedUserIds };
    } else if (user) {
      query.user = user;
    }

    if (date) query.date = date;
    if (status) query.status = status;

    if (month && year) {
      const padMonth = String(month).padStart(2, '0');
      query.date = { $regex: `^${year}-${padMonth}` };
    }

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    let records = await Attendance.find(query)
      .populate({
        path: 'user',
        select: 'fullName employeeId email department designation',
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ date: -1, createdAt: -1 });

    if (department) {
      records = records.filter(
        (r) =>
          r.user &&
          r.user.department &&
          (r.user.department._id?.toString() === department || r.user.department?.toString() === department)
      );
    }

    if (search) {
      const s = search.toLowerCase();
      records = records.filter(
        (r) =>
          r.user &&
          (r.user.fullName?.toLowerCase().includes(s) ||
            r.user.employeeId?.toLowerCase().includes(s) ||
            r.user.email?.toLowerCase().includes(s))
      );
    }

    const totalRecords = records.length;
    const totalPresent = records.filter((r) => ['Present', 'Late'].includes(r.status)).length;
    const totalLate = records.filter((r) => r.isLate).length;
    const totalHalfDay = records.filter((r) => r.status === 'Half Day').length;
    const totalEarlyDeparture = records.filter((r) => r.status === 'Early Departure' || r.isEarlyDeparture).length;
    const totalMissedCheckout = records.filter((r) => r.status === 'Missed Check-out').length;
    const totalHours = records.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);

    res.status(200).json({
      success: true,
      records,
      summary: {
        totalRecords,
        totalPresent,
        totalLate,
        totalHalfDay,
        totalEarlyDeparture,
        totalMissedCheckout,
        totalHours: parseFloat(totalHours.toFixed(1)),
        avgHours: totalRecords > 0 ? parseFloat((totalHours / totalRecords).toFixed(1)) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Admin manually add or update attendance for an employee
// @route POST /api/attendance/admin-mark
export const adminMarkAttendance = async (req, res) => {
  try {
    const { userId, date, checkIn, checkOut, status, notes } = req.body;
    if (!userId || !date) {
      return res.status(400).json({ success: false, message: 'User ID and Date are required.' });
    }

    let workingHours = 0;
    if (checkIn && checkOut) {
      const diffMs = new Date(checkOut) - new Date(checkIn);
      workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    const record = await Attendance.findOneAndUpdate(
      { user: userId, date },
      {
        user: userId,
        date,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        workingHours,
        status: status || 'Present',
        notes: notes || 'Adjusted by Administrator',
      },
      { upsert: true, new: true }
    );

    await logAudit({
      req,
      action: 'ADMIN_MARK_ATTENDANCE',
      entityType: 'Attendance',
      entityId: record._id,
      changeSummary: `Admin adjusted attendance for user ${userId} on ${date}: status=${status}`,
    });

    res.status(200).json({
      success: true,
      message: 'Attendance record saved successfully.',
      attendance: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Request Attendance Correction
// @route POST /api/attendance/corrections
export const requestCorrection = async (req, res) => {
  try {
    const { date, requestedCheckIn, requestedCheckOut, reason } = req.body;
    if (!date || !requestedCheckIn || !requestedCheckOut || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Date, check-in, check-out times, and reason are required.',
      });
    }

    const attendance = await Attendance.findOne({ user: req.user._id, date });

    const correction = await AttendanceCorrection.create({
      attendance: attendance ? attendance._id : null,
      user: req.user._id,
      date,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Correction request submitted for approval.',
      correction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get attendance corrections
// @route GET /api/attendance/corrections
export const getCorrections = async (req, res) => {
  try {
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
      query.user = { $in: allowedUserIds };
    }

    const corrections = await AttendanceCorrection.find(query)
      .populate('user', 'fullName employeeId email designation')
      .populate('reviewedBy', 'fullName employeeId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      corrections,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Review attendance correction (Admin / Manager)
// @route PUT /api/attendance/corrections/:id
export const reviewCorrection = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const correction = await AttendanceCorrection.findById(req.params.id);
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction request not found.' });
    }

    // Role permission check for Manager
    if (req.user.role === 'Manager') {
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const allowedUserIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReports.map((u) => u._id.toString())])
      );
      if (!allowedUserIds.includes(correction.user.toString())) {
        return res.status(403).json({
          success: false,
          message: 'You can only review attendance corrections for your assigned team members.',
        });
      }
    }

    correction.status = status;
    correction.reviewNotes = reviewNotes || '';
    correction.reviewedBy = req.user._id;
    correction.reviewedAt = new Date();
    await correction.save();

    if (status === 'Approved') {
      const diffMs = new Date(correction.requestedCheckOut) - new Date(correction.requestedCheckIn);
      const diffHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      await Attendance.findOneAndUpdate(
        { user: correction.user, date: correction.date },
        {
          checkIn: correction.requestedCheckIn,
          checkOut: correction.requestedCheckOut,
          workingHours: diffHours,
          status: 'Present',
          isLate: false,
          isEarlyDeparture: false,
          notes: `Updated via approved correction: ${reviewNotes || ''}`,
        },
        { upsert: true }
      );
    }

    await logAudit({
      req,
      action: 'REVIEW_ATTENDANCE_CORRECTION',
      entityType: 'AttendanceCorrection',
      entityId: correction._id,
      changeSummary: `${status} attendance correction for user ${correction.user} on ${correction.date}`,
    });

    res.status(200).json({
      success: true,
      message: `Correction request ${status.toLowerCase()}.`,
      correction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

