import { Attendance } from '../models/Attendance.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
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
        status: { $nin: ['On Leave', 'Weekly Off', 'Absent', 'Missed Check-out', 'Holiday'] },
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
    const inTime = new Date(record.checkIn);
    const diffMs = now - inTime;

    if (now < inTime) {
      return res.status(400).json({
        success: false,
        message: 'Check-out timestamp must be strictly later than check-in timestamp.',
      });
    }

    record.checkOut = now;

    // Calculate working hours accurately to 2 decimal places
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
    const totalPresent = records.filter((r) => ['Present', 'Late', 'Half Day', 'Early Departure'].includes(r.status)).length;
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

// @desc Admin / Manager view all attendance with comprehensive filters, reporting managers, and correction indicators
// @route GET /api/attendance/all
export const getAllAttendance = async (req, res) => {
  try {
    await autoMarkMissedCheckouts();
    const { date, user, status, department, manager, startDate, endDate, month, year, search } = req.query;
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
        select: 'fullName employeeId email department designation reportingManager',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'reportingManager', select: 'fullName employeeId email' },
        ],
      })
      .populate('adjustedBy', 'fullName employeeId')
      .sort({ date: -1, createdAt: -1 });

    // Filter by department
    if (department) {
      records = records.filter(
        (r) =>
          r.user &&
          r.user.department &&
          (r.user.department._id?.toString() === department || r.user.department?.toString() === department)
      );
    }

    // Filter by manager (reporting manager)
    if (manager) {
      records = records.filter(
        (r) =>
          r.user &&
          r.user.reportingManager &&
          (r.user.reportingManager._id?.toString() === manager || r.user.reportingManager?.toString() === manager)
      );
    }

    // Text search by name, employee ID, or email
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

    // Enrich records with any pending/active correction requests
    const recordDates = Array.from(new Set(records.map((r) => r.date)));
    const userIds = Array.from(new Set(records.map((r) => r.user?._id).filter(Boolean)));

    const corrections = await AttendanceCorrection.find({
      user: { $in: userIds },
      date: { $in: recordDates },
    })
      .select('attendance user date status requestedCheckIn requestedCheckOut reason reviewedBy reviewedAt reviewNotes')
      .populate('reviewedBy', 'fullName employeeId');

    const correctionMap = {};
    corrections.forEach((c) => {
      const key = `${c.user.toString()}_${c.date}`;
      // Prioritize pending over finalized
      if (!correctionMap[key] || c.status === 'Pending') {
        correctionMap[key] = c;
      }
    });

    const enrichedRecords = records.map((r) => {
      const obj = r.toObject();
      const userKey = r.user?._id ? `${r.user._id.toString()}_${r.date}` : null;
      obj.correction = userKey ? correctionMap[userKey] || null : null;
      obj.hasPendingCorrection = obj.correction?.status === 'Pending';
      return obj;
    });

    const totalRecords = enrichedRecords.length;
    const totalPresent = enrichedRecords.filter((r) => ['Present', 'Late', 'Half Day', 'Early Departure'].includes(r.status)).length;
    const totalLate = enrichedRecords.filter((r) => r.isLate).length;
    const totalHalfDay = enrichedRecords.filter((r) => r.status === 'Half Day').length;
    const totalEarlyDeparture = enrichedRecords.filter((r) => r.status === 'Early Departure' || r.isEarlyDeparture).length;
    const totalMissedCheckout = enrichedRecords.filter((r) => r.status === 'Missed Check-out').length;
    const totalHours = enrichedRecords.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);

    res.status(200).json({
      success: true,
      records: enrichedRecords,
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

// @desc Get attendance operational overview for a specific date (scheduled, present, absent, leave, etc.)
// @route GET /api/attendance/overview
export const getAttendanceOverview = async (req, res) => {
  try {
    await autoMarkMissedCheckouts();
    const targetDateStr = req.query.date || getTodayDateString();

    const targetDate = new Date(targetDateStr + 'T00:00:00.000Z');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = targetDate.getUTCDay();
    const dayName = dayNames[dayIndex];

    // Check if target date is a company holiday
    const startOfDay = new Date(targetDateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(targetDateStr + 'T23:59:59.999Z');

    const holiday = await Holiday.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    const settings = (await SystemSetting.findOne()) || {
      weeklyOffs: ['Saturday', 'Sunday'],
    };

    // Active employees scoping
    let employeeQuery = { employmentStatus: 'Active' };
    if (req.user.role === 'Manager') {
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const directReportIds = directReports.map((u) => u._id);
      const allowedUserIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReportIds.map(String), req.user._id.toString()])
      );
      employeeQuery._id = { $in: allowedUserIds };
    }

    const activeEmployees = await User.find(employeeQuery).select(
      'fullName employeeId weeklyOff shiftTiming reportingManager joiningDate dateOfJoining createdAt'
    );
    const activeUserIds = activeEmployees.map((e) => e._id);

    // Attendance records for this date
    const attendanceRecords = await Attendance.find({
      date: targetDateStr,
      user: { $in: activeUserIds },
    });

    const attendanceMap = new Map();
    attendanceRecords.forEach((a) => attendanceMap.set(a.user.toString(), a));

    // Approved leaves for this date
    const approvedLeaves = await LeaveRequest.find({
      user: { $in: activeUserIds },
      status: 'Approved',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    }).distinct('user');

    const approvedLeaveUserSet = new Set(approvedLeaves.map((id) => id.toString()));

    let scheduledCount = 0;
    let weeklyOffAndHolidayCount = 0;
    let presentCount = 0;
    let lateCount = 0;
    let earlyCount = 0;
    let missedCount = 0;
    let onLeaveCount = approvedLeaveUserSet.size;
    let absentCount = 0;

    activeEmployees.forEach((emp) => {
      // Rule: Start attendance tracking from actual Date of Joining (never mark dates before joining as absent)
      let empJoining = '1970-01-01';
      const rawJoining = emp.joiningDate || emp.dateOfJoining || emp.createdAt;
      if (rawJoining) {
        const jd = new Date(rawJoining);
        if (!isNaN(jd.getTime())) empJoining = jd.toISOString().split('T')[0];
      }
      if (targetDateStr < empJoining) {
        // Not employed yet on this target date
        return;
      }

      const empOffs = (emp.weeklyOff && emp.weeklyOff.length > 0) ? emp.weeklyOff : (settings.weeklyOffs || ['Saturday', 'Sunday']);
      const isWeeklyOff = empOffs.includes(dayName);
      const isHoliday = !!holiday;

      if (isWeeklyOff || isHoliday) {
        weeklyOffAndHolidayCount++;
      } else {
        scheduledCount++;
      }

      const record = attendanceMap.get(emp._id.toString());
      if (record) {
        if (['Present', 'Late', 'Half Day', 'Early Departure'].includes(record.status) || record.checkIn) {
          presentCount++;
        }
        if (record.isLate || record.status === 'Late') {
          lateCount++;
        }
        if (record.isEarlyDeparture || record.status === 'Early Departure') {
          earlyCount++;
        }
        if (record.status === 'Missed Check-out') {
          missedCount++;
        }
        if (record.status === 'On Leave' && !approvedLeaveUserSet.has(emp._id.toString())) {
          onLeaveCount++;
        }
      } else if (!isWeeklyOff && !isHoliday && !approvedLeaveUserSet.has(emp._id.toString())) {
        // Scheduled, no attendance record, and not on approved leave -> Absent
        absentCount++;
      }
    });

    // Pending correction requests
    let correctionQuery = { status: 'Pending' };
    if (req.user.role === 'Manager') {
      correctionQuery.user = { $in: activeUserIds };
    }
    const pendingCorrections = await AttendanceCorrection.countDocuments(correctionQuery);

    res.status(200).json({
      success: true,
      overview: {
        date: targetDateStr,
        dayName,
        isHoliday: !!holiday,
        holidayName: holiday ? holiday.name : null,
        totalActiveEmployees: activeEmployees.length,
        scheduledToWork: scheduledCount,
        present: presentCount,
        absent: absentCount,
        lateArrivals: lateCount,
        onApprovedLeave: onLeaveCount,
        weeklyOffAndHoliday: weeklyOffAndHolidayCount,
        missedCheckouts: missedCount,
        earlyDepartures: earlyCount,
        pendingCorrections,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Admin manually add or update attendance for an employee with mandatory reason
// @route POST /api/attendance/admin-mark
export const adminMarkAttendance = async (req, res) => {
  try {
    const { userId, date, checkIn, checkOut, status, notes, reason } = req.body;
    if (!userId || !date) {
      return res.status(400).json({ success: false, message: 'Employee ID and Date are required.' });
    }

    const mandatoryReason = reason || notes;
    if (!mandatoryReason || mandatoryReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason or explanation is required for manual attendance adjustments.',
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Date must be formatted as YYYY-MM-DD.' });
    }

    // Validate invalid time ranges
    if (checkIn && checkOut) {
      const inTime = new Date(checkIn);
      const outTime = new Date(checkOut);
      if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid check-in or check-out timestamp.' });
      }
      if (outTime <= inTime) {
        return res.status(400).json({
          success: false,
          message: 'Check-out timestamp must be strictly later than check-in timestamp.',
        });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const settings = (await SystemSetting.findOne()) || {
      officeStartTime: '09:30',
      officeEndTime: '18:30',
      gracePeriodMinutes: 15,
      halfDayHoursThreshold: 4.5,
      fullDayHoursThreshold: 8,
    };

    let workingHours = 0;
    let isLate = false;
    let lateMinutes = 0;
    let isEarlyDeparture = false;
    let earlyDepartureMinutes = 0;

    const userShift = user.shiftTiming || {};
    const startTimeStr = userShift.startTime || settings.officeStartTime || '09:30';
    const endTimeStr = userShift.endTime || settings.officeEndTime || '18:30';
    const graceMin = userShift.graceMinutes !== undefined ? userShift.graceMinutes : (settings.gracePeriodMinutes || 15);

    // Calculate late arrival whenever checkIn exists
    if (checkIn) {
      const inTime = new Date(checkIn);
      const [startH, startM] = startTimeStr.split(':').map(Number);
      const officeStartTimeDate = new Date(checkIn);
      officeStartTimeDate.setHours(startH, startM + graceMin, 0, 0);

      if (inTime > officeStartTimeDate) {
        isLate = true;
        lateMinutes = Math.round((inTime - officeStartTimeDate) / (1000 * 60));
      }
    }

    // Calculate working hours and early departure ONLY when valid checkOut exists
    if (checkIn && checkOut) {
      const inTime = new Date(checkIn);
      const outTime = new Date(checkOut);
      const diffMs = outTime - inTime;

      if (diffMs <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Check-out timestamp must be strictly later than check-in timestamp.',
        });
      }

      workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      const [endH, endM] = endTimeStr.split(':').map(Number);
      const officeEndTimeDate = new Date(checkOut);
      officeEndTimeDate.setHours(endH, endM, 0, 0);

      if (outTime < officeEndTimeDate) {
        isEarlyDeparture = true;
        earlyDepartureMinutes = Math.round((officeEndTimeDate - outTime) / (1000 * 60));
      }
    } else {
      // Missing checkout: session remains In Progress with 0 working hours
      workingHours = 0;
      isEarlyDeparture = false;
      earlyDepartureMinutes = 0;
    }

    const record = await Attendance.findOneAndUpdate(
      { user: userId, date },
      {
        user: userId,
        date,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        workingHours,
        status: status || (isLate ? 'Late' : 'Present'),
        isLate,
        lateMinutes,
        isEarlyDeparture,
        earlyDepartureMinutes,
        notes: mandatoryReason.trim(),
        adjustedBy: req.user._id,
        adjustedReason: mandatoryReason.trim(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logAudit({
      req,
      action: 'ADMIN_MARK_ATTENDANCE',
      entityType: 'Attendance',
      entityId: record._id,
      changeSummary: `Admin adjusted attendance for ${user.fullName} (${user.employeeId}) on ${date}: status=${record.status}, hours=${workingHours}. Reason: ${mandatoryReason.trim()}`,
    });

    const populatedRecord = await Attendance.findById(record._id)
      .populate({
        path: 'user',
        select: 'fullName employeeId email department designation reportingManager',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'reportingManager', select: 'fullName employeeId' },
        ],
      })
      .populate('adjustedBy', 'fullName employeeId');

    res.status(200).json({
      success: true,
      message: 'Attendance record saved and audited successfully.',
      attendance: populatedRecord,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Request Attendance Correction (Employee)
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

    if (!reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A detailed reason is required for attendance correction requests.',
      });
    }

    const inTime = new Date(requestedCheckIn);
    const outTime = new Date(requestedCheckOut);
    if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid check-in or check-out timestamp.' });
    }

    if (outTime <= inTime) {
      return res.status(400).json({
        success: false,
        message: 'Requested check-out time must be strictly after requested check-in time.',
      });
    }

    const todayStr = getTodayDateString();
    if (date > todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Correction requests cannot be submitted for future dates.',
      });
    }

    // Check correction window from settings
    const settings = (await SystemSetting.findOne()) || {
      maxCorrectionDaysAllowed: 7,
    };

    const maxDays = settings.maxCorrectionDaysAllowed || 7;
    const targetDate = new Date(date);
    const today = new Date(todayStr);
    const diffDays = Math.floor((today - targetDate) / (1000 * 60 * 60 * 24));

    if (diffDays > maxDays) {
      return res.status(400).json({
        success: false,
        message: `Correction requests for dates older than ${maxDays} days are not permitted by company policy.`,
      });
    }

    // Check if there is already a pending correction request for this date
    const existingPending = await AttendanceCorrection.findOne({
      user: req.user._id,
      date,
      status: 'Pending',
    });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'A pending correction request already exists for this date. Please await review.',
      });
    }

    const attendance = await Attendance.findOne({ user: req.user._id, date });

    const correction = await AttendanceCorrection.create({
      attendance: attendance ? attendance._id : null,
      user: req.user._id,
      date,
      requestedCheckIn: inTime,
      requestedCheckOut: outTime,
      reason: reason.trim(),
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Correction request submitted successfully and queued for management approval.',
      correction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get attendance corrections with role-based scoping
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

    if (req.query.status) {
      query.status = req.query.status;
    }

    const corrections = await AttendanceCorrection.find(query)
      .populate('user', 'fullName employeeId email designation department')
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
      return res.status(400).json({ success: false, message: 'Invalid status. Must be Approved or Rejected.' });
    }

    const correction = await AttendanceCorrection.findById(req.params.id);
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction request not found.' });
    }

    if (correction.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This correction request has already been ${correction.status.toLowerCase()}.`,
      });
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

    const user = await User.findById(correction.user);
    const settings = (await SystemSetting.findOne()) || {
      officeStartTime: '09:30',
      officeEndTime: '18:30',
      gracePeriodMinutes: 15,
      halfDayHoursThreshold: 4.5,
      fullDayHoursThreshold: 8,
    };

    correction.status = status;
    correction.reviewNotes = reviewNotes || '';
    correction.reviewedBy = req.user._id;
    correction.reviewedAt = new Date();
    await correction.save();

    if (status === 'Approved') {
      const inTime = new Date(correction.requestedCheckIn);
      const outTime = new Date(correction.requestedCheckOut);
      const diffMs = outTime - inTime;
      const diffHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      // Calculate shift timings and late arrival
      const userShift = (user && user.shiftTiming) || {};
      const startTimeStr = userShift.startTime || settings.officeStartTime || '09:30';
      const endTimeStr = userShift.endTime || settings.officeEndTime || '18:30';
      const graceMin = userShift.graceMinutes !== undefined ? userShift.graceMinutes : (settings.gracePeriodMinutes || 15);

      const [startH, startM] = startTimeStr.split(':').map(Number);
      const officeStartTimeDate = new Date(inTime);
      officeStartTimeDate.setHours(startH, startM + graceMin, 0, 0);

      const isLate = inTime > officeStartTimeDate;
      const lateMinutes = isLate ? Math.round((inTime - officeStartTimeDate) / (1000 * 60)) : 0;

      const [endH, endM] = endTimeStr.split(':').map(Number);
      const officeEndTimeDate = new Date(outTime);
      officeEndTimeDate.setHours(endH, endM, 0, 0);

      const isEarlyDeparture = outTime < officeEndTimeDate;
      const earlyDepartureMinutes = isEarlyDeparture ? Math.round((officeEndTimeDate - outTime) / (1000 * 60)) : 0;

      let calculatedStatus = 'Present';
      if (diffHours < (settings.halfDayHoursThreshold || 4.5)) {
        calculatedStatus = 'Half Day';
      } else if (isEarlyDeparture && diffHours < (settings.fullDayHoursThreshold || 8)) {
        calculatedStatus = 'Early Departure';
      } else if (isLate) {
        calculatedStatus = 'Late';
      }

      await Attendance.findOneAndUpdate(
        { user: correction.user, date: correction.date },
        {
          checkIn: inTime,
          checkOut: outTime,
          workingHours: diffHours,
          status: calculatedStatus,
          isLate,
          lateMinutes,
          isEarlyDeparture,
          earlyDepartureMinutes,
          notes: `Updated via approved correction. Reason: ${correction.reason}${reviewNotes ? ` (Notes: ${reviewNotes})` : ''}`,
          adjustedBy: req.user._id,
          adjustedReason: `Approved correction: ${correction.reason}`,
        },
        { upsert: true }
      );
    }

    await logAudit({
      req,
      action: 'REVIEW_ATTENDANCE_CORRECTION',
      entityType: 'AttendanceCorrection',
      entityId: correction._id,
      changeSummary: `${status} attendance correction for employee ${user?.fullName || correction.user} on ${correction.date}. Reviewer notes: ${reviewNotes || 'None'}`,
    });

    res.status(200).json({
      success: true,
      message: `Correction request has been ${status.toLowerCase()} successfully.`,
      correction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get attendance settings (Admin only)
// @route GET /api/attendance/settings
export const getAttendanceSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({});
    }

    res.status(200).json({
      success: true,
      settings: {
        companyName: settings.companyName,
        companyTimezone: settings.companyTimezone,
        officeStartTime: settings.officeStartTime || '09:30',
        officeEndTime: settings.officeEndTime || '18:30',
        gracePeriodMinutes: settings.gracePeriodMinutes !== undefined ? settings.gracePeriodMinutes : 15,
        weeklyOffs: settings.weeklyOffs || ['Saturday', 'Sunday'],
        dailyWorkUpdateDeadline: settings.dailyWorkUpdateDeadline || '20:00',
        halfDayHoursThreshold: settings.halfDayHoursThreshold || 4.5,
        fullDayHoursThreshold: settings.fullDayHoursThreshold || 8,
        earlyDepartureThresholdMinutes: settings.earlyDepartureThresholdMinutes || 30,
        maxCorrectionDaysAllowed: settings.maxCorrectionDaysAllowed || 7,
        allowCorrectionWeekends: settings.allowCorrectionWeekends !== undefined ? settings.allowCorrectionWeekends : true,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update attendance settings (Admin only)
// @route PUT /api/attendance/settings
export const updateAttendanceSettings = async (req, res) => {
  try {
    const {
      officeStartTime,
      officeEndTime,
      gracePeriodMinutes,
      weeklyOffs,
      dailyWorkUpdateDeadline,
      halfDayHoursThreshold,
      fullDayHoursThreshold,
      earlyDepartureThresholdMinutes,
      maxCorrectionDaysAllowed,
      allowCorrectionWeekends,
    } = req.body;

    // Validations
    if (officeStartTime && !/^\d{2}:\d{2}$/.test(officeStartTime)) {
      return res.status(400).json({ success: false, message: 'Office start time must be in HH:mm format (e.g. 09:30).' });
    }
    if (officeEndTime && !/^\d{2}:\d{2}$/.test(officeEndTime)) {
      return res.status(400).json({ success: false, message: 'Office end time must be in HH:mm format (e.g. 18:30).' });
    }
    if (gracePeriodMinutes !== undefined && (isNaN(gracePeriodMinutes) || gracePeriodMinutes < 0)) {
      return res.status(400).json({ success: false, message: 'Grace period must be a non-negative number of minutes.' });
    }
    if (halfDayHoursThreshold && fullDayHoursThreshold && Number(halfDayHoursThreshold) >= Number(fullDayHoursThreshold)) {
      return res.status(400).json({ success: false, message: 'Full-day hours threshold must be greater than half-day hours threshold.' });
    }

    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = new SystemSetting();
    }

    if (officeStartTime) settings.officeStartTime = officeStartTime;
    if (officeEndTime) settings.officeEndTime = officeEndTime;
    if (gracePeriodMinutes !== undefined) settings.gracePeriodMinutes = Number(gracePeriodMinutes);
    if (Array.isArray(weeklyOffs)) settings.weeklyOffs = weeklyOffs;
    if (dailyWorkUpdateDeadline) settings.dailyWorkUpdateDeadline = dailyWorkUpdateDeadline;
    if (halfDayHoursThreshold !== undefined) settings.halfDayHoursThreshold = Number(halfDayHoursThreshold);
    if (fullDayHoursThreshold !== undefined) settings.fullDayHoursThreshold = Number(fullDayHoursThreshold);
    if (earlyDepartureThresholdMinutes !== undefined) settings.earlyDepartureThresholdMinutes = Number(earlyDepartureThresholdMinutes);
    if (maxCorrectionDaysAllowed !== undefined) settings.maxCorrectionDaysAllowed = Number(maxCorrectionDaysAllowed);
    if (allowCorrectionWeekends !== undefined) settings.allowCorrectionWeekends = Boolean(allowCorrectionWeekends);

    await settings.save();

    await logAudit({
      req,
      action: 'UPDATE_ATTENDANCE_SETTINGS',
      entityType: 'SystemSetting',
      entityId: settings._id,
      changeSummary: `Admin updated attendance policy settings (Shift: ${settings.officeStartTime}-${settings.officeEndTime}, Grace: ${settings.gracePeriodMinutes}m, WeeklyOffs: ${settings.weeklyOffs.join('/')})`,
    });

    res.status(200).json({
      success: true,
      message: 'Attendance settings updated successfully.',
      settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Export filtered attendance records to CSV (Admin / Manager)
// @route GET /api/attendance/export
export const exportAttendanceCSV = async (req, res) => {
  try {
    await autoMarkMissedCheckouts();
    const { date, user, status, department, manager, startDate, endDate, month, year, search } = req.query;
    const query = {};

    if (req.user.role === 'Manager') {
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const directReportIds = directReports.map((u) => u._id);
      const allowedUserIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReportIds.map(String), req.user._id.toString()])
      );
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
        select: 'fullName employeeId email department designation reportingManager',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'reportingManager', select: 'fullName employeeId' },
        ],
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

    if (manager) {
      records = records.filter(
        (r) =>
          r.user &&
          r.user.reportingManager &&
          (r.user.reportingManager._id?.toString() === manager || r.user.reportingManager?.toString() === manager)
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

    // CSV Header row
    const headers = [
      'Employee Name',
      'Employee ID',
      'Department',
      'Assigned Manager',
      'Date',
      'Day',
      'Check-In Time',
      'Check-Out Time',
      'Working Hours',
      'Status',
      'Late Arrival',
      'Early Departure',
      'Notes & Audit Reason',
    ];

    const rows = records.map((r) => {
      const rowDate = new Date(r.date);
      const dayName = isNaN(rowDate) ? '' : rowDate.toLocaleDateString('en-US', { weekday: 'short' });
      const inTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const outTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const lateStr = r.isLate ? `Yes (+${r.lateMinutes}m)` : 'No';
      const earlyStr = r.isEarlyDeparture ? `Yes (-${r.earlyDepartureMinutes}m)` : 'No';
      const notesClean = (r.notes || '').replace(/"/g, '""');

      return [
        `"${r.user?.fullName || 'N/A'}"`,
        `"${r.user?.employeeId || 'N/A'}"`,
        `"${r.user?.department?.name || 'N/A'}"`,
        `"${r.user?.reportingManager?.fullName || 'N/A'}"`,
        `"${r.date}"`,
        `"${dayName}"`,
        `"${inTime}"`,
        `"${outTime}"`,
        `"${r.workingHours || 0} hrs"`,
        `"${r.status}"`,
        `"${lateStr}"`,
        `"${earlyStr}"`,
        `"${notesClean}"`,
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');
    const filename = `one_planet_attendance_${date || `${year || 'all'}_${month || 'all'}`}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
