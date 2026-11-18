import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { User } from '../models/User.js';
import { Holiday } from '../models/Holiday.js';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Pure calculation function for Single Monthly Leave Accrual & Carry-Forward.
 * Can be run in total isolation without database dependencies for unit testing.
 *
 * Rules:
 * 1. Single Leave Policy: Each employee receives 12 leave days per year, earned at 1 day per month.
 * 2. Unused leave days carry forward automatically to the next month.
 * 3. Available balance = previous unused balance + current month's earned leave - approved leave days taken.
 * 4. Maximum newly earned leave in a calendar year is capped at 12 days.
 * 5. Pending leaves strictly do not deduct from the available balance.
 * 6. Supports half-day leave and month boundary splitting.
 */
export const calculateMonthlyAccrual = ({
  user = {},
  approvedLeaves = [],
  pendingLeaves = [],
  year = new Date().getFullYear(),
  asOfDate = new Date(),
  policy = {},
  priorYearCarryForward = 0,
  holidays = [],
}) => {
  const targetYear = Number(year) || asOfDate.getFullYear();
  const accrualRate = policy.monthlyAccrualRate !== undefined ? Number(policy.monthlyAccrualRate) : 1;
  const annualEntitlement = policy.annualEntitlement !== undefined ? Number(policy.annualEntitlement) : 12;
  const carryForwardEnabled = policy.carryForwardEnabled !== false;

  // Build holiday date lookup set (local and UTC YYYY-MM-DD)
  const holidaySet = new Set();
  (holidays || []).forEach((h) => {
    if (!h.date) return;
    const hd = new Date(h.date);
    holidaySet.add(`${hd.getFullYear()}-${String(hd.getMonth() + 1).padStart(2, '0')}-${String(hd.getDate()).padStart(2, '0')}`);
    holidaySet.add(`${hd.getUTCFullYear()}-${String(hd.getUTCMonth() + 1).padStart(2, '0')}-${String(hd.getUTCDate()).padStart(2, '0')}`);
  });

  // Determine current active month relative to targetYear
  let asOfMonth;
  if (asOfDate.getFullYear() === targetYear) {
    asOfMonth = asOfDate.getMonth() + 1; // 1 to 12
  } else if (asOfDate.getFullYear() > targetYear) {
    asOfMonth = 12; // Year fully elapsed
  } else {
    asOfMonth = 0; // Year not yet started
  }

  // Determine employee start accrual month in targetYear
  let joiningMonth = 1;
  if (user && user.joiningDate) {
    const jDate = new Date(user.joiningDate);
    if (!isNaN(jDate.getTime())) {
      if (jDate.getFullYear() === targetYear) {
        joiningMonth = jDate.getMonth() + 1;
      } else if (jDate.getFullYear() > targetYear) {
        joiningMonth = 13; // Not yet joined in targetYear
      } else {
        joiningMonth = 1; // Joined prior to targetYear
      }
    }
  }

  // Map approved leaves to days taken per month (deducting ONLY paid leave days; LOP days are tracked separately and do not deduct from balance)
  const takenByMonth = {};
  const lopByMonth = {};
  for (let m = 1; m <= 12; m++) {
    takenByMonth[m] = 0;
    lopByMonth[m] = 0;
  }

  approvedLeaves.forEach((leave) => {
    if (!leave.startDate || !leave.endDate) return;

    // Determine paid days vs LOP days for this leave record
    const hasPaidField = leave.paidLeaveDays !== undefined && leave.paidLeaveDays !== null;
    const paidAllowance = hasPaidField ? Number(leave.paidLeaveDays) : (Number(leave.numberOfDays) || 0);

    if (leave.isHalfDay) {
      const s = new Date(leave.startDate);
      const dayOfWeek = s.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const sKey = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
      const isHoliday = holidaySet.has(sKey);

      // Exclude weekend and company holiday
      if (!isWeekend && !isHoliday) {
        if (s.getFullYear() === targetYear) {
          const m = s.getMonth() + 1;
          if (m >= 1 && m <= 12) {
            if (paidAllowance >= 0.5) {
              takenByMonth[m] = (takenByMonth[m] || 0) + 0.5;
            } else {
              lopByMonth[m] = (lopByMonth[m] || 0) + 0.5;
            }
          }
        }
      }
    } else {
      let paidDeducted = 0;
      const cur = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      while (cur <= end) {
        const dayOfWeek = cur.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const curKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(curKey);

        // Strictly exclude weekends and company holidays from leave deduction
        if (!isWeekend && !isHoliday) {
          if (cur.getFullYear() === targetYear) {
            const m = cur.getMonth() + 1;
            if (m >= 1 && m <= 12) {
              if (paidDeducted < paidAllowance) {
                takenByMonth[m] = (takenByMonth[m] || 0) + 1;
                paidDeducted += 1;
              } else {
                lopByMonth[m] = (lopByMonth[m] || 0) + 1;
              }
            }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  });

  // Month-by-month accrual & carry-forward calculation
  let runningCarryForward = carryForwardEnabled ? Math.max(0, Number(priorYearCarryForward) || 0) : 0;
  const monthBreakdown = [];

  for (let m = 1; m <= 12; m++) {
    // Has employee started earning?
    const isEarningMonth = m >= joiningMonth && m <= asOfMonth && m <= 12;

    // Check that cumulative newly earned days do not exceed annual entitlement cap (max 12 days)
    const priorEarned = monthBreakdown.reduce((sum, item) => sum + item.earned, 0);
    const earnedThisMonth = isEarningMonth
      ? Math.max(0, Math.min(accrualRate, annualEntitlement - priorEarned))
      : 0;

    const takenThisMonth = Math.round((takenByMonth[m] || 0) * 100) / 100;
    const lopThisMonth = Math.round((lopByMonth[m] || 0) * 100) / 100;
    const availableBeforeUsage = Math.round((runningCarryForward + earnedThisMonth) * 100) / 100;
    const closingBalance = Math.max(0, Math.round((availableBeforeUsage - takenThisMonth) * 100) / 100);

    monthBreakdown.push({
      month: m,
      monthName: MONTH_NAMES[m - 1],
      carriedIn: runningCarryForward,
      earned: earnedThisMonth,
      availableBeforeUsage,
      taken: takenThisMonth,
      lop: lopThisMonth,
      closingBalance,
      isCurrent: m === asOfMonth,
      isPast: m < asOfMonth,
      isFuture: m > asOfMonth,
    });

    if (carryForwardEnabled) {
      runningCarryForward = closingBalance;
    } else {
      runningCarryForward = 0;
    }
  }

  // Metrics for asOfMonth
  let carriedForward = 0;
  let currentMonthEarned = 0;
  let leaveTakenThisMonth = 0;
  let lopTakenThisMonth = 0;
  let availableBalance = 0;

  if (asOfMonth >= 1 && asOfMonth <= 12) {
    const cur = monthBreakdown[asOfMonth - 1];
    carriedForward = cur.carriedIn;
    currentMonthEarned = cur.earned;
    leaveTakenThisMonth = cur.taken;
    lopTakenThisMonth = cur.lop;
    availableBalance = cur.closingBalance;
  } else if (asOfMonth > 12) {
    const dec = monthBreakdown[11];
    carriedForward = dec.closingBalance;
    currentMonthEarned = 0;
    leaveTakenThisMonth = 0;
    lopTakenThisMonth = 0;
    availableBalance = dec.closingBalance;
  }

  // Total leave taken across all months in targetYear
  const totalLeaveTakenYear = Math.round(
    Object.values(takenByMonth).reduce((sum, v) => sum + v, 0) * 100
  ) / 100;

  // Total LOP days across all approved leaves in targetYear
  const totalLopDaysYear = Math.round(
    (Object.values(lopByMonth).reduce((sum, v) => sum + v, 0) ||
      approvedLeaves.reduce((sum, l) => sum + (Number(l.lopDays) || 0), 0)) * 100
  ) / 100;

  // Pending leaves (must NOT deduct from balance)
  const pendingRequestsCount = pendingLeaves.length;
  const pendingDays = Math.round(
    pendingLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0) * 100
  ) / 100;

  const totalEarnedYearToDate = monthBreakdown
    .filter((m) => m.month <= asOfMonth)
    .reduce((sum, m) => sum + m.earned, 0);

  return {
    year: targetYear,
    currentMonth: asOfMonth,
    currentMonthName: asOfMonth >= 1 && asOfMonth <= 12 ? MONTH_NAMES[asOfMonth - 1] : 'N/A',
    annualEntitlement,
    totalAnnualAllowance: annualEntitlement,
    monthlyAccrualRate: accrualRate,
    carryForwardEnabled,
    carriedForward,
    currentMonthEarned,
    leaveTakenThisMonth,
    lopTakenThisMonth,
    totalLeaveTakenYear,
    totalPaidLeaveTakenYear: totalLeaveTakenYear,
    totalLopDaysYear,
    pendingRequestsCount,
    pendingDays,
    availableBalance,
    totalEarnedYearToDate,
    months: monthBreakdown,
  };
};

/**
 * Database-backed function to fetch employee leave accrual summary and sync with LeaveBalance.
 */
export const getEmployeeLeaveAccrualSummary = async (userId, options = {}) => {
  const targetYear = Number(options.year) || new Date().getFullYear();
  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();

  // 1. Fetch user
  const user = await User.findById(userId).select('fullName employeeId email designation department joiningDate');
  if (!user) {
    throw new Error('User not found');
  }

  // 2. Fetch System Setting for Leave Policy
  const setting = await SystemSetting.findOne();
  const policy = setting?.leavePolicy || {
    monthlyAccrualRate: 1,
    annualEntitlement: 12,
    carryForwardEnabled: true,
    accrualDayOfMonth: 1,
  };

  // 3. Fetch approved leaves for targetYear
  const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`);

  const approvedLeaves = await LeaveRequest.find({
    user: userId,
    status: 'Approved',
    startDate: { $lte: endOfYear },
    endDate: { $gte: startOfYear },
  });

  // 4. Fetch pending leaves
  const pendingLeaves = await LeaveRequest.find({
    user: userId,
    status: 'Pending',
    startDate: { $lte: endOfYear },
    endDate: { $gte: startOfYear },
  });

  // Check prior year carry-forward if carry-forward is enabled
  let priorYearCarry = 0;
  if (options.priorYearCarryForward !== undefined) {
    priorYearCarry = Number(options.priorYearCarryForward);
  } else if (policy.carryForwardEnabled !== false) {
    const priorBal = await LeaveBalance.findOne({ user: userId, year: targetYear - 1, leaveType: null }) ||
                     await LeaveBalance.findOne({ user: userId, year: targetYear - 1 });
    if (priorBal && priorBal.availableBalance > 0) {
      priorYearCarry = priorBal.availableBalance;
    }
  }

  // 5. Fetch holidays for targetYear
  let holidays = [];
  try {
    holidays = await Holiday.find({
      date: {
        $gte: new Date(`${targetYear}-01-01T00:00:00.000Z`),
        $lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
      },
    });
  } catch {
    holidays = [];
  }

  // 6. Run calculation excluding weekends and company holidays
  const summary = calculateMonthlyAccrual({
    user,
    approvedLeaves,
    pendingLeaves,
    year: targetYear,
    asOfDate,
    policy,
    priorYearCarryForward: priorYearCarry,
    holidays,
  });

  // 6. Synchronize LeaveBalance records in MongoDB
  try {
    // Find or create single unified balance record (leaveType: null)
    let unifiedBal = await LeaveBalance.findOne({ user: userId, year: targetYear, leaveType: null });
    if (!unifiedBal) {
      unifiedBal = await LeaveBalance.create({
        user: userId,
        leaveType: null,
        year: targetYear,
        allocated: summary.annualEntitlement,
        used: summary.totalLeaveTakenYear,
        availableBalance: summary.availableBalance,
        carriedForward: summary.carriedForward,
        currentMonthEarned: summary.currentMonthEarned,
        leaveTakenInMonth: summary.leaveTakenThisMonth,
        lopDays: summary.totalLopDaysYear,
        pendingDays: summary.pendingDays,
        monthlyAccrued: summary.totalEarnedYearToDate,
      });
    } else {
      unifiedBal.allocated = summary.annualEntitlement;
      unifiedBal.used = summary.totalLeaveTakenYear;
      unifiedBal.availableBalance = summary.availableBalance;
      unifiedBal.carriedForward = summary.carriedForward;
      unifiedBal.currentMonthEarned = summary.currentMonthEarned;
      unifiedBal.leaveTakenInMonth = summary.leaveTakenThisMonth;
      unifiedBal.lopDays = summary.totalLopDaysYear;
      unifiedBal.pendingDays = summary.pendingDays;
      unifiedBal.monthlyAccrued = summary.totalEarnedYearToDate;
      await unifiedBal.save();
    }

    // Also update any legacy balance documents for this user & year
    const legacyBalances = await LeaveBalance.find({ user: userId, year: targetYear, leaveType: { $ne: null } });
    for (const bal of legacyBalances) {
      bal.monthlyAccrued = summary.totalEarnedYearToDate;
      bal.carriedForward = summary.carriedForward;
      bal.currentMonthEarned = summary.currentMonthEarned;
      bal.leaveTakenInMonth = summary.leaveTakenThisMonth;
      bal.lopDays = summary.totalLopDaysYear;
      bal.pendingDays = summary.pendingDays;
      bal.availableBalance = summary.availableBalance;
      bal.used = summary.totalLeaveTakenYear;
      await bal.save();
    }
  } catch (syncErr) {
    console.error('Error synchronizing LeaveBalance:', syncErr.message);
  }

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      employeeId: user.employeeId,
      department: user.department,
      designation: user.designation,
      joiningDate: user.joiningDate,
    },
    ...summary,
    availableLeave: summary.availableBalance,
    totalAllowance: summary.annualEntitlement,
    leaveUsed: summary.totalLeaveTakenYear,
    lopDays: summary.totalLopDaysYear,
    pendingRequests: summary.pendingRequestsCount,
  };
};
