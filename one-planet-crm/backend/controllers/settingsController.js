import { SystemSetting } from '../models/SystemSetting.js';
import { AuditLog } from '../models/AuditLog.js';
import { Attendance } from '../models/Attendance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { DailyWorkUpdate } from '../models/DailyWorkUpdate.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { logAudit } from '../utils/audit.js';

// @desc Get System Settings
// @route GET /api/settings
export const getSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({});
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update System Settings (Admin only)
// @route PUT /api/settings
export const updateSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create(req.body);
    } else {
      Object.assign(settings, req.body);
      await settings.save();
    }

    await logAudit({
      req,
      action: 'UPDATE_SYSTEM_SETTINGS',
      entityType: 'SystemSetting',
      entityId: settings._id,
      changeSummary: 'Updated global company and attendance configurations',
    });

    res.status(200).json({ success: true, message: 'Settings updated successfully.', settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Audit Logs (Admin only)
// @route GET /api/reports/audit-logs
export const getAuditLogs = async (req, res) => {
  try {
    const { action, entityType, limit = 100 } = req.query;
    const query = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const logs = await AuditLog.find(query)
      .populate('actingUser', 'fullName employeeId email role')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.status(200).json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Generate Report Datasets for Export (Attendance, Leaves, Updates, Tasks)
// @route GET /api/reports/export-data
export const getExportReportData = async (req, res) => {
  try {
    const { type, startDate, endDate, status, department, employee, month, year } = req.query;

    // Helper to calculate allowed user IDs based on RBAC
    const getAllowedUserIds = async () => {
      if (req.user.role === 'Employee') {
        return [req.user._id.toString()];
      }
      if (req.user.role === 'Manager') {
        const managedTeams = await Team.find({ leader: req.user._id }).select('members');
        const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
        const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
        return Array.from(
          new Set([...teamMemberIds.map(String), ...directReports.map((u) => u._id.toString()), req.user._id.toString()])
        );
      }
      return null; // Admin can access all
    };

    const allowedUserIds = await getAllowedUserIds();

    if (type === 'attendance') {
      const q = {};

      // Role filter
      if (allowedUserIds) {
        if (employee) {
          if (!allowedUserIds.includes(String(employee))) {
            return res.status(200).json({ success: true, rows: [], summary: {} });
          }
          q.user = employee;
        } else {
          q.user = { $in: allowedUserIds };
        }
      } else if (employee) {
        q.user = employee;
      }

      // Department filter
      if (department) {
        const deptUsers = await User.find({ department }).select('_id');
        const deptUserIds = deptUsers.map((u) => u._id.toString());
        if (q.user && q.user.$in) {
          q.user = { $in: q.user.$in.filter((id) => deptUserIds.includes(id)) };
        } else if (!q.user) {
          q.user = { $in: deptUserIds };
        }
      }

      // Date or Month range filter
      if (month && year) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        q.date = { $gte: startStr, $lte: endStr };
      } else if (startDate && endDate) {
        q.date = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        q.date = { $gte: startDate };
      }

      if (status) q.status = status;

      const data = await Attendance.find(q)
        .populate({
          path: 'user',
          select: 'fullName employeeId department designation',
          populate: { path: 'department', select: 'name code' },
        })
        .sort({ date: -1 });

      let totalHours = 0;
      let totalPresent = 0;
      let totalLate = 0;
      let totalHalfDay = 0;
      let totalEarlyDeparture = 0;
      let totalMissedCheckout = 0;
      let totalOnLeave = 0;
      let totalAbsent = 0;

      const rows = data.map((d) => {
        const hours = d.workingHours || 0;
        totalHours += hours;
        if (d.status === 'Present') totalPresent++;
        if (d.isLate) totalLate++;
        if (d.status === 'Half Day') totalHalfDay++;
        if (d.isEarlyDeparture || d.status === 'Early Departure') totalEarlyDeparture++;
        if (d.status === 'Missed Check-out') totalMissedCheckout++;
        if (d.status === 'On Leave') totalOnLeave++;
        if (d.status === 'Absent') totalAbsent++;

        return {
          EmployeeID: d.user?.employeeId || 'N/A',
          Name: d.user?.fullName || 'N/A',
          Department: d.user?.department?.name || 'General',
          Date: d.date,
          Status: d.status,
          CheckIn: d.checkIn ? new Date(d.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          CheckOut: d.checkOut ? new Date(d.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          WorkingHours: hours,
          IsLate: d.isLate ? 'Yes' : 'No',
          IsEarlyDeparture: d.isEarlyDeparture ? 'Yes' : 'No',
          Notes: d.notes || '',
        };
      });

      const summary = {
        totalRecords: rows.length,
        totalPresent,
        totalLate,
        totalHalfDay,
        totalEarlyDeparture,
        totalMissedCheckout,
        totalOnLeave,
        totalAbsent,
        totalHours: parseFloat(totalHours.toFixed(2)),
      };

      return res.status(200).json({ success: true, rows, summary });
    }

    if (type === 'leaves') {
      const q = {};
      if (allowedUserIds) {
        if (employee) {
          if (!allowedUserIds.includes(String(employee))) {
            return res.status(200).json({ success: true, rows: [] });
          }
          q.user = employee;
        } else {
          q.user = { $in: allowedUserIds };
        }
      } else if (employee) {
        q.user = employee;
      }

      if (department) {
        const deptUsers = await User.find({ department }).select('_id');
        const deptUserIds = deptUsers.map((u) => u._id.toString());
        if (q.user && q.user.$in) {
          q.user = { $in: q.user.$in.filter((id) => deptUserIds.includes(id)) };
        } else if (!q.user) {
          q.user = { $in: deptUserIds };
        }
      }

      if (startDate && endDate) {
        q.$or = [{ startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }];
      }
      if (status) q.status = status;

      const data = await LeaveRequest.find(q)
        .populate({
          path: 'user',
          select: 'fullName employeeId department',
          populate: { path: 'department', select: 'name' },
        })
        .populate('leaveType', 'name code')
        .sort({ createdAt: -1 });

      const rows = data.map((d) => ({
        EmployeeID: d.user?.employeeId || 'N/A',
        Name: d.user?.fullName || 'N/A',
        Department: d.user?.department?.name || 'General',
        LeaveType: d.leaveType?.name || 'N/A',
        StartDate: new Date(d.startDate).toISOString().split('T')[0],
        EndDate: new Date(d.endDate).toISOString().split('T')[0],
        Days: d.numberOfDays,
        Status: d.status,
        Reason: d.reason,
        HasAttachment: d.attachment ? 'Yes' : 'No',
      }));

      return res.status(200).json({ success: true, rows });
    }

    if (type === 'work-updates') {
      const q = {};
      if (allowedUserIds) {
        if (employee) {
          if (!allowedUserIds.includes(String(employee))) {
            return res.status(200).json({ success: true, rows: [] });
          }
          q.user = employee;
        } else {
          q.user = { $in: allowedUserIds };
        }
      } else if (employee) {
        q.user = employee;
      }

      if (startDate && endDate) q.date = { $gte: startDate, $lte: endDate };
      const data = await DailyWorkUpdate.find(q)
        .populate('user', 'fullName employeeId')
        .populate('project', 'name')
        .sort({ date: -1 });

      const rows = data.map((d) => ({
        EmployeeID: d.user?.employeeId || 'N/A',
        Name: d.user?.fullName || 'N/A',
        Date: d.date,
        Project: d.project?.name || 'General',
        CompletedWork: d.completedWork,
        Status: d.status,
        TimeSpentHours: d.timeSpentHours,
      }));

      return res.status(200).json({ success: true, rows });
    }

    res.status(400).json({ success: false, message: 'Invalid report export type specified.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

