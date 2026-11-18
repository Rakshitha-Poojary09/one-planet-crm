import { Holiday } from '../models/Holiday.js';
import { CompanyEvent } from '../models/CompanyEvent.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { Team } from '../models/Team.js';
import { logAudit } from '../utils/audit.js';

export const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    const query = {};
    if (year) {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year}-12-31`);
      query.date = { $gte: start, $lte: end };
    }
    const holidays = await Holiday.find(query)
      .populate('applicableDepartment', 'name code')
      .sort({ date: 1 });
    res.status(200).json({ success: true, holidays });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createHoliday = async (req, res) => {
  try {
    const { name, date, description, type, applicableDepartment } = req.body;
    if (!name || !date) {
      return res.status(400).json({ success: false, message: 'Holiday name and date are required.' });
    }
    const holiday = await Holiday.create({
      name,
      date,
      description: description || '',
      type: type || 'Festival',
      applicableDepartment: applicableDepartment || null,
    });

    // Notify all active employees
    try {
      const activeUsers = await User.find({ status: 'Active' }).select('_id');
      if (activeUsers.length > 0) {
        const notifs = activeUsers.map((u) => ({
          recipient: u._id,
          title: 'New Company Holiday Scheduled',
          message: `Holiday "${holiday.name}" has been scheduled for ${new Date(holiday.date).toLocaleDateString()}.`,
          type: 'Announcement',
          link: '/calendar',
        }));
        await Notification.insertMany(notifs);
      }
    } catch (e) {
      console.error('Failed to dispatch holiday notifications:', e);
    }

    await logAudit({
      req,
      action: 'CREATE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      changeSummary: `Created holiday "${holiday.name}" for ${holiday.date}`,
    });

    res.status(201).json({ success: true, message: 'Holiday created successfully.', holiday });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHoliday = async (req, res) => {
  try {
    const { name, date, description, type, applicableDepartment } = req.body;
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found.' });
    }

    if (name) holiday.name = name;
    if (date) holiday.date = date;
    if (description !== undefined) holiday.description = description;
    if (type) holiday.type = type;
    if (applicableDepartment !== undefined) holiday.applicableDepartment = applicableDepartment || null;

    await holiday.save();

    // Notify all active employees
    try {
      const activeUsers = await User.find({ status: 'Active' }).select('_id');
      if (activeUsers.length > 0) {
        const notifs = activeUsers.map((u) => ({
          recipient: u._id,
          title: 'Company Holiday Updated',
          message: `Holiday "${holiday.name}" details were updated for ${new Date(holiday.date).toLocaleDateString()}.`,
          type: 'Announcement',
          link: '/calendar',
        }));
        await Notification.insertMany(notifs);
      }
    } catch (e) {
      console.error('Failed to dispatch holiday update notifications:', e);
    }

    await logAudit({
      req,
      action: 'UPDATE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      changeSummary: `Updated holiday "${holiday.name}" (${holiday.date})`,
    });

    res.status(200).json({ success: true, message: 'Holiday updated successfully.', holiday });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found.' });
    }

    await Holiday.findByIdAndDelete(req.params.id);

    // Notify all active employees
    try {
      const activeUsers = await User.find({ status: 'Active' }).select('_id');
      if (activeUsers.length > 0) {
        const notifs = activeUsers.map((u) => ({
          recipient: u._id,
          title: 'Company Holiday Removed',
          message: `Holiday "${holiday.name}" on ${new Date(holiday.date).toLocaleDateString()} has been removed from the schedule.`,
          type: 'Announcement',
          link: '/calendar',
        }));
        await Notification.insertMany(notifs);
      }
    } catch (e) {
      console.error('Failed to dispatch holiday deletion notifications:', e);
    }

    await logAudit({
      req,
      action: 'DELETE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      changeSummary: `Removed holiday "${holiday.name}" (${holiday.date})`,
    });

    res.status(200).json({ success: true, message: 'Holiday removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get approved company/team leaves for the shared calendar
// @route GET /api/calendar/leaves
export const getCalendarLeaves = async (req, res) => {
  try {
    const { year, month } = req.query;
    const query = { status: 'Approved' };

    if (year) {
      const y = parseInt(year, 10);
      let start, end;
      if (month) {
        const m = parseInt(month, 10);
        start = new Date(y, m - 1, 1);
        end = new Date(y, m, 0, 23, 59, 59);
      } else {
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31, 23, 59, 59);
      }
      query.$or = [{ startDate: { $lte: end }, endDate: { $gte: start } }];
    }

    const leaves = await LeaveRequest.find(query)
      .populate('user', 'fullName employeeId department designation')
      .populate('leaveType', 'name code')
      .sort({ startDate: 1 });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const events = await CompanyEvent.find().populate('organizer', 'fullName employeeId').sort({ startDate: 1 });
    res.status(200).json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, location } = req.body;
    const event = await CompanyEvent.create({
      title,
      description,
      startDate,
      endDate: endDate || null,
      location: location || 'Headquarters / Online',
      organizer: req.user._id,
    });
    res.status(201).json({ success: true, event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, location } = req.body;
    const event = await CompanyEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (startDate) event.startDate = startDate;
    if (endDate !== undefined) event.endDate = endDate || null;
    if (location !== undefined) event.location = location || 'Headquarters / Online';

    await event.save();

    await logAudit({
      req,
      action: 'UPDATE_EVENT',
      entityType: 'CompanyEvent',
      entityId: event._id,
      changeSummary: `Updated company event "${event.title}"`,
    });

    res.status(200).json({ success: true, message: 'Event updated successfully.', event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await CompanyEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await CompanyEvent.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_EVENT',
      entityType: 'CompanyEvent',
      entityId: event._id,
      changeSummary: `Deleted event "${event.title}"`,
    });

    res.status(200).json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: Evaluate daily attendance and absence tracking for an employee based on official business rules
export const evaluateEmployeeDailyStatus = (
  emp,
  dateStr,
  holiday = null,
  leaves = [],
  attendanceRecord = null,
  todayStr = null
) => {
  if (!todayStr) {
    todayStr = new Date().toISOString().split('T')[0];
  }

  const dateObj = new Date(dateStr + 'T00:00:00.000Z');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = dateObj.getUTCDay();
  const dayName = dayNames[dayIndex];

  const empWeeklyOff =
    emp?.weeklyOff && emp.weeklyOff.length > 0 ? emp.weeklyOff : ['Saturday', 'Sunday'];
  const isWeekend = empWeeklyOff.includes(dayName);

  // 1. Employee Joining Date
  let empJoiningStr = '1970-01-01';
  const rawJoining = emp?.joiningDate || emp?.dateOfJoining || emp?.createdAt;
  if (rawJoining) {
    const jDate = new Date(rawJoining);
    if (!isNaN(jDate.getTime())) {
      empJoiningStr = jDate.toISOString().split('T')[0];
    }
  }

  const isBeforeJoining = dateStr < empJoiningStr;
  const isFuture = dateStr > todayStr;

  // Rule 1: Never mark dates before joining as Absent
  if (isBeforeJoining) {
    return {
      status: 'Before Joining',
      badgeText: `Joined on ${empJoiningStr}`,
      category: 'neutral',
      isAbsent: false,
      isAutoAbsent: false,
      color: '#94A3B8',
      bg: '#F8FAFC',
      border: '#E2E8F0',
      notes: 'Employee was not employed at the company on this date.',
    };
  }

  // Rule 2: Do not mark company public holidays as Absent
  if (holiday) {
    return {
      status: 'Public Holiday',
      badgeText: holiday.name || 'Public Holiday',
      category: 'holiday',
      holidayName: holiday.name,
      isAbsent: false,
      isAutoAbsent: false,
      color: '#1D4ED8',
      bg: '#DBEAFE',
      border: '#93C5FD',
      notes: `Official company holiday: ${holiday.name}`,
    };
  }

  // Rule 3: Do not mark weekends as Absent
  if (isWeekend) {
    return {
      status: 'Weekly Off',
      badgeText: 'Weekly Off',
      category: 'weekend',
      isAbsent: false,
      isAutoAbsent: false,
      color: '#64748B',
      bg: '#F1F5F9',
      border: '#E2E8F0',
      notes: `Scheduled weekly off (${dayName})`,
    };
  }

  // Rule 4: Do not mark approved leave as Absent
  const matchingLeave = (leaves || []).find((l) => {
    if (l.status !== 'Approved') return false;
    const sStr = new Date(l.startDate).toISOString().split('T')[0];
    const eStr = new Date(l.endDate).toISOString().split('T')[0];
    return dateStr >= sStr && dateStr <= eStr;
  });

  if (matchingLeave) {
    if (matchingLeave.isHalfDay) {
      return {
        status: 'Half Day',
        badgeText: 'Half Day (Leave)',
        category: 'halfDay',
        leaveType: matchingLeave.leaveType?.name || 'Leave',
        isAbsent: false,
        isAutoAbsent: false,
        color: '#FFFFFF',
        notes: `Approved half-day leave: ${matchingLeave.leaveType?.name || 'Leave'}`,
      };
    }
    return {
      status: 'On Leave',
      badgeText: `On Leave (${matchingLeave.leaveType?.name || 'Approved'})`,
      category: 'onLeave',
      leaveType: matchingLeave.leaveType?.name || 'Leave',
      isAbsent: false,
      isAutoAbsent: false,
      color: '#0369A1',
      bg: '#E0F2FE',
      border: '#BAE6FD',
      notes: `Approved full-day leave: ${matchingLeave.leaveType?.name || 'Leave'}`,
    };
  }

  // Rule 5: Mark Present and Late Arrival based on actual login records
  if (attendanceRecord) {
    if (attendanceRecord.status === 'Half Day') {
      return {
        status: 'Half Day',
        badgeText: 'Half Day',
        category: 'halfDay',
        isAbsent: false,
        isAutoAbsent: false,
        checkIn: attendanceRecord.checkIn,
        checkOut: attendanceRecord.checkOut,
        workingHours: attendanceRecord.workingHours,
        color: '#FFFFFF',
        notes: 'Recorded half-day attendance session.',
      };
    }
    if (attendanceRecord.isLate || attendanceRecord.status === 'Late') {
      return {
        status: 'Late',
        badgeText: `Late Arrival (+${attendanceRecord.lateMinutes || 0}m)`,
        category: 'late',
        isAbsent: false,
        isAutoAbsent: false,
        checkIn: attendanceRecord.checkIn,
        checkOut: attendanceRecord.checkOut,
        workingHours: attendanceRecord.workingHours,
        lateMinutes: attendanceRecord.lateMinutes,
        color: '#C2410C',
        bg: '#FFEDD5',
        border: '#FDBA74',
        notes: `Checked in at ${new Date(attendanceRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+${attendanceRecord.lateMinutes || 0} mins late)`,
      };
    }
    if (
      ['Present', 'Early Departure', 'Missed Check-out'].includes(attendanceRecord.status) ||
      attendanceRecord.checkIn
    ) {
      return {
        status: 'Present',
        badgeText: 'Present',
        category: 'present',
        isAbsent: false,
        isAutoAbsent: false,
        checkIn: attendanceRecord.checkIn,
        checkOut: attendanceRecord.checkOut,
        workingHours: attendanceRecord.workingHours,
        color: '#15803D',
        bg: '#DCFCE7',
        border: '#86EFAC',
        notes: `Checked in at ${new Date(attendanceRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      };
    }
    if (attendanceRecord.status === 'On Leave') {
      return {
        status: 'On Leave',
        badgeText: 'On Leave',
        category: 'onLeave',
        isAbsent: false,
        isAutoAbsent: false,
        color: '#0369A1',
        bg: '#E0F2FE',
        border: '#BAE6FD',
        notes: 'Recorded on-leave attendance status.',
      };
    }
    if (attendanceRecord.status === 'Absent') {
      return {
        status: 'Absent',
        badgeText: 'Absent',
        category: 'absent',
        isAbsent: true,
        isAutoAbsent: false,
        color: '#DC2626',
        bg: '#FEE2E2',
        border: '#FCA5A5',
        notes: 'Recorded absence for scheduled shift.',
      };
    }
  }

  // Rule 6: Do not mark future dates as Absent
  if (isFuture) {
    return {
      status: 'Upcoming',
      badgeText: 'Scheduled',
      category: 'neutral',
      isAbsent: false,
      isAutoAbsent: false,
      color: '#64748B',
      bg: '#FFFFFF',
      border: '#E2E8F0',
      notes: 'Scheduled working day in the future.',
    };
  }

  // Rule 7: Automatically mark an employee Absent (Red) if they do not log in on a scheduled working day
  return {
    status: 'Absent',
    badgeText: 'Absent (No Login)',
    category: 'absent',
    isAbsent: true,
    isAutoAbsent: true,
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FCA5A5',
    notes: 'Automatically marked Absent: No login record on scheduled working day.',
  };
};

