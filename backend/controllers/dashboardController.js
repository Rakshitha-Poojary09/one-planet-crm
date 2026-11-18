import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { DailyWorkUpdate } from '../models/DailyWorkUpdate.js';
import { Holiday } from '../models/Holiday.js';
import { Announcement } from '../models/Announcement.js';
import { Team } from '../models/Team.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { Notification } from '../models/Notification.js';
import { getEmployeeLeaveAccrualSummary } from '../utils/leaveAccrual.js';

// @desc Admin Dashboard Metrics
// @route GET /api/dashboard/admin
export const getAdminDashboard = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Active Employees
    const activeUsers = await User.find({ employmentStatus: 'Active' }).select('_id');
    const totalEmployees = activeUsers.length;
    const activeUserIds = activeUsers.map((u) => u._id);

    const totalManagers = await User.countDocuments({ role: { $in: ['Manager', 'Admin'] } });
    const activeManagers = await User.countDocuments({ role: { $in: ['Manager', 'Admin'] }, employmentStatus: 'Active' });

    const todayAttendance = await Attendance.find({ date: todayStr });
    const presentToday = todayAttendance.filter((a) => ['Present', 'Late'].includes(a.status)).length;
    const lateArrivals = todayAttendance.filter((a) => a.isLate).length;

    // Accurate On-Leave calculation: includes approved leaves for today as well as check-in status
    const todayDateObj = new Date(todayStr);
    const approvedLeaveUserIds = await LeaveRequest.find({
      user: { $in: activeUserIds },
      status: 'Approved',
      startDate: { $lte: todayDateObj },
      endDate: { $gte: todayDateObj },
    }).distinct('user');

    const attendanceOnLeaveUserIds = todayAttendance
      .filter((a) => a.status === 'On Leave' || a.status === 'Half Day')
      .map((a) => a.user.toString());

    const combinedOnLeaveSet = new Set([
      ...approvedLeaveUserIds.map((id) => id.toString()),
      ...attendanceOnLeaveUserIds,
    ]);
    const onLeaveToday = combinedOnLeaveSet.size;

    const absentToday = Math.max(0, totalEmployees - (presentToday + onLeaveToday));

    const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });
    const activeProjects = await Project.countDocuments({ status: 'Active' });

    // Task and Project Progress metrics
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'Completed' });
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const projects = await Project.find({ status: { $ne: 'Completed' } }).limit(5);
    const projectsWithProgress = await Promise.all(
      projects.map(async (p) => {
        const pTasks = await Task.countDocuments({ project: p._id });
        const pCompleted = await Task.countDocuments({ project: p._id, status: 'Completed' });
        const progress = pTasks > 0 ? Math.round((pCompleted / pTasks) * 100) : 0;
        return {
          _id: p._id,
          name: p.name,
          clientName: p.clientName,
          priority: p.priority,
          deadline: p.deadline,
          totalTasks: pTasks,
          completedTasks: pCompleted,
          progress,
        };
      })
    );

    // Missing work updates today (excludes employees on approved leave)
    const submittedTodayUserIds = await DailyWorkUpdate.find({
      date: todayStr,
      user: { $in: activeUserIds },
    }).distinct('user');
    const submittedSet = new Set(submittedTodayUserIds.map((id) => id.toString()));

    const missingUpdatesToday = activeUserIds.filter(
      (uid) => !submittedSet.has(uid.toString()) && !combinedOnLeaveSet.has(uid.toString())
    ).length;

    // Overdue tasks
    const now = new Date();
    const overdueTasksCount = await Task.countDocuments({
      deadline: { $lt: now },
      status: { $ne: 'Completed' },
    });

    // Recent data feeds
    const recentAttendance = await Attendance.find({ date: todayStr })
      .populate('user', 'fullName employeeId department designation')
      .sort({ checkIn: -1 })
      .limit(6);

    const pendingLeaveList = await LeaveRequest.find({ status: 'Pending' })
      .populate('user', 'fullName employeeId department designation')
      .populate('leaveType', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUpdates = await DailyWorkUpdate.find({ date: todayStr })
      .populate('user', 'fullName employeeId designation')
      .sort({ createdAt: -1 })
      .limit(5);

    const overdueTasks = await Task.find({
      deadline: { $lt: now },
      status: { $ne: 'Completed' },
    })
      .populate('assignedTo', 'fullName employeeId')
      .populate('project', 'name')
      .limit(5);

    // Upcoming Holidays
    const upcomingHolidays = await Holiday.find({ date: { $gte: now } })
      .sort({ date: 1 })
      .limit(4);

    // Recent announcements
    const recentAnnouncements = await Announcement.find()
      .sort({ publishDate: -1 })
      .limit(3);

    // Recent Notifications
    const recentNotifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(4);

    // Upcoming Birthdays in current and next month
    const currentMonth = now.getMonth();
    const allUsersWithDob = await User.find({ employmentStatus: 'Active', dateOfBirth: { $ne: null } })
      .select('fullName employeeId department designation dateOfBirth joiningDate');

    const upcomingBirthdays = allUsersWithDob
      .filter((u) => {
        const m = new Date(u.dateOfBirth).getMonth();
        return m === currentMonth || m === (currentMonth + 1) % 12;
      })
      .slice(0, 5);

    // Upcoming Anniversaries
    const upcomingAnniversaries = allUsersWithDob
      .filter((u) => {
        if (!u.joiningDate) return false;
        const m = new Date(u.joiningDate).getMonth();
        return m === currentMonth || m === (currentMonth + 1) % 12;
      })
      .slice(0, 5);

    // Weekly attendance trend (past 7 days)
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      past7Days.push(d.toISOString().split('T')[0]);
    }

    const weeklyTrend = await Promise.all(
      past7Days.map(async (dStr) => {
        const dayAtt = await Attendance.find({ date: dStr });
        const pres = dayAtt.filter((a) => ['Present', 'Late'].includes(a.status)).length;
        const late = dayAtt.filter((a) => a.isLate).length;
        const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date: dStr,
          day: dayName,
          present: pres,
          late,
        };
      })
    );

    res.status(200).json({
      success: true,
      metrics: {
        totalEmployees,
        totalManagers,
        activeManagers,
        presentToday,
        absentToday,
        lateArrivals,
        onLeaveToday,
        pendingLeaves,
        missingUpdatesToday,
        activeProjects,
        overdueTasksCount,
        totalTasks,
        completedTasks,
        taskCompletionRate,
      },
      weeklyTrend,
      projectsWithProgress,
      recentAttendance,
      pendingLeaveList,
      recentUpdates,
      overdueTasks,
      upcomingHolidays,
      upcomingBirthdays,
      upcomingAnniversaries,
      recentAnnouncements,
      recentNotifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Manager Dashboard Metrics
// @route GET /api/dashboard/manager
export const getManagerDashboard = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Find teams led by this manager
    const teams = await Team.find({ leader: req.user._id });
    const teamMemberIds = [];
    teams.forEach((t) => {
      t.members.forEach((m) => teamMemberIds.push(m.toString()));
    });

    // Also include direct reporting employees
    const directReports = await User.find({ reportingManager: req.user._id }).select('_id');
    directReports.forEach((u) => {
      if (!teamMemberIds.includes(u._id.toString())) {
        teamMemberIds.push(u._id.toString());
      }
    });

    const totalTeamMembers = teamMemberIds.length;

    // Team attendance today
    const teamAttendance = await Attendance.find({
      user: { $in: teamMemberIds },
      date: todayStr,
    }).populate('user', 'fullName employeeId designation');

    const presentTeamToday = teamAttendance.filter((a) => ['Present', 'Late'].includes(a.status)).length;

    // Pending leaves for team
    const pendingLeaveApprovals = await LeaveRequest.find({
      user: { $in: teamMemberIds },
      status: 'Pending',
    })
      .populate('user', 'fullName employeeId designation')
      .populate('leaveType', 'name');

    // Missing daily updates
    const submittedUpdates = await DailyWorkUpdate.find({
      user: { $in: teamMemberIds },
      date: todayStr,
    });
    const missingUpdatesCount = Math.max(0, totalTeamMembers - submittedUpdates.length);

    // Active team projects
    const teamProjects = await Project.find({
      $or: [{ assignedTeam: { $in: teams.map((t) => t._id) } }, { members: req.user._id }],
      status: 'Active',
    });

    // Overdue tasks for team
    const overdueTasks = await Task.find({
      assignedTo: { $in: teamMemberIds },
      deadline: { $lt: now },
      status: { $ne: 'Completed' },
    })
      .populate('assignedTo', 'fullName employeeId')
      .populate('project', 'name');

    // Recent work updates submitted by team
    const teamUpdates = await DailyWorkUpdate.find({
      user: { $in: teamMemberIds },
    })
      .populate('user', 'fullName employeeId')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      metrics: {
        totalTeamMembers,
        presentTeamToday,
        pendingLeavesCount: pendingLeaveApprovals.length,
        missingUpdatesCount,
        activeProjectsCount: teamProjects.length,
        overdueTasksCount: overdueTasks.length,
      },
      teamAttendance,
      pendingLeaveApprovals,
      overdueTasks,
      teamUpdates,
      teamProjects,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Employee Dashboard Metrics
// @route GET /api/dashboard/employee
export const getEmployeeDashboard = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const userId = req.user._id;

    // Today's attendance
    const todayAttendance = await Attendance.findOne({ user: userId, date: todayStr });

    // Current month attendance summary
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthRecords = await Attendance.find({
      user: userId,
      date: { $regex: `^${currentYear}-${currentMonth}` },
    });
    const monthPresent = monthRecords.filter((r) => ['Present', 'Late'].includes(r.status)).length;
    const monthTotalHours = monthRecords.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);

    // Monthly Leave Accrual Summary & Leave balances
    const accrualSummary = await getEmployeeLeaveAccrualSummary(userId, { year: currentYear });
    const leaveBalances = await LeaveBalance.find({ user: userId, year: currentYear }).populate('leaveType');

    // Pending leave requests
    const pendingLeaves = await LeaveRequest.find({ user: userId, status: 'Pending' })
      .populate('leaveType', 'name')
      .sort({ createdAt: -1 });

    // Today's & Pending Tasks
    const assignedTasks = await Task.find({
      assignedTo: userId,
      status: { $ne: 'Completed' },
    })
      .populate('project', 'name clientName deadline')
      .sort({ deadline: 1 })
      .limit(6);

    // Today's Work Update status
    const todayWorkUpdate = await DailyWorkUpdate.findOne({ user: userId, date: todayStr });

    // Recent Announcements
    const announcements = await Announcement.find()
      .sort({ publishDate: -1 })
      .limit(4);

    // Upcoming Holidays
    const upcomingHolidays = await Holiday.find({ date: { $gte: now } })
      .sort({ date: 1 })
      .limit(4);

    res.status(200).json({
      success: true,
      todayAttendance,
      monthSummary: {
        present: monthPresent,
        totalHours: parseFloat(monthTotalHours.toFixed(1)),
        recordsCount: monthRecords.length,
      },
      leaveBalances,
      accrualSummary,
      availableLeave: accrualSummary.availableBalance,
      totalAllowance: accrualSummary.annualEntitlement,
      leaveUsed: accrualSummary.totalLeaveTakenYear,
      pendingRequests: accrualSummary.pendingRequestsCount,
      pendingLeaves,
      assignedTasks,
      hasSubmittedTodayUpdate: !!todayWorkUpdate,
      todayWorkUpdate,
      announcements,
      upcomingHolidays,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
