// Isolated Unit & Logic Tests for One Planet CRM Attendance Calendar Color Coding & Priority Rules

console.log('========================================================');
console.log('🧪 RUNNING ATTENDANCE CALENDAR COLOR CODING & PRIORITY TESTS');
console.log('========================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Color specifications
const EXPECTED_COLORS = {
  present: { bg: '#DCFCE7', color: '#15803D' },
  late: { bg: '#FFEDD5', color: '#C2410C' },
  absent: { bg: '#FEE2E2', color: '#DC2626' },
  halfDay: {
    bg: 'linear-gradient(135deg, #15803D 0%, #15803D calc(50% - 0.5px), #FFFFFF calc(50% - 0.5px), #FFFFFF calc(50% + 0.5px), #B91C1C calc(50% + 0.5px), #B91C1C 100%)',
    color: '#FFFFFF',
  },
  companyHoliday: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
  weekend: { bg: '#F1F5F9', color: '#64748B' },
};

// 2. Calendar classification engine mimicking DashboardCalendar
function classifyDay({
  dateStr,
  dayOfWeek, // 0 = Sun, 6 = Sat
  holiday,
  approvedLeave,
  attendanceRecord,
  isToday = false,
  isFuture = false,
}) {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Rule 1: Company Holiday takes top priority (Blue)
  if (holiday) {
    return {
      type: 'holiday',
      bg: EXPECTED_COLORS.companyHoliday.bg,
      color: EXPECTED_COLORS.companyHoliday.color,
      badgeText: 'Company Holiday',
      holiday,
    };
  }

  // Rule 2: Weekend is weekly off (Grey); do not mark absent
  if (isWeekend) {
    return {
      type: 'weekend',
      bg: EXPECTED_COLORS.weekend.bg,
      color: EXPECTED_COLORS.weekend.color,
      badgeText: 'Weekly Off',
      isWeekend: true,
    };
  }

  // Rule 3: Half Day: Attendance status Half Day OR approved Half Day leave
  const isHalfDay =
    attendanceRecord?.status === 'Half Day' ||
    (approvedLeave && approvedLeave.status === 'Approved' && approvedLeave.isHalfDay);

  if (isHalfDay) {
    return {
      type: 'halfDay',
      bg: EXPECTED_COLORS.halfDay.bg,
      color: EXPECTED_COLORS.halfDay.color,
      badgeText: 'Half Day',
      attendanceRecord,
      approvedLeave,
    };
  }

  // Rule 4: Late Arrival: Orange (#FFEDD5 bg, #C2410C text)
  if (attendanceRecord && (attendanceRecord.isLate || attendanceRecord.status === 'Late')) {
    return {
      type: 'late',
      bg: EXPECTED_COLORS.late.bg,
      color: EXPECTED_COLORS.late.color,
      badgeText: 'Late Arrival',
      attendanceRecord,
    };
  }

  // Rule 5: Present: Green (#DCFCE7 bg, #15803D text)
  if (
    attendanceRecord &&
    (['Present', 'Early Departure', 'Missed Check-out'].includes(attendanceRecord.status) || attendanceRecord.checkIn)
  ) {
    return {
      type: 'present',
      bg: EXPECTED_COLORS.present.bg,
      color: EXPECTED_COLORS.present.color,
      badgeText: 'Present',
      attendanceRecord,
    };
  }

  // Rule 6: Absent: Red (#FEE2E2 bg, #DC2626 text)
  // Includes unapproved absence and approved full-day leave (Approved Leave separate color removed)
  const isAbsent =
    attendanceRecord?.status === 'Absent' ||
    attendanceRecord?.status === 'On Leave' ||
    (approvedLeave && approvedLeave.status === 'Approved' && !approvedLeave.isHalfDay);

  if (isAbsent) {
    return {
      type: 'absent',
      bg: EXPECTED_COLORS.absent.bg,
      color: EXPECTED_COLORS.absent.color,
      badgeText: approvedLeave ? 'Absent (On Leave)' : 'Absent',
      attendanceRecord,
      approvedLeave,
    };
  }

  // Rule 7: Working day without record -> Do NOT assume absent!
  return {
    type: isFuture ? 'upcoming' : isToday ? 'today-pending' : 'no-record',
    bg: '#FFFFFF',
    color: '#1E293B',
    badgeText: isFuture ? 'Working Day' : isToday ? 'Not Checked In' : 'No Record',
  };
}

// TEST 1: Present Employee Color (Green: #DCFCE7 bg, #15803D text)
const testPresent = classifyDay({
  dateStr: '2026-11-03',
  dayOfWeek: 2, // Tuesday
  attendanceRecord: { status: 'Present', checkIn: '2026-11-03T09:25:00Z', workingHours: 8.5 },
});
assert(testPresent.type === 'present', 'Classifies as present');
assert(testPresent.bg === '#DCFCE7', 'Present background is #DCFCE7');
assert(testPresent.color === '#15803D', 'Present text is #15803D');

// TEST 2: Late Arrival Color (Orange: #FFEDD5 bg, #C2410C text)
const testLate = classifyDay({
  dateStr: '2026-11-04',
  dayOfWeek: 3, // Wednesday
  attendanceRecord: { status: 'Late', isLate: true, lateMinutes: 25, checkIn: '2026-11-04T10:15:00Z' },
});
assert(testLate.type === 'late', 'Classifies as late');
assert(testLate.bg === '#FFEDD5', 'Late background is #FFEDD5 (Orange)');
assert(testLate.color === '#C2410C', 'Late text is #C2410C (Dark orange)');

// TEST 3: Absent Employee Color (Red: #FEE2E2 bg, #DC2626 text)
const testAbsent = classifyDay({
  dateStr: '2026-11-05',
  dayOfWeek: 4, // Thursday
  attendanceRecord: { status: 'Absent', notes: 'Uninformed absence' },
});
assert(testAbsent.type === 'absent', 'Classifies as absent');
assert(testAbsent.bg === '#FEE2E2', 'Absent background is #FEE2E2 (Red)');
assert(testAbsent.color === '#DC2626', 'Absent text is #DC2626 (Dark red)');

// TEST 4: Half Day Split (Dark Green / Subtle Line / Dark Red)
const testHalfDayAttendance = classifyDay({
  dateStr: '2026-11-06',
  dayOfWeek: 5, // Friday
  attendanceRecord: { status: 'Half Day', workingHours: 4.5 },
});
assert(testHalfDayAttendance.type === 'halfDay', 'Classifies as half day');
assert(testHalfDayAttendance.bg === EXPECTED_COLORS.halfDay.bg, 'Half day uses dark green/red gradient with divider');
assert(testHalfDayAttendance.bg.includes('#15803D'), 'Half day Present half uses darker green #15803D');
assert(testHalfDayAttendance.bg.includes('#B91C1C'), 'Half day Absent half uses darker red #B91C1C');
assert(testHalfDayAttendance.color === '#FFFFFF', 'Half day text is readable white');

// TEST 5: Approved Half-Day Leave shows as Half Day split
const testHalfDayLeave = classifyDay({
  dateStr: '2026-11-09',
  dayOfWeek: 1, // Monday
  approvedLeave: { status: 'Approved', isHalfDay: true, numberOfDays: 0.5 },
});
assert(testHalfDayLeave.type === 'halfDay', 'Approved half-day leave classifies as halfDay');
assert(testHalfDayLeave.bg === EXPECTED_COLORS.halfDay.bg, 'Half-day leave uses dark green/red gradient with divider');

// TEST 6: Approved Full-Day Leave shows as Absent (Red) - separate Approved Leave status removed
const testFullDayLeave = classifyDay({
  dateStr: '2026-11-12',
  dayOfWeek: 4, // Thursday
  approvedLeave: { status: 'Approved', isHalfDay: false, numberOfDays: 1, reason: 'Personal' },
});
assert(testFullDayLeave.type === 'absent', 'Approved full-day leave classifies as absent on the calendar');
assert(testFullDayLeave.bg === '#FEE2E2', 'Approved full-day leave background is #FEE2E2');
assert(testFullDayLeave.color === '#DC2626', 'Approved full-day leave text is #DC2626');

// TEST 7: Company Holiday Color (Blue: #DBEAFE bg, #1D4ED8 text)
const testHoliday = classifyDay({
  dateStr: '2026-11-10',
  dayOfWeek: 2, // Tuesday
  holiday: { name: 'Diwali', type: 'Festival' },
  attendanceRecord: null,
});
assert(testHoliday.type === 'holiday', 'Classifies as holiday');
assert(testHoliday.bg === '#DBEAFE', 'Company Holiday background is #DBEAFE (Blue)');
assert(testHoliday.color === '#1D4ED8', 'Company Holiday text is #1D4ED8 (Blue)');

// TEST 8: Weekend / Weekly Off (Grey: #F1F5F9 bg, #64748B text)
const testWeekend = classifyDay({
  dateStr: '2026-11-08',
  dayOfWeek: 0, // Sunday
  attendanceRecord: null,
});
assert(testWeekend.type === 'weekend', 'Classifies as weekend');
assert(testWeekend.bg === '#F1F5F9', 'Weekend background is #F1F5F9 (Grey)');
assert(testWeekend.color === '#64748B', 'Weekend text is #64748B (Muted grey)');

// TEST 9: Business Rule: Weekend is NEVER marked as absent
const testWeekendNoAbsence = classifyDay({
  dateStr: '2026-11-07',
  dayOfWeek: 6, // Saturday
  attendanceRecord: null,
});
assert(testWeekendNoAbsence.type === 'weekend' && testWeekendNoAbsence.type !== 'absent', 'Weekend is never marked as absent');

// TEST 10: Business Rule: Company Holiday is NEVER marked as absent
const testHolidayNoAbsence = classifyDay({
  dateStr: '2026-11-10',
  dayOfWeek: 2,
  holiday: { name: 'Corporate Day' },
  attendanceRecord: null,
});
assert(testHolidayNoAbsence.type === 'holiday' && testHolidayNoAbsence.type !== 'absent', 'Holiday is never marked as absent');

// TEST 11: Business Rule: Missing attendance record is NOT marked as absent
const testMissingRecord = classifyDay({
  dateStr: '2026-11-02',
  dayOfWeek: 1, // Monday
  attendanceRecord: null,
  isToday: false,
  isFuture: false,
});
assert(testMissingRecord.type === 'no-record', 'Missing record defaults to no-record, not absent');
assert(testMissingRecord.bg === '#FFFFFF', 'Missing record uses neutral white background');

// TEST 12: Business Rule: Pending leave is NOT treated as approved leave / absence
const testPendingLeave = classifyDay({
  dateStr: '2026-11-11',
  dayOfWeek: 3,
  approvedLeave: { status: 'Pending', leaveType: { name: 'Sick Leave' } },
  attendanceRecord: null,
});
assert(testPendingLeave.type !== 'absent', 'Pending leave is not treated as approved absence');

// TEST 13: Business Rule: Priority - Company holiday overrides approved leave and attendance
const testHolidayOverlap = classifyDay({
  dateStr: '2026-11-10',
  dayOfWeek: 2,
  holiday: { name: 'National Holiday' },
  approvedLeave: { status: 'Approved', isHalfDay: false },
  attendanceRecord: { status: 'Present' },
});
assert(testHolidayOverlap.type === 'holiday', 'Holiday takes precedence when overlapping leave and attendance');

// TEST 14: Team Aggregation priority for Managers
function aggregateTeamDay({ holiday, isWeekend, attendances, leaves }) {
  if (holiday) return { priority: 'holiday', bg: EXPECTED_COLORS.companyHoliday.bg, color: EXPECTED_COLORS.companyHoliday.color };
  if (isWeekend) return { priority: 'weekend', bg: EXPECTED_COLORS.weekend.bg, color: EXPECTED_COLORS.weekend.color };

  const halfDayLeaves = leaves.filter((l) => l.status === 'Approved' && l.isHalfDay);
  const fullDayLeaves = leaves.filter((l) => l.status === 'Approved' && !l.isHalfDay);

  const halfDayRecords = attendances.filter((a) => a.status === 'Half Day');
  const absentRecords = attendances.filter((a) => a.status === 'Absent' || a.status === 'On Leave');
  const lateRecords = attendances.filter((a) => a.isLate || a.status === 'Late');
  const presentRecords = attendances.filter(
    (a) =>
      ['Present', 'Early Departure'].includes(a.status) ||
      (a.checkIn && !a.isLate && a.status !== 'Late' && a.status !== 'Absent' && a.status !== 'Half Day')
  );

  const totalAbsent = absentRecords.length + fullDayLeaves.length;
  const totalHalfDay = halfDayRecords.length + halfDayLeaves.length;
  const totalLate = lateRecords.length;
  const totalPresent = presentRecords.length;

  if (totalAbsent > 0) return { priority: 'absent', bg: EXPECTED_COLORS.absent.bg, color: EXPECTED_COLORS.absent.color };
  if (totalHalfDay > 0) return { priority: 'halfDay', bg: EXPECTED_COLORS.halfDay.bg, color: EXPECTED_COLORS.halfDay.color };
  if (totalLate > 0) return { priority: 'late', bg: EXPECTED_COLORS.late.bg, color: EXPECTED_COLORS.late.color };
  if (totalPresent > 0) return { priority: 'present', bg: EXPECTED_COLORS.present.bg, color: EXPECTED_COLORS.present.color };
  return { priority: 'neutral', bg: '#FFFFFF', color: '#1E293B' };
}

const teamDayWithAbsence = aggregateTeamDay({
  holiday: null,
  isWeekend: false,
  attendances: [{ user: 'u1', status: 'Present' }, { user: 'u2', status: 'Absent' }],
  leaves: [],
});
assert(teamDayWithAbsence.priority === 'absent', 'Team day with absence highlights red');
assert(teamDayWithAbsence.bg === '#FEE2E2', 'Team day with absence uses #FEE2E2');

const teamDayWithHalfDay = aggregateTeamDay({
  holiday: null,
  isWeekend: false,
  attendances: [{ user: 'u1', status: 'Present' }, { user: 'u2', status: 'Half Day' }],
  leaves: [],
});
assert(teamDayWithHalfDay.priority === 'halfDay', 'Team day with half day highlights half day');
assert(teamDayWithHalfDay.bg === EXPECTED_COLORS.halfDay.bg, 'Team day with half day uses split gradient');

const teamDayWithLate = aggregateTeamDay({
  holiday: null,
  isWeekend: false,
  attendances: [{ user: 'u1', status: 'Present' }, { user: 'u2', status: 'Late', isLate: true }],
  leaves: [],
});
assert(teamDayWithLate.priority === 'late', 'Team day with late arrival highlights orange');
assert(teamDayWithLate.bg === '#FFEDD5', 'Team day with late arrival uses #FFEDD5');

const teamDayAllPresent = aggregateTeamDay({
  holiday: null,
  isWeekend: false,
  attendances: [{ user: 'u1', status: 'Present' }, { user: 'u2', status: 'Present' }],
  leaves: [],
});
assert(teamDayAllPresent.priority === 'present', 'Team day with all present highlights green');
assert(teamDayAllPresent.bg === '#DCFCE7', 'Team day all present uses #DCFCE7');

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}