// @desc Get role-scoped attendance, approved leaves, holidays, and events for Calendar
// @route GET /api/calendar/data
export const getCalendarData = async (req, res) => {
  try {
    const { year, month, user: targetUserId } = req.query;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || new Date().getMonth() + 1; // 1-indexed

    const padMonth = String(m).padStart(2, '0');
    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59);
    const todayStr = new Date().toISOString().split('T')[0];

    let allowedUserIds = null;
    let employees = [];

    const userSelectFields =
      'fullName employeeId department designation email joiningDate dateOfJoining createdAt weeklyOff shiftTiming employmentStatus';

    if (req.user.role === 'Admin') {
      if (targetUserId) {
        allowedUserIds = [targetUserId.toString()];
        employees = await User.find({ _id: targetUserId })
          .select(userSelectFields)
          .populate('department', 'name code');
      } else {
        employees = await User.find({ employmentStatus: 'Active' })
          .select(userSelectFields)
          .populate('department', 'name code')
          .sort({ fullName: 1 });
      }
    } else if (req.user.role === 'Manager') {
      const managedTeams = await Team.find({ leader: req.user._id }).select('members');
      const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
      const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
      const directReportIds = directReports.map((u) => u._id);
      const teamIds = Array.from(
        new Set([...teamMemberIds.map(String), ...directReportIds.map(String), req.user._id.toString()])
      );

      if (targetUserId) {
        if (!teamIds.includes(targetUserId.toString())) {
          return res.status(403).json({ success: false, message: 'Unauthorized access to employee outside your team.' });
        }
        allowedUserIds = [targetUserId.toString()];
      } else {
        allowedUserIds = teamIds;
      }

      employees = await User.find({ _id: { $in: allowedUserIds }, employmentStatus: 'Active' })
        .select(userSelectFields)
        .populate('department', 'name code')
        .sort({ fullName: 1 });
    } else {
      // Employee role: strictly self attendance and leaves
      allowedUserIds = [req.user._id.toString()];
      employees = await User.find({ _id: req.user._id })
        .select(userSelectFields)
        .populate('department', 'name code');
    }

    // 1. Attendance query
    const attendanceQuery = {
      date: { $regex: `^${y}-${padMonth}` },
    };
    if (allowedUserIds) {
      attendanceQuery.user = { $in: allowedUserIds };
    }

    const attendance = await Attendance.find(attendanceQuery)
      .populate({
        path: 'user',
        select: userSelectFields,
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ date: 1, checkIn: 1 });

    // 2. Approved leaves query (strictly status === 'Approved')
    const leavesQuery = {
      status: 'Approved',
      $or: [{ startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } }],
    };
    if (allowedUserIds) {
      leavesQuery.user = { $in: allowedUserIds };
    }

    const leaves = await LeaveRequest.find(leavesQuery)
      .populate('user', userSelectFields)
      .populate('leaveType', 'name code isPaid')
      .sort({ startDate: 1 });

    // 3. Holidays for the year
    const holidays = await Holiday.find({
      date: { $gte: new Date(`${y}-01-01`), $lte: new Date(`${y}-12-31`) },
    }).sort({ date: 1 });

    // 4. Events
    const events = await CompanyEvent.find()
      .populate('organizer', 'fullName employeeId')
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      year: y,
      month: m,
      today: todayStr,
      role: req.user.role,
      totalEmployees: employees.length,
      employees,
      attendance,
      leaves,
      holidays,
      events,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get complete employee attendance breakdown for a specific date (for Admin & Manager inspection)
