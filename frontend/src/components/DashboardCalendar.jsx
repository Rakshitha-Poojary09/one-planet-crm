import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiUser,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiSearch,
  FiInfo,
  FiBriefcase,
} from 'react-icons/fi';

const MONTH_NAMES = [
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

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Standardized CRM Attendance & Calendar Status Palette
export const CALENDAR_COLORS = {
  present: {
    bg: '#DCFCE7', // Light green background
    color: '#15803D', // Dark green text
    border: '#86EFAC',
    dot: '#15803D',
    badgeText: 'Present',
  },
  late: {
    bg: '#FFEDD5', // Light orange background
    color: '#C2410C', // Dark orange text
    border: '#FDBA74',
    dot: '#EA580C',
    badgeText: 'Late Arrival',
  },
  absent: {
    bg: '#FEE2E2', // Red background
    color: '#DC2626', // Red text
    border: '#FCA5A5',
    dot: '#DC2626',
    badgeText: 'Absent',
  },
  halfDay: {
    bg: 'linear-gradient(135deg, #15803D 0%, #15803D calc(50% - 0.5px), #FFFFFF calc(50% - 0.5px), #FFFFFF calc(50% + 0.5px), #B91C1C calc(50% + 0.5px), #B91C1C 100%)', // Split: Darker green (#15803D) / subtle white line / darker red (#B91C1C)
    bgVertical: 'linear-gradient(to right, #15803D 0%, #15803D calc(50% - 0.5px), #FFFFFF calc(50% - 0.5px), #FFFFFF calc(50% + 0.5px), #B91C1C calc(50% + 0.5px), #B91C1C 100%)',
    color: '#FFFFFF', // High-contrast white text for readability against dark green and dark red
    border: '#CBD5E1',
    dots: [],
    badgeText: 'Half Day',
  },
  companyHoliday: {
    bg: '#DBEAFE', // Light blue background
    color: '#1D4ED8', // Blue text
    border: '#93C5FD', // Subtle blue border
    dot: '#1D4ED8',
    badgeText: 'Public Holiday',
  },
  weekend: {
    bg: '#F1F5F9', // Light grey background
    color: '#64748B', // Muted grey text
    border: '#E2E8F0',
    dot: null,
    badgeText: 'Weekly Off',
  },
  onLeave: {
    bg: '#E0F2FE', // Light blue background
    color: '#0369A1', // Dark blue text
    border: '#BAE6FD',
    dot: '#0284C7',
    badgeText: 'On Leave',
  },
  beforeJoining: {
    bg: '#F8FAFC',
    color: '#94A3B8',
    border: '#E2E8F0',
    dot: null,
    badgeText: 'Before Joining',
  },
  neutral: {
    bg: '#FFFFFF',
    color: '#1E293B',
    border: '#E2E8F0',
    dot: null,
    badgeText: 'Working Day',
  },
};

// Helper: Extract employee joining date in 'YYYY-MM-DD' format
export const getEmployeeJoiningDateStr = (emp) => {
  if (!emp) return '1970-01-01';
  const raw = emp.joiningDate || emp.dateOfJoining || emp.createdAt;
  if (!raw) return '1970-01-01';
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '1970-01-01';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const DashboardCalendar = ({
  title = 'Company Calendar & Holidays',
  showManageLink = true,
  userId = null,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';
  const isEmployee = user?.role === 'Employee';

  // Determine if this calendar instance is in "Team View" (Manager or Admin viewing multiple employees)
  // or "Single Employee View" (Employee viewing self, or Admin/Manager viewing single employee profile)
  const isTeamView = !userId && (isManager || isAdmin);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(today);

  const [holidays, setHolidays] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inspector search and status filter state
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [inspectorFilter, setInspectorFilter] = useState('All');

  // Helper to format date key matching holiday & attendance records (YYYY-MM-DD)
  const getDateKey = (y, m, d) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const todayStr = getDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Helper to check if a specific date falls within a leave request range
  const isDateInLeave = (y, m, d, leave) => {
    if (!leave || !leave.startDate || !leave.endDate) return false;
    const key = getDateKey(y, m, d);

    // Format local and UTC dates for comparison
    const s = new Date(leave.startDate);
    const sKey = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    const sUtc = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;

    const e = new Date(leave.endDate);
    const eKey = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
    const eUtc = `${e.getUTCFullYear()}-${String(e.getUTCMonth() + 1).padStart(2, '0')}-${String(e.getUTCDate()).padStart(2, '0')}`;

    const inLocal = key >= sKey && key <= eKey;
    const inUtc = key >= sUtc && key <= eUtc;
    return inLocal || inUtc;
  };

  // Fetch calendar dataset from backend API
  const fetchCalendarDataset = async (year, month) => {
    try {
      setLoading(true);
      setError(null);

      // Attempt centralized role-scoped endpoint first
      try {
        const res = await api.get('/calendar/data', {
          params: {
            year,
            month: month + 1,
            user: userId || undefined,
          },
        });

        if (res.data?.success) {
          setHolidays(res.data.holidays || []);
          setAttendanceRecords(res.data.attendance || []);
          setLeaves(res.data.leaves || []);
          setEmployees(res.data.employees || []);
          return;
        }
      } catch (centralErr) {
        // Fallback to individual endpoints if /calendar/data is unavailable
        console.warn('Fallback to separate endpoints for calendar data');
      }

      // Fallback: Fetch Holidays
      const hRes = await api.get('/calendar/holidays', { params: { year } });
      if (hRes.data?.success) {
        setHolidays(hRes.data.holidays || []);
      }

      // Fallback: Fetch Approved Leaves
      const lRes = await api.get('/leaves', { params: { status: 'Approved' } });
      if (lRes.data?.success) {
        setLeaves(lRes.data.leaves || []);
      }

      // Fallback: Fetch Attendance
      let attUrl = '/attendance/my-history';
      const attParams = { year, month: month + 1 };
      if (userId) {
        attUrl = '/attendance/all';
        attParams.user = userId;
      } else if (isManager || isAdmin) {
        attUrl = '/attendance/all';
      }

      const attRes = await api.get(attUrl, { params: attParams });
      if (attRes.data?.success) {
        setAttendanceRecords(attRes.data.records || []);
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Unable to load calendar records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarDataset(currentYear, currentMonth);
  }, [currentYear, currentMonth, userId]);

  // Index Holidays by 'YYYY-MM-DD'
  const holidayMap = useMemo(() => {
    const map = {};
    holidays.forEach((h) => {
      if (!h.date) return;
      const hd = new Date(h.date);
      const keyLocal = `${hd.getFullYear()}-${String(hd.getMonth() + 1).padStart(2, '0')}-${String(hd.getDate()).padStart(2, '0')}`;
      const keyUtc = `${hd.getUTCFullYear()}-${String(hd.getUTCMonth() + 1).padStart(2, '0')}-${String(hd.getUTCDate()).padStart(2, '0')}`;
      map[keyLocal] = h;
      map[keyUtc] = h;
    });
    return map;
  }, [holidays]);

  // Index Attendance Records by 'YYYY-MM-DD'
  // In single-employee view: map[dateKey] = single record
  // In team view: map[dateKey] = array of records
  const attendanceMap = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((r) => {
      if (!r.date) return;
      if (!map[r.date]) {
        map[r.date] = [];
      }
      map[r.date].push(r);
    });
    return map;
  }, [attendanceRecords]);

  // Index Approved Leaves for current month dates
  const approvedLeavesMap = useMemo(() => {
    const map = {};
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let d = 1; d <= daysCount; d++) {
      const key = getDateKey(currentYear, currentMonth, d);
      const matching = leaves.filter(
        (l) => l.status === 'Approved' && isDateInLeave(currentYear, currentMonth, d, l)
      );
      if (matching.length > 0) {
        map[key] = matching;
      }
    }
    return map;
  }, [leaves, currentYear, currentMonth]);

  // Selected date metadata and computed employee statuses
  const selectedDateKey = getDateKey(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  );

  const selectedDayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const selectedDayName = selectedDayNames[selectedDate.getDay()];

  const formattedSelectedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isSelectedDateToday =
    selectedDate.getDate() === today.getDate() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  const isSelectedDateFuture = selectedDateKey > todayStr;
  const selectedDateHoliday = holidayMap[selectedDateKey] || null;
  const isSelectedDateWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

  // Compute detailed status for each active employee for the selected date
  const selectedDateEmployeeStatuses = useMemo(() => {
    const holiday = holidayMap[selectedDateKey] || null;
    const dayLeaves = approvedLeavesMap[selectedDateKey] || [];
    const dayRecords = attendanceMap[selectedDateKey] || [];

    const targetEmployees = isTeamView
      ? (employees.length > 0 ? employees : (user ? [user] : []))
      : [
          (userId && employees.find((e) => e._id === userId)) ||
            (employees.length === 1 ? employees[0] : null) ||
            user,
        ].filter(Boolean);

    return targetEmployees.map((emp) => {
      const empJoiningStr = getEmployeeJoiningDateStr(emp);
      const isBeforeJoining = selectedDateKey < empJoiningStr;

      const empWeeklyOff =
        emp?.weeklyOff && emp.weeklyOff.length > 0 ? emp.weeklyOff : ['Saturday', 'Sunday'];
      const isEmpWeekend = empWeeklyOff.includes(selectedDayName);

      const empLeave = dayLeaves.find((l) => {
        const uId = l.user?._id || l.user;
        return uId && uId.toString() === emp._id?.toString();
      });

      const empRecord = dayRecords.find((r) => {
        const uId = r.user?._id || r.user;
        return uId && uId.toString() === emp._id?.toString();
      });

      // Rule: Never mark dates before joining as Absent
      if (isBeforeJoining) {
        return {
          emp,
          status: 'Before Joining',
          category: 'neutral',
          badgeText: `Joined ${empJoiningStr}`,
          badgeClass: 'bg-light text-muted border',
          isAbsent: false,
          isAutoAbsent: false,
          joiningDateStr: empJoiningStr,
          notes: `Employee was not yet employed at company on this date (Joined: ${empJoiningStr}).`,
          checkIn: null,
          checkOut: null,
          workingHours: 0,
        };
      }

      // Rule: Do not mark company public holidays as Absent
      if (holiday) {
        return {
          emp,
          status: 'Public Holiday',
          category: 'holiday',
          badgeText: holiday.name || 'Public Holiday',
          badgeClass: 'bg-primary bg-opacity-10 text-primary border border-primary',
          isAbsent: false,
          isAutoAbsent: false,
          joiningDateStr: empJoiningStr,
          notes: `Official public holiday: ${holiday.name}`,
          checkIn: empRecord?.checkIn || null,
          checkOut: empRecord?.checkOut || null,
          workingHours: empRecord?.workingHours || 0,
        };
      }

      // Rule: Do not mark weekends as Absent
      if (isEmpWeekend) {
        return {
          emp,
          status: 'Weekly Off',
          category: 'weekend',
          badgeText: 'Weekly Off',
          badgeClass: 'bg-light text-secondary border',
          isAbsent: false,
          isAutoAbsent: false,
          joiningDateStr: empJoiningStr,
          notes: `Scheduled weekly off (${selectedDayName}).`,
          checkIn: empRecord?.checkIn || null,
          checkOut: empRecord?.checkOut || null,
          workingHours: empRecord?.workingHours || 0,
        };
      }

      // Rule: Do not mark approved leave as Absent
      if (empLeave) {
        if (empLeave.isHalfDay) {
          return {
            emp,
            status: 'Half Day',
            category: 'halfDay',
            badgeText: `Half Day (${empLeave.leaveType?.name || 'Leave'})`,
            badgeClass: 'bg-warning bg-opacity-10 text-warning-emphasis border border-warning',
            isAbsent: false,
            isAutoAbsent: false,
            joiningDateStr: empJoiningStr,
            notes: `Approved half-day leave: ${empLeave.leaveType?.name || 'Leave'}.`,
            checkIn: empRecord?.checkIn || null,
            checkOut: empRecord?.checkOut || null,
            workingHours: empRecord?.workingHours || 4,
          };
        }
        return {
          emp,
          status: 'On Leave',
          category: 'onLeave',
          badgeText: `On Leave (${empLeave.leaveType?.name || 'Approved'})`,
          badgeClass: 'bg-info bg-opacity-10 text-info-emphasis border border-info',
          isAbsent: false,
          isAutoAbsent: false,
          joiningDateStr: empJoiningStr,
          notes: `Approved full-day leave: ${empLeave.leaveType?.name || 'Leave'}.`,
          checkIn: null,
          checkOut: null,
          workingHours: 0,
        };
      }

      // Actual Login Records
      if (empRecord) {
        if (empRecord.status === 'Half Day') {
          return {
            emp,
            status: 'Half Day',
            category: 'halfDay',
            badgeText: 'Half Day',
            badgeClass: 'bg-warning bg-opacity-10 text-warning-emphasis border border-warning',
            isAbsent: false,
            isAutoAbsent: false,
            joiningDateStr: empJoiningStr,
            notes: 'Recorded half-day attendance session.',
            checkIn: empRecord.checkIn,
            checkOut: empRecord.checkOut,
            workingHours: empRecord.workingHours || 0,
          };
        }
        if (empRecord.isLate || empRecord.status === 'Late') {
          return {
            emp,
            status: 'Late Arrival',
            category: 'late',
            badgeText: `Late (+${empRecord.lateMinutes || 0}m)`,
            badgeClass: 'bg-warning bg-opacity-10 text-warning-emphasis border border-warning',
            isAbsent: false,
            isAutoAbsent: false,
            joiningDateStr: empJoiningStr,
            notes: `Late arrival recorded (+${empRecord.lateMinutes || 0}m).`,
            checkIn: empRecord.checkIn,
            checkOut: empRecord.checkOut,
            workingHours: empRecord.workingHours || 0,
            lateMinutes: empRecord.lateMinutes || 0,
          };
        }
        if (
          ['Present', 'Early Departure', 'Missed Check-out'].includes(empRecord.status) ||
          empRecord.checkIn
        ) {
          return {
            emp,
            status: 'Present',
            category: 'present',
            badgeText: 'Present',
            badgeClass: 'bg-success bg-opacity-10 text-success border border-success',
            isAbsent: false,
            isAutoAbsent: false,
            joiningDateStr: empJoiningStr,
            notes: 'Verified attendance check-in session.',
            checkIn: empRecord.checkIn,
            checkOut: empRecord.checkOut,
            workingHours: empRecord.workingHours || 0,
          };
        }
        if (empRecord.status === 'On Leave') {
          return {
            emp,
            status: 'On Leave',
            category: 'onLeave',
            badgeText: 'On Leave',
            badgeClass: 'bg-info bg-opacity-10 text-info-emphasis border border-info',
            isAbsent: false,
            isAutoAbsent: false,
            joiningDateStr: empJoiningStr,
            notes: 'Marked on leave in attendance records.',
            checkIn: null,
            checkOut: null,
            workingHours: 0,
          };
        }
        if (empRecord.status === 'Absent') {
          return {
            emp,
            status: 'Absent',
            category: 'absent',
            badgeText: 'Absent',
            badgeClass: 'bg-danger bg-opacity-10 text-danger border border-danger',
            isAbsent: true,
            isAutoAbsent: false,
            joiningDateStr: empJoiningStr,
            notes: 'Recorded absence for scheduled shift.',
            checkIn: null,
            checkOut: null,
            workingHours: 0,
          };
        }
      }

      // Rule: Do not mark future dates as Absent
      if (isSelectedDateFuture) {
        return {
          emp,
          status: 'Upcoming',
          category: 'neutral',
          badgeText: 'Scheduled',
          badgeClass: 'bg-light text-muted border',
          isAbsent: false,
          isAutoAbsent: false,
          joiningDateStr: empJoiningStr,
          notes: 'Scheduled working day in future.',
          checkIn: null,
          checkOut: null,
          workingHours: 0,
        };
      }

      // Rule: Automatically mark an employee Absent (Red) if they do not log in on a scheduled working day
      return {
        emp,
        status: 'Absent',
        category: 'absent',
        badgeText: 'Absent (No Login)',
        badgeClass: 'bg-danger bg-opacity-10 text-danger border border-danger fw-bold',
        isAbsent: true,
        isAutoAbsent: true,
        joiningDateStr: empJoiningStr,
        notes: 'Automatically marked Absent: No login record on scheduled working day.',
        checkIn: null,
        checkOut: null,
        workingHours: 0,
      };
    });
  }, [
    selectedDateKey,
    selectedDayName,
    holidayMap,
    approvedLeavesMap,
    attendanceMap,
    employees,
    isTeamView,
    userId,
    user,
    isSelectedDateFuture,
    todayStr,
  ]);

  const filteredEmployeeStatuses = useMemo(() => {
    return selectedDateEmployeeStatuses.filter((item) => {
      // 1. Status Filter
      if (inspectorFilter !== 'All') {
        if (inspectorFilter === 'Present' && item.status !== 'Present') return false;
        if (inspectorFilter === 'Late Arrival' && item.status !== 'Late Arrival') return false;
        if (inspectorFilter === 'Half Day' && item.status !== 'Half Day') return false;
        if (inspectorFilter === 'Absent' && item.status !== 'Absent') return false;
        if (inspectorFilter === 'On Leave' && item.status !== 'On Leave') return false;
        if (inspectorFilter === 'Weekly Off' && item.status !== 'Weekly Off') return false;
        if (inspectorFilter === 'Public Holiday' && item.status !== 'Public Holiday') return false;
        if (inspectorFilter === 'Before Joining' && item.status !== 'Before Joining') return false;
      }

      // 2. Search query filter
      if (inspectorSearch.trim()) {
        const q = inspectorSearch.toLowerCase();
        const nameMatch = item.emp?.fullName?.toLowerCase().includes(q);
        const idMatch = item.emp?.employeeId?.toLowerCase().includes(q);
        const deptMatch = (item.emp?.department?.name || item.emp?.department || '')
          .toLowerCase()
          .includes(q);
        if (!nameMatch && !idMatch && !deptMatch) return false;
      }

      return true;
    });
  }, [selectedDateEmployeeStatuses, inspectorFilter, inspectorSearch]);

  const selectedDateSummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let halfDay = 0;
    let absent = 0;
    let onLeave = 0;
    let beforeJoining = 0;

    selectedDateEmployeeStatuses.forEach((item) => {
      if (item.status === 'Present') present++;
      else if (item.status === 'Late Arrival') late++;
      else if (item.status === 'Half Day') halfDay++;
      else if (item.status === 'Absent') absent++;
      else if (item.status === 'On Leave') onLeave++;
      else if (item.status === 'Before Joining') beforeJoining++;
    });

    return { present, late, halfDay, absent, onLeave, beforeJoining };
  }, [selectedDateEmployeeStatuses]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(now);
  };

  // Calendar grid calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Helper to determine status classification and styling for each calendar day
  const getDayInfo = (y, m, d) => {
    const key = getDateKey(y, m, d);
    const dateObj = new Date(y, m, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = holidayMap[key];
    const dayLeaves = approvedLeavesMap[key] || [];
    const dayRecords = attendanceMap[key] || [];

    const isToday =
      d === today.getDate() &&
      m === today.getMonth() &&
      y === today.getFullYear();

    const isSelected =
      d === selectedDate.getDate() &&
      m === selectedDate.getMonth() &&
      y === selectedDate.getFullYear();

    const isFuture = key > todayStr;

    // 1. Company Holiday Priority: Light blue background (#DBEAFE), blue text (#1D4ED8), subtle blue border (#93C5FD)
    // Rule: Do not mark weekends or company holidays as employee absences.
    if (holiday) {
      return {
        type: 'holiday',
        holiday,
        dayLeaves,
        dayRecords,
        isWeekend,
        isToday,
        isSelected,
        badgeText: 'Public Holiday',
        bg: CALENDAR_COLORS.companyHoliday.bg,
        color: CALENDAR_COLORS.companyHoliday.color,
        border: `1px solid ${CALENDAR_COLORS.companyHoliday.border}`,
        dots: [{ color: CALENDAR_COLORS.companyHoliday.dot, label: 'Holiday' }],
      };
    }

    // 2. Saturday and Sunday Weekly Off Priority: Light grey background (#F1F5F9), muted grey text (#64748B)
    // Rule: Do not mark weekends or company holidays as employee absences.
    if (isWeekend) {
      return {
        type: 'weekend',
        holiday: null,
        dayLeaves,
        dayRecords,
        isWeekend: true,
        isToday,
        isSelected,
        badgeText: 'Weekly Off',
        bg: CALENDAR_COLORS.weekend.bg,
        color: CALENDAR_COLORS.weekend.color,
        border: `1px solid ${CALENDAR_COLORS.weekend.border}`,
        dots: [],
      };
    }

    // --- SCHEDULED WORKING DAYS (Monday - Friday) ---

    // A) SINGLE EMPLOYEE VIEW (Personal Employee Calendar)
    if (!isTeamView) {
      const currentEmp =
        (userId && employees.find((e) => e._id === userId)) ||
        (employees.length === 1 ? employees[0] : null) ||
        user;
      const empJoiningStr = getEmployeeJoiningDateStr(currentEmp);

      // Rule: Start attendance tracking from actual Date of Joining. Never mark dates before joining as Absent.
      if (empJoiningStr && key < empJoiningStr) {
        return {
          type: 'before-joining',
          holiday: null,
          dayLeaves: [],
          attendanceRecord: null,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: `Joined ${empJoiningStr}`,
          bg: CALENDAR_COLORS.beforeJoining.bg,
          color: CALENDAR_COLORS.beforeJoining.color,
          border: `1px solid ${CALENDAR_COLORS.beforeJoining.border}`,
          dots: [],
        };
      }

      const record = dayRecords[0] || null;
      const leave = dayLeaves[0] || null;

      // 3. Half Day: Split diagonally green (Present) & red (Absent)
      const isHalfDay =
        record?.status === 'Half Day' ||
        (leave && leave.status === 'Approved' && leave.isHalfDay);

      if (isHalfDay) {
        return {
          type: 'halfDay',
          holiday: null,
          dayLeaves: leave ? [leave] : [],
          attendanceRecord: record,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: 'Half Day',
          bg: CALENDAR_COLORS.halfDay.bg,
          color: CALENDAR_COLORS.halfDay.color,
          border: `1px solid ${CALENDAR_COLORS.halfDay.border}`,
          dots: CALENDAR_COLORS.halfDay.dots,
        };
      }

      // 4. Approved Leave (Full Day): Do NOT mark approved leave as Absent!
      if (leave && leave.status === 'Approved' && !leave.isHalfDay) {
        return {
          type: 'on-leave',
          holiday: null,
          dayLeaves: [leave],
          attendanceRecord: record,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: `On Leave (${leave.leaveType?.name || 'Approved'})`,
          bg: CALENDAR_COLORS.onLeave.bg,
          color: CALENDAR_COLORS.onLeave.color,
          border: `1px solid ${CALENDAR_COLORS.onLeave.border}`,
          dots: [{ color: CALENDAR_COLORS.onLeave.dot, label: 'On Leave' }],
        };
      }

      // 5. Late Arrival: Orange (#FFEDD5 bg, #C2410C text)
      if (record && (record.isLate || record.status === 'Late')) {
        return {
          type: 'late',
          holiday: null,
          dayLeaves: leave ? [leave] : [],
          attendanceRecord: record,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: 'Late Arrival',
          bg: CALENDAR_COLORS.late.bg,
          color: CALENDAR_COLORS.late.color,
          border: `1px solid ${CALENDAR_COLORS.late.border}`,
          dots: [{ color: CALENDAR_COLORS.late.dot, label: 'Late Arrival' }],
        };
      }

      // 6. Present: Green (#DCFCE7 bg, #15803D text)
      if (
        record &&
        (['Present', 'Early Departure', 'Missed Check-out'].includes(record.status) || record.checkIn)
      ) {
        return {
          type: 'present',
          holiday: null,
          dayLeaves: leave ? [leave] : [],
          attendanceRecord: record,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: 'Present',
          bg: CALENDAR_COLORS.present.bg,
          color: CALENDAR_COLORS.present.color,
          border: `1px solid ${CALENDAR_COLORS.present.border}`,
          dots: [{ color: CALENDAR_COLORS.present.dot, label: 'Present' }],
        };
      }

      // 7. Explicit On Leave record in attendance: Do NOT mark as Absent!
      if (record && record.status === 'On Leave') {
        return {
          type: 'on-leave',
          holiday: null,
          dayLeaves: leave ? [leave] : [],
          attendanceRecord: record,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: 'On Leave',
          bg: CALENDAR_COLORS.onLeave.bg,
          color: CALENDAR_COLORS.onLeave.color,
          border: `1px solid ${CALENDAR_COLORS.onLeave.border}`,
          dots: [{ color: CALENDAR_COLORS.onLeave.dot, label: 'On Leave' }],
        };
      }

      // 8. Explicit Absent record: Red (#FEE2E2 bg, #DC2626 text)
      if (record && record.status === 'Absent') {
        return {
          type: 'absent',
          holiday: null,
          dayLeaves: leave ? [leave] : [],
          attendanceRecord: record,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: 'Absent',
          bg: CALENDAR_COLORS.absent.bg,
          color: CALENDAR_COLORS.absent.color,
          border: `1px solid ${CALENDAR_COLORS.absent.border}`,
          dots: [{ color: CALENDAR_COLORS.absent.dot, label: 'Absent' }],
        };
      }

      // 9. Working day without attendance record:
      // Rule: Do not mark future dates as Absent
      if (isFuture) {
        return {
          type: 'upcoming',
          holiday: null,
          dayLeaves: [],
          attendanceRecord: null,
          isWeekend: false,
          isToday,
          isSelected,
          badgeText: 'Working Day',
          bg: CALENDAR_COLORS.neutral.bg,
          color: CALENDAR_COLORS.neutral.color,
          border: `1px solid ${CALENDAR_COLORS.neutral.border}`,
          dots: [],
        };
      }

      // Rule: Automatically mark an employee Absent (Red) if they do not log in on a scheduled working day
      return {
        type: 'absent',
        holiday: null,
        dayLeaves: [],
        attendanceRecord: null,
        isWeekend: false,
        isToday,
        isSelected,
        badgeText: 'Absent (No Login)',
        bg: CALENDAR_COLORS.absent.bg,
        color: CALENDAR_COLORS.absent.color,
        border: `1px solid ${CALENDAR_COLORS.absent.border}`,
        dots: [{ color: CALENDAR_COLORS.absent.dot, label: 'Absent' }],
      };
    }

    // B) TEAM / MANAGER / ADMIN CALENDAR VIEW (All employees in company / team)
    let absentCount = 0;
    let halfDayCount = 0;
    let lateCount = 0;
    let presentCount = 0;
    let onLeaveCount = 0;
    let beforeJoiningCount = 0;

    const targetEmployees = employees.length > 0 ? employees : (user ? [user] : []);

    targetEmployees.forEach((emp) => {
      const empJoining = getEmployeeJoiningDateStr(emp);
      // Rule: Never mark dates before joining as Absent
      if (empJoining && key < empJoining) {
        beforeJoiningCount++;
        return;
      }

      const empLeave = dayLeaves.find((l) => {
        const uId = l.user?._id || l.user;
        return uId && uId.toString() === emp._id?.toString();
      });

      // Rule: Do not mark approved leave as Absent
      if (empLeave) {
        if (empLeave.isHalfDay) {
          halfDayCount++;
        } else {
          onLeaveCount++;
        }
        return;
      }

      const empRecord = dayRecords.find((r) => {
        const uId = r.user?._id || r.user;
        return uId && uId.toString() === emp._id?.toString();
      });

      if (empRecord) {
        if (empRecord.status === 'Half Day') {
          halfDayCount++;
        } else if (empRecord.isLate || empRecord.status === 'Late') {
          lateCount++;
        } else if (
          ['Present', 'Early Departure', 'Missed Check-out'].includes(empRecord.status) ||
          empRecord.checkIn
        ) {
          presentCount++;
        } else if (empRecord.status === 'On Leave') {
          onLeaveCount++;
        } else if (empRecord.status === 'Absent') {
          absentCount++;
        }
      } else {
        // No record on working day:
        if (isFuture) {
          // Future date: Do not mark future dates as Absent
        } else {
          // Rule: Automatically mark an employee Absent (Red) if they do not log in on a scheduled working day
          absentCount++;
        }
      }
    });

    const dots = [];
    if (presentCount > 0) {
      dots.push({ color: CALENDAR_COLORS.present.dot, label: `${presentCount} Present` });
    }
    if (lateCount > 0) {
      dots.push({ color: CALENDAR_COLORS.late.dot, label: `${lateCount} Late` });
    }
    if (halfDayCount > 0) {
      dots.push({ color: '#DC2626', label: `${halfDayCount} Half Day` });
    }
    if (absentCount > 0) {
      dots.push({ color: CALENDAR_COLORS.absent.dot, label: `${absentCount} Absent` });
    }

    if (absentCount > 0) {
      return {
        type: 'team-status',
        primaryCategory: 'absent',
        holiday: null,
        dayLeaves,
        dayRecords,
        isWeekend: false,
        isToday,
        isSelected,
        badgeText: `${absentCount} Absent`,
        bg: CALENDAR_COLORS.absent.bg,
        color: CALENDAR_COLORS.absent.color,
        border: `1px solid ${CALENDAR_COLORS.absent.border}`,
        dots,
      };
    }

    if (halfDayCount > 0) {
      return {
        type: 'team-status',
        primaryCategory: 'halfDay',
        holiday: null,
        dayLeaves,
        dayRecords,
        isWeekend: false,
        isToday,
        isSelected,
        badgeText: `${halfDayCount} Half Day`,
        bg: CALENDAR_COLORS.halfDay.bg,
        color: CALENDAR_COLORS.halfDay.color,
        border: `1px solid ${CALENDAR_COLORS.halfDay.border}`,
        dots,
      };
    }

    if (lateCount > 0) {
      return {
        type: 'team-status',
        primaryCategory: 'late',
        holiday: null,
        dayLeaves,
        dayRecords,
        isWeekend: false,
        isToday,
        isSelected,
        badgeText: `${lateCount} Late`,
        bg: CALENDAR_COLORS.late.bg,
        color: CALENDAR_COLORS.late.color,
        border: `1px solid ${CALENDAR_COLORS.late.border}`,
        dots,
      };
    }

    if (presentCount > 0) {
      return {
        type: 'team-status',
        primaryCategory: 'present',
        holiday: null,
        dayLeaves,
        dayRecords,
        isWeekend: false,
        isToday,
        isSelected,
        badgeText: `${presentCount} Present`,
        bg: CALENDAR_COLORS.present.bg,
        color: CALENDAR_COLORS.present.color,
        border: `1px solid ${CALENDAR_COLORS.present.border}`,
        dots,
      };
    }

    return {
      type: isFuture ? 'upcoming' : 'no-record',
      primaryCategory: 'neutral',
      holiday: null,
      dayLeaves: [],
      dayRecords: [],
      isWeekend: false,
      isToday,
      isSelected,
      badgeText: isFuture ? 'Working Day' : 'No Activity',
      bg: CALENDAR_COLORS.neutral.bg,
      color: CALENDAR_COLORS.neutral.color,
      border: `1px solid ${CALENDAR_COLORS.neutral.border}`,
      dots: [],
    };
  };

  // Holidays occurring in currently viewed month
  const monthHolidays = holidays.filter((h) => {
    if (!h.date) return false;
    const hd = new Date(h.date);
    return hd.getUTCFullYear() === currentYear && hd.getUTCMonth() === currentMonth;
  });

  return (
    <div
      className="opt-card mb-0 d-flex flex-column border bg-white shadow-sm overflow-hidden"
      style={{
        borderColor: 'var(--opt-border, #E2E8F0)',
        borderRadius: '14px',
      }}
    >
      {/* 1. Calendar Header: Icon & Title Neatly Aligned */}
      <div
        className="opt-card-header bg-light bg-opacity-75 d-flex justify-content-between align-items-center py-2 px-3 border-bottom"
        style={{ borderTopLeftRadius: '14px', borderTopRightRadius: '14px' }}
      >
        <div className="d-flex align-items-center gap-2">
          <FiCalendar className="fs-5" style={{ color: 'var(--opt-forest, #0F5132)' }} />
          <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.9rem', letterSpacing: '-0.2px' }}>
            {title}
          </h6>
        </div>

        {isAdmin && showManageLink && (
          <Link
            to="/calendar"
            className="small fw-semibold text-decoration-none d-flex align-items-center gap-1"
            style={{ color: 'var(--opt-forest, #0F5132)', fontSize: '0.76rem' }}
          >
            <span>Manage</span>
            <span>&rarr;</span>
          </Link>
        )}
      </div>

      {/* 2. Month Navigation Toolbar: Previous, Next, Today in one row; Month & Year Centered */}
      <div className="d-flex align-items-center justify-content-between px-2 px-sm-3 py-2 border-bottom bg-white flex-wrap gap-1">
        {/* Buttons in one horizontal row */}
        <div className="d-flex align-items-center gap-1 gap-sm-1.5">
          <button
            onClick={handlePrevMonth}
            className="btn btn-sm btn-light border p-1 d-flex align-items-center justify-content-center text-secondary shadow-none"
            style={{ width: 28, height: 28, borderRadius: '50%' }}
            title="Previous Month"
            aria-label="Previous Month"
          >
            <FiChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="btn btn-sm btn-light border p-1 d-flex align-items-center justify-content-center text-secondary shadow-none"
            style={{ width: 28, height: 28, borderRadius: '50%' }}
            title="Next Month"
            aria-label="Next Month"
          >
            <FiChevronRight size={16} />
          </button>
          <button
            onClick={handleJumpToToday}
            className="btn btn-sm btn-light border py-1 px-2 text-secondary fw-semibold shadow-none rounded-pill"
            style={{ fontSize: '0.72rem', height: 28 }}
            title="Jump to Today"
          >
            Today
          </button>
        </div>

        {/* Centered Month & Year */}
        <div
          className="fw-bold text-dark text-center flex-grow-1"
          style={{ fontSize: '0.9rem', letterSpacing: '0.2px', minWidth: 110 }}
        >
          {MONTH_NAMES[currentMonth]} {currentYear}
        </div>

        {/* Right Spacer matching Left controls on desktop */}
        <div style={{ width: 85 }} className="d-none d-md-block"></div>
      </div>

      <div className="opt-card-body p-2 p-sm-3 d-flex flex-column flex-grow-1">
        {/* Error Notification */}
        {error && (
          <div className="alert alert-warning py-1.5 px-2.5 mb-2.5 small d-flex justify-content-between align-items-center border-0" style={{ borderRadius: '10px' }}>
            <span>{error}</span>
            <button
              onClick={() => fetchCalendarDataset(currentYear, currentMonth)}
              className="btn btn-sm btn-link p-0 text-dark fw-semibold text-decoration-none"
            >
              Retry
            </button>
          </div>
        )}

        {/* Calendar Weekday Column Headers (7 Equal Columns) */}
        <div
          className="d-grid mb-2 text-center"
          style={{
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '4px',
            justifyItems: 'center',
          }}
        >
          {WEEKDAY_NAMES.map((day, idx) => (
            <div
              key={day}
              className="calendar-weekday-cell py-1 small fw-bold text-uppercase d-flex align-items-center justify-content-center"
              style={{
                width: 34,
                fontSize: '0.68rem',
                letterSpacing: '0.5px',
                color: idx === 0 || idx === 6 ? '#94A3B8' : '#475569',
              }}
            >
              <span className="d-none d-sm-inline">{day}</span>
              <span className="d-inline d-sm-none">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Monthly Date Grid (7 Equal Columns) */}
        <div
          className="d-grid flex-grow-1"
          style={{
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '6px 4px',
            justifyItems: 'center',
          }}
        >
          {/* Preceding padding days from previous month */}
          {Array.from({ length: firstDayOfMonth }).map((_, idx) => {
            const prevDayNum = daysInPrevMonth - firstDayOfMonth + idx + 1;
            return (
              <div
                key={`prev-${idx}`}
                className="calendar-date-cell text-center d-flex align-items-center justify-content-center"
                style={{
                  width: 34,
                  height: 34,
                  minWidth: 34,
                  minHeight: 34,
                  fontSize: '0.74rem',
                  color: '#CBD5E1',
                  backgroundColor: '#FAFAFA',
                  border: '1px solid #F1F5F9',
                  userSelect: 'none',
                  borderRadius: '50%',
                  margin: '0 auto',
                }}
              >
                {prevDayNum}
              </div>
            );
          })}

          {/* Days of the active month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayInfo = getDayInfo(currentYear, currentMonth, dayNum);

            const isSelected = dayInfo.isSelected;
            const isToday = dayInfo.isToday;
            const isGradient = dayInfo.bg && dayInfo.bg.startsWith('linear-gradient');

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => setSelectedDate(new Date(currentYear, currentMonth, dayNum))}
                className="calendar-date-cell text-center d-flex flex-column align-items-center justify-content-center"
                style={{
                  width: 34,
                  height: 34,
                  minWidth: 34,
                  minHeight: 34,
                  background: dayInfo.bg,
                  backgroundColor: isGradient ? undefined : dayInfo.bg,
                  backgroundImage: isGradient ? dayInfo.bg : undefined,
                  color: dayInfo.color,
                  border: dayInfo.border,
                  outline: isSelected ? '2px solid #2563EB' : isToday ? '2px solid #16A34A' : 'none',
                  outlineOffset: '-1px',
                  boxShadow: isSelected
                    ? '0 0 0 2px #2563EB, 0 1px 4px rgba(37, 99, 235, 0.25)'
                    : isToday
                    ? '0 0 0 2px #16A34A'
                    : 'none',
                  zIndex: isSelected ? 2 : 1,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto',
                  fontWeight: dayInfo.type === 'holiday' ? 700 : 600,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.15s ease-in-out',
                  position: 'relative',
                  userSelect: 'none',
                }}
                title={`${MONTH_NAMES[currentMonth]} ${dayNum}: ${dayInfo.badgeText}`}
              >
                <span
                  style={{
                    lineHeight: 1,
                    textShadow:
                      dayInfo.type === 'halfDay' || dayInfo.primaryCategory === 'halfDay'
                        ? '0 1px 2px rgba(0, 0, 0, 0.7)'
                        : undefined,
                  }}
                >
                  {dayNum}
                </span>

                {/* Status Indicator Dots Row */}
                {dayInfo.dots && dayInfo.dots.length > 0 && (
                  <div
                    className="d-flex align-items-center justify-content-center gap-0.5"
                    style={{ position: 'absolute', bottom: 3 }}
                  >
                    {dayInfo.dots.slice(0, 2).map((dot, dIdx) => (
                      <span
                        key={dIdx}
                        style={{
                          width: 3,
                          height: 3,
                          backgroundColor: dot.color,
                          borderRadius: '50%',
                          display: 'inline-block',
                        }}
                        title={dot.label}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Trailing padding days for next month */}
          {(() => {
            const totalCells = firstDayOfMonth + daysInMonth;
            const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
            return Array.from({ length: remaining }).map((_, idx) => (
              <div
                key={`next-${idx}`}
                className="calendar-date-cell text-center d-flex align-items-center justify-content-center"
                style={{
                  width: 34,
                  height: 34,
                  minWidth: 34,
                  minHeight: 34,
                  fontSize: '0.74rem',
                  color: '#CBD5E1',
                  backgroundColor: '#FAFAFA',
                  border: '1px solid #F1F5F9',
                  userSelect: 'none',
                  borderRadius: '50%',
                  margin: '0 auto',
                }}
              >
                {idx + 1}
              </div>
            ));
          })()}
        </div>

        {/* 3. CALENDAR LEGEND BAR */}
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-2 gap-sm-2.5 pt-2.5 mt-2.5 border-top">
          {/* Present (Green) */}
          <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            <span
              style={{
                width: 11,
                height: 11,
                backgroundColor: CALENDAR_COLORS.present.bg,
                border: `1px solid ${CALENDAR_COLORS.present.border}`,
                borderRadius: '4px',
                display: 'inline-block',
              }}
            />
            <span className="fw-semibold" style={{ color: CALENDAR_COLORS.present.color }}>
              Present
            </span>
          </div>

          {/* Late Arrival (Orange) */}
          <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            <span
              style={{
                width: 11,
                height: 11,
                backgroundColor: CALENDAR_COLORS.late.bg,
                border: `1px solid ${CALENDAR_COLORS.late.border}`,
                borderRadius: '4px',
                display: 'inline-block',
              }}
            />
            <span className="fw-semibold" style={{ color: CALENDAR_COLORS.late.color }}>
              Late Arrival
            </span>
          </div>

          {/* Absent (Red) */}
          <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            <span
              style={{
                width: 11,
                height: 11,
                backgroundColor: CALENDAR_COLORS.absent.bg,
                border: `1px solid ${CALENDAR_COLORS.absent.border}`,
                borderRadius: '4px',
                display: 'inline-block',
              }}
            />
            <span className="fw-semibold" style={{ color: CALENDAR_COLORS.absent.color }}>
              Absent
            </span>
          </div>

          {/* Public Holiday (Blue) */}
          <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            <span
              style={{
                width: 11,
                height: 11,
                backgroundColor: CALENDAR_COLORS.companyHoliday.bg,
                border: `1px solid ${CALENDAR_COLORS.companyHoliday.border}`,
                borderRadius: '4px',
                display: 'inline-block',
              }}
            />
            <span className="fw-semibold" style={{ color: CALENDAR_COLORS.companyHoliday.color }}>
              Public Holiday
            </span>
          </div>
        </div>

        {/* 4. MONTH'S SCHEDULED HOLIDAYS LIST */}
        <div className="mt-3 pt-2.5 border-top">
          <div className="d-flex justify-content-between align-items-center mb-1.5">
            <span
              className="fw-bold text-uppercase"
              style={{ fontSize: '0.7rem', letterSpacing: '0.6px', color: '#64748B' }}
            >
              Holidays in {MONTH_NAMES[currentMonth]}
            </span>
            <span
              className="badge rounded-pill bg-light text-secondary border px-2.5 py-1 fw-semibold"
              style={{ fontSize: '0.68rem', borderRadius: '9999px' }}
            >
              {monthHolidays.length} {monthHolidays.length === 1 ? 'Day' : 'Days'}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-2 text-muted small">
              <div className="spinner-border spinner-border-sm text-primary me-1" role="status"></div>
              Loading calendar...
            </div>
          ) : monthHolidays.length > 0 ? (
            <div className="d-flex flex-column gap-1.5">
              {monthHolidays.map((h) => {
                const hd = new Date(h.date);
                const dayStr = hd.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                });
                return (
                  <div
                    key={h._id}
                    onClick={() => {
                      const d = new Date(hd.getUTCFullYear(), hd.getUTCMonth(), hd.getUTCDate());
                      setSelectedDate(d);
                    }}
                    className="p-2 px-3 border d-flex justify-content-between align-items-center cursor-pointer transition-all"
                    style={{
                      backgroundColor: CALENDAR_COLORS.companyHoliday.bg,
                      borderColor: '#BFDBFE',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                    }}
                    title="Click to highlight date on calendar"
                  >
                    <span
                      className="fw-bold d-flex align-items-center gap-1.5"
                      style={{ color: CALENDAR_COLORS.companyHoliday.color }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: CALENDAR_COLORS.companyHoliday.dot,
                          borderRadius: '50%',
                          display: 'inline-block',
                        }}
                      />
                      {h.name}
                    </span>
                    <span
                      className="fw-medium"
                      style={{ color: '#1E40AF', fontSize: '0.72rem' }}
                    >
                      {dayStr} {h.type ? `(${h.type})` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="text-center py-2 px-3 text-muted border"
              style={{ fontSize: '0.73rem', backgroundColor: '#F8FAFC', borderStyle: 'dashed', borderRadius: '10px' }}
            >
              No company holidays scheduled in {MONTH_NAMES[currentMonth]} {currentYear}.
            </div>
          )}
        </div>

        {/* 5. SELECTED DATE ATTENDANCE INSPECTOR (Admin & Employee Date Status Breakdown) */}
        <div className="mt-3 pt-2.5 border-top selected-date-inspector">
          {/* Header Bar */}
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-2">
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                style={{
                  width: 26,
                  height: 26,
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                }}
              >
                <FiUsers size={14} />
              </div>
              <div>
                <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '0.82rem' }}>
                  <span>{formattedSelectedDate}</span>
                  {isSelectedDateToday && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success py-0.5 px-1.5" style={{ fontSize: '0.65rem' }}>
                      Today
                    </span>
                  )}
                  {isSelectedDateFuture && (
                    <span className="badge bg-info bg-opacity-10 text-info border border-info py-0.5 px-1.5" style={{ fontSize: '0.65rem' }}>
                      Upcoming
                    </span>
                  )}
                </h6>
                <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                  {selectedDateHoliday
                    ? `Public Holiday: ${selectedDateHoliday.name}`
                    : isSelectedDateWeekend
                    ? `Weekly Off (${selectedDayName})`
                    : 'Scheduled Working Day Attendance'}
                </small>
              </div>
            </div>

            {/* Quick KPI summary badges */}
            <div className="d-flex flex-wrap align-items-center gap-1.5">
              {selectedDateSummary.present > 0 && (
                <span
                  className="badge bg-success bg-opacity-10 text-success border border-success fw-semibold py-0.5 px-1.5"
                  style={{ fontSize: '0.68rem' }}
                >
                  🟢 {selectedDateSummary.present} Present
                </span>
              )}
              {selectedDateSummary.late > 0 && (
                <span
                  className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning fw-semibold py-0.5 px-1.5"
                  style={{ fontSize: '0.68rem' }}
                >
                  🟠 {selectedDateSummary.late} Late
                </span>
              )}
              {selectedDateSummary.halfDay > 0 && (
                <span
                  className="badge bg-warning bg-opacity-10 text-dark border border-warning fw-semibold py-0.5 px-1.5"
                  style={{ fontSize: '0.68rem' }}
                >
                  🌓 {selectedDateSummary.halfDay} Half Day
                </span>
              )}
              {selectedDateSummary.absent > 0 && (
                <span
                  className="badge bg-danger bg-opacity-10 text-danger border border-danger fw-semibold py-0.5 px-1.5"
                  style={{ fontSize: '0.68rem' }}
                  title="Automatically marked absent for unrecorded working shifts"
                >
                  🔴 {selectedDateSummary.absent} Absent
                </span>
              )}
              {selectedDateSummary.onLeave > 0 && (
                <span
                  className="badge bg-info bg-opacity-10 text-info border border-info fw-semibold py-0.5 px-1.5"
                  style={{ fontSize: '0.68rem' }}
                >
                  🔵 {selectedDateSummary.onLeave} Leave
                </span>
              )}
              {selectedDateSummary.beforeJoining > 0 && (
                <span
                  className="badge bg-light text-muted border fw-semibold py-0.5 px-1.5"
                  style={{ fontSize: '0.68rem' }}
                  title="Employee had not yet joined on this date"
                >
                  ⚪ {selectedDateSummary.beforeJoining} Not Joined Yet
                </span>
              )}
            </div>
          </div>

          {/* TEAM / ADMIN VIEW: Search & Status Filter Toolbar + Detailed Employee Table */}
          {isTeamView ? (
            <div className="d-flex flex-column gap-2">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-1.5 bg-light p-1.5 rounded-2 border">
                <div className="position-relative flex-grow-1" style={{ minWidth: 150 }}>
                  <FiSearch
                    size={13}
                    className="position-absolute text-muted"
                    style={{ left: 8, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm ps-4"
                    placeholder="Search employee name or ID..."
                    style={{ fontSize: '0.76rem', height: 28 }}
                    value={inspectorSearch}
                    onChange={(e) => setInspectorSearch(e.target.value)}
                  />
                </div>

                <div className="d-flex align-items-center gap-1">
                  <select
                    className="form-select form-select-sm"
                    style={{ fontSize: '0.74rem', height: 28, minWidth: 130 }}
                    value={inspectorFilter}
                    onChange={(e) => setInspectorFilter(e.target.value)}
                  >
                    <option value="All">All Staff ({selectedDateEmployeeStatuses.length})</option>
                    <option value="Present">Present ({selectedDateSummary.present})</option>
                    <option value="Late Arrival">Late Arrival ({selectedDateSummary.late})</option>
                    <option value="Half Day">Half Day ({selectedDateSummary.halfDay})</option>
                    <option value="Absent">Absent ({selectedDateSummary.absent})</option>
                    <option value="On Leave">On Leave ({selectedDateSummary.onLeave})</option>
                    <option value="Before Joining">Not Joined Yet ({selectedDateSummary.beforeJoining})</option>
                  </select>
                </div>
              </div>

              {/* Employee Attendance Table */}
              <div className="table-responsive border rounded-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.76rem' }}>
                  <thead className="bg-light sticky-top" style={{ zIndex: 1 }}>
                    <tr>
                      <th className="py-1.5 px-2.5">Employee</th>
                      <th className="py-1.5 px-2">Date of Joining</th>
                      <th className="py-1.5 px-2">Attendance Status</th>
                      <th className="py-1.5 px-2">Punches & Hours</th>
                      <th className="py-1.5 px-2.5">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployeeStatuses.length > 0 ? (
                      filteredEmployeeStatuses.map((item) => {
                        const emp = item.emp;
                        const deptName = emp.department?.name || emp.department || 'General';
                        const checkInTime = item.checkIn
                          ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '--:--';
                        const checkOutTime = item.checkOut
                          ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '--:--';

                        return (
                          <tr key={emp._id || emp.employeeId}>
                            <td className="py-1.5 px-2.5">
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    backgroundColor: item.isAbsent ? '#DC2626' : '#0F5132',
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  {emp.fullName?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: 130 }}>
                                    {emp.fullName}
                                  </div>
                                  <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                                    {emp.employeeId} • {deptName}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td className="py-1.5 px-2 text-nowrap">
                              <span className="text-secondary small fw-medium">
                                {item.joiningDateStr}
                              </span>
                              {item.status === 'Before Joining' && (
                                <span className="d-block text-muted" style={{ fontSize: '0.65rem' }}>
                                  Joined after this date
                                </span>
                              )}
                            </td>

                            <td className="py-1.5 px-2 text-nowrap">
                              <span
                                className={`badge py-1 px-1.5 d-inline-flex align-items-center gap-1 ${item.badgeClass}`}
                                style={{ fontSize: '0.7rem' }}
                              >
                                {item.status === 'Present' && <FiCheckCircle size={10} />}
                                {item.status === 'Late Arrival' && <FiClock size={10} />}
                                {item.status === 'Absent' && <FiAlertCircle size={10} />}
                                {item.badgeText}
                              </span>
                            </td>

                            <td className="py-1.5 px-2 text-nowrap">
                              {item.checkIn || item.workingHours > 0 ? (
                                <div>
                                  <span className="fw-semibold text-dark">
                                    {checkInTime} - {checkOutTime}
                                  </span>
                                  {item.workingHours > 0 && (
                                    <small className="d-block text-muted" style={{ fontSize: '0.66rem' }}>
                                      {item.workingHours} hrs worked
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                                  {item.status === 'Absent'
                                    ? 'No login recorded'
                                    : item.status === 'On Leave'
                                    ? 'Leave approved'
                                    : item.status === 'Public Holiday'
                                    ? 'Public Holiday'
                                    : item.status === 'Weekly Off'
                                    ? 'Off duty'
                                    : item.status === 'Before Joining'
                                    ? 'Not employed yet'
                                    : 'Scheduled'}
                                </span>
                              )}
                            </td>

                            <td className="py-1.5 px-2.5 small">
                              <span
                                className={
                                  item.isAutoAbsent
                                    ? 'text-danger fw-semibold'
                                    : item.status === 'Before Joining'
                                    ? 'text-muted'
                                    : 'text-secondary'
                                }
                                style={{ fontSize: '0.7rem' }}
                              >
                                {item.notes}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-3 text-muted small">
                          No employees matched the selected filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* EMPLOYEE SINGLE VIEW: Individual Day Card */
            <div className="p-2.5 bg-light rounded-3 border">
              {selectedDateEmployeeStatuses.length > 0 ? (
                (() => {
                  const item = selectedDateEmployeeStatuses[0];
                  return (
                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span
                            className={`badge py-1 px-2 d-inline-flex align-items-center gap-1 ${item.badgeClass}`}
                            style={{ fontSize: '0.74rem' }}
                          >
                            {item.status === 'Present' && <FiCheckCircle size={11} />}
                            {item.status === 'Late Arrival' && <FiClock size={11} />}
                            {item.status === 'Absent' && <FiAlertCircle size={11} />}
                            {item.badgeText}
                          </span>
                          <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                            Date of Joining: {item.joiningDateStr}
                          </span>
                        </div>
                        <p className="mb-0 text-secondary small" style={{ fontSize: '0.74rem', lineHeight: 1.4 }}>
                          {item.notes}
                        </p>
                      </div>

                      <div className="d-flex align-items-center gap-2.5 bg-white p-2 px-2.5 rounded-2 border">
                        <div className="text-center">
                          <span className="text-muted d-block" style={{ fontSize: '0.64rem' }}>
                            PUNCH IN
                          </span>
                          <strong className="text-dark" style={{ fontSize: '0.8rem' }}>
                            {item.checkIn
                              ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '--:--'}
                          </strong>
                        </div>
                        <div className="border-start ps-2.5 text-center">
                          <span className="text-muted d-block" style={{ fontSize: '0.64rem' }}>
                            PUNCH OUT
                          </span>
                          <strong className="text-dark" style={{ fontSize: '0.8rem' }}>
                            {item.checkOut
                              ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '--:--'}
                          </strong>
                        </div>
                        <div className="border-start ps-2.5 text-center">
                          <span className="text-muted d-block" style={{ fontSize: '0.64rem' }}>
                            HOURS
                          </span>
                          <strong style={{ color: '#0F5132', fontSize: '0.8rem' }}>
                            {item.workingHours ? `${item.workingHours} hrs` : '0 hrs'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-muted small text-center">No attendance information for this date.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardCalendar;