// @route GET /api/calendar/date-details
export const getDateAttendanceDetails = async (req, res) => {
  try {
    const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
    const targetDateObj = new Date(targetDateStr + 'T00:00:00.000Z');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[targetDateObj.getUTCDay()];
    const todayStr = new Date().toISOString().split('T')[0];

    const holiday = await Holiday.findOne({
      date: {
        $gte: new Date(targetDateStr + 'T00:00:00.000Z'),
        $lte: new Date(targetDateStr + 'T23:59:59.999Z'),
      },
    });

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
    } else if (req.user.role === 'Employee') {
      employeeQuery._id = req.user._id;
    }

    const employees = await User.find(employeeQuery)
      .select('fullName employeeId department designation email joiningDate dateOfJoining createdAt weeklyOff shiftTiming')
      .populate('department', 'name code')
      .sort({ fullName: 1 });

    const userIds = employees.map((e) => e._id);

    const attendanceRecords = await Attendance.find({
      date: targetDateStr,
      user: { $in: userIds },
    });
    const attendanceMap = new Map();
    attendanceRecords.forEach((a) => attendanceMap.set(a.user.toString(), a));

    const approvedLeaves = await LeaveRequest.find({
      user: { $in: userIds },
      status: 'Approved',
      startDate: { $lte: new Date(targetDateStr + 'T23:59:59.999Z') },
      endDate: { $gte: new Date(targetDateStr + 'T00:00:00.000Z') },
    }).populate('leaveType', 'name isPaid');

    const leavesMap = new Map();
    approvedLeaves.forEach((l) => {
      const uId = l.user.toString();
      if (!leavesMap.has(uId)) leavesMap.set(uId, []);
      leavesMap.get(uId).push(l);
    });

    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let onLeaveCount = 0;
    let weeklyOffCount = 0;
    let holidayCount = 0;
    let beforeJoiningCount = 0;
    let scheduledCount = 0;

    const employeeStatuses = employees.map((emp) => {
      const empAtt = attendanceMap.get(emp._id.toString()) || null;
      const empLeaves = leavesMap.get(emp._id.toString()) || [];
      const statusResult = evaluateEmployeeDailyStatus(emp, targetDateStr, holiday, empLeaves, empAtt, todayStr);

      if (statusResult.status === 'Present') presentCount++;
      else if (statusResult.status === 'Late') lateCount++;
      else if (statusResult.status === 'Half Day') halfDayCount++;
      else if (statusResult.status === 'Absent') absentCount++;
      else if (statusResult.status === 'On Leave') onLeaveCount++;
      else if (statusResult.status === 'Weekly Off') weeklyOffCount++;
      else if (statusResult.status === 'Public Holiday') holidayCount++;
      else if (statusResult.status === 'Before Joining') beforeJoiningCount++;

      if (!['Weekly Off', 'Public Holiday', 'Before Joining', 'Upcoming'].includes(statusResult.status)) {
        scheduledCount++;
      }

      return {
        user: {
          _id: emp._id,
          fullName: emp.fullName,
          employeeId: emp.employeeId,
          department: emp.department,
          designation: emp.designation,
          email: emp.email,
          joiningDate: emp.joiningDate || emp.dateOfJoining || emp.createdAt,
        },
        ...statusResult,
      };
    });

    res.status(200).json({
      success: true,
      date: targetDateStr,
      dayName,
      isHoliday: !!holiday,
      holidayName: holiday ? holiday.name : null,
      summary: {
        totalEmployees: employees.length,
        scheduled: scheduledCount,
        present: presentCount,
        late: lateCount,
        halfDay: halfDayCount,
        absent: absentCount,
        onLeave: onLeaveCount,
        weeklyOff: weeklyOffCount,
        holiday: holidayCount,
        beforeJoining: beforeJoiningCount,
      },
      employees: employeeStatuses,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get company-wide attendance, approved leaves, holidays, and events for Admin Calendar (backward compatibility)
// @route GET /api/calendar/admin-data
export const getAdminCalendarData = async (req, res) => {
  return getCalendarData(req, res);
};
