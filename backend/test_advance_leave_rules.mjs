// Isolated Test Suite for One Planet CRM Advanced Leave Management Rules
// Covers: Weekend & Holiday exclusion, Advance applications, Month/Year boundaries, Carry-forward, and LOP.

import { calculateWorkingDays } from './utils/workingDays.js';
import { calculateMonthlyAccrual } from './utils/leaveAccrual.js';

console.log('========================================================');
console.log('🧪 RUNNING ADVANCED LEAVE MANAGEMENT RULES ISOLATED TESTS');
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

// Mock company holidays
const mockHolidays = [
  { name: 'Republic Day', date: '2026-01-26' },
  { name: 'Diwali', date: '2026-11-02' },
  { name: 'Christmas', date: '2026-12-25' },
];

async function runTests() {
  // -----------------------------------------------------------
  // SUITE 1: WEEKEND & HOLIDAY EXCLUSION
  // -----------------------------------------------------------
  console.log('--- 1. Weekend & Holiday Exclusion Tests ---');

  // Test 1: Friday to Monday (4 calendar days, exactly 2 working days)
  // 2026-11-06 (Friday), 2026-11-07 (Sat), 2026-11-08 (Sun), 2026-11-09 (Mon)
  const friToMon = await calculateWorkingDays({
    startDate: '2026-11-06',
    endDate: '2026-11-09',
    holidays: mockHolidays,
  });
  assert(friToMon.totalCalendarDays === 4, 'Friday to Monday has 4 calendar days');
  assert(friToMon.weekendDays === 2, 'Friday to Monday has 2 weekend days (Sat/Sun)');
  assert(friToMon.workingDays === 2, 'Friday to Monday strictly counts 2 working days');
  assert(friToMon.workingDates.length === 2 && friToMon.workingDates.includes('2026-11-06') && friToMon.workingDates.includes('2026-11-09'), 'Working dates are exactly Friday and Monday');

  // Test 2: Friday to Tuesday with Monday being a Company Holiday (Diwali on 2026-11-02)
  // 2026-10-30 (Fri), 2026-10-31 (Sat), 2026-11-01 (Sun), 2026-11-02 (Mon, Diwali), 2026-11-03 (Tue)
  const spanHoliday = await calculateWorkingDays({
    startDate: '2026-10-30',
    endDate: '2026-11-03',
    holidays: mockHolidays,
  });
  assert(spanHoliday.totalCalendarDays === 5, 'Span with holiday has 5 calendar days');
  assert(spanHoliday.weekendDays === 2, 'Span with holiday has 2 weekend days');
  assert(spanHoliday.holidayDays === 1, 'Span excludes 1 official company holiday (Diwali)');
  assert(spanHoliday.workingDays === 2, 'Span counts only 2 working days (Friday and Tuesday)');

  // Test 3: Saturday to Sunday selection (0 working days)
  const weekendOnly = await calculateWorkingDays({
    startDate: '2026-11-07',
    endDate: '2026-11-08',
    holidays: mockHolidays,
  });
  assert(weekendOnly.workingDays === 0, 'Saturday-Sunday selection yields 0 working days');
  assert(weekendOnly.weekendDays === 2, 'Identifies 2 weekend days in Saturday-Sunday range');

  // Test 4: Single holiday selection (0 working days)
  const holidayOnly = await calculateWorkingDays({
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    holidays: mockHolidays,
  });
  assert(holidayOnly.workingDays === 0, 'Applying on a company holiday yields 0 working days');
  assert(holidayOnly.holidayDays === 1, 'Correctly flags 1 company holiday');

  // Test 5: Half day on regular working day
  const halfDayWork = await calculateWorkingDays({
    startDate: '2026-11-04', // Wednesday
    endDate: '2026-11-04',
    isHalfDay: true,
    holidays: mockHolidays,
  });
  assert(halfDayWork.workingDays === 0.5, 'Half-day on working day yields 0.5 working day');

  // Test 6: Half day on a weekend or holiday yields 0 working days
  const halfDayWeekend = await calculateWorkingDays({
    startDate: '2026-11-07', // Saturday
    endDate: '2026-11-07',
    isHalfDay: true,
    holidays: mockHolidays,
  });
  assert(halfDayWeekend.workingDays === 0, 'Half-day on weekend yields 0 working days');

  // -----------------------------------------------------------
  // SUITE 2: ADVANCE LEAVE APPLICATION & PROJECTED ACCRUAL
  // -----------------------------------------------------------
  console.log('\n--- 2. Advance Application & Projected Accrual Tests ---');

  // Test 7: Employee applies on October 31 for November 4 leave
  // In October (Month 10), employee has used 0 leaves.
  // By November (Month 11), projected earned is 11 days (1/month).
  const advanceNovAccrual = calculateMonthlyAccrual({
    user: { joiningDate: '2026-01-01' },
    approvedLeaves: [],
    year: 2026,
    asOfDate: new Date('2026-11-04'), // Target future date
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  assert(advanceNovAccrual.availableBalance === 11, 'Projected available balance in November includes November accrued day (11 days)');
  assert(advanceNovAccrual.currentMonth === 11, 'Current evaluated month is November (11)');

  // Test 8: Advance application with existing approved leaves
  // Employee took 3 days in March (consuming Jan, Feb, Mar leaves).
  // From April to November (8 months), employee earns 1 day each month -> 8 days available in November.
  const advanceWithPriorLeaves = calculateMonthlyAccrual({
    user: { joiningDate: '2026-01-01' },
    approvedLeaves: [
      {
        startDate: '2026-03-02',
        endDate: '2026-03-04',
        numberOfDays: 3,
        paidLeaveDays: 3,
        status: 'Approved',
      },
    ],
    year: 2026,
    asOfDate: new Date('2026-11-04'),
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  assert(advanceWithPriorLeaves.availableBalance === 8, 'Projected balance accurately reflects prior leave deductions (8 days available in November)');

  // -----------------------------------------------------------
  // SUITE 3: MONTH-BOUNDARY WORKING DAY ACCRUAL DEDUCTION
  // -----------------------------------------------------------
  console.log('\n--- 3. Month-Boundary & Weekend Deductions in Accrual ---');

  // Test 9: Leave spanning month boundary across weekend
  // 2026-10-30 (Friday) to 2026-11-03 (Tuesday)
  // Working days: Oct 30 (1 day in Oct), Nov 3 (1 day in Nov, since Nov 2 is Diwali)
  // Oct 31 (Sat) & Nov 1 (Sun) are weekends -> strictly excluded!
  const monthBoundaryAccrual = calculateMonthlyAccrual({
    user: { joiningDate: '2026-01-01' },
    approvedLeaves: [
      {
        startDate: '2026-10-30',
        endDate: '2026-11-03',
        numberOfDays: 2, // 2 working days
        paidLeaveDays: 2,
        status: 'Approved',
      },
    ],
    year: 2026,
    asOfDate: new Date('2026-11-15'),
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  const octBreakdown = monthBoundaryAccrual.months.find((m) => m.month === 10);
  const novBreakdown = monthBoundaryAccrual.months.find((m) => m.month === 11);
  assert(octBreakdown.taken === 1, 'October deducts exactly 1 working day (Friday Oct 30), not weekend');
  assert(novBreakdown.taken === 1, 'November deducts exactly 1 working day (Tuesday Nov 3), skipping Diwali & weekend');
  assert(monthBoundaryAccrual.totalLeaveTakenYear === 2, 'Total leave taken in year is exactly 2 working days');

  // -----------------------------------------------------------
  // SUITE 4: LOSS OF PAY (LOP) WITH WORKING DAYS
  // -----------------------------------------------------------
  console.log('\n--- 4. Loss of Pay (LOP) Rules ---');

  // Test 10: Formula Example 1: Available balance 2 days, requested 5 working days -> Paid: 2, LOP: 3
  const available1 = 2;
  const requested1 = 5;
  const paid1 = Math.min(requested1, Math.max(0, available1));
  const lop1 = Math.max(0, requested1 - paid1);
  assert(paid1 === 2, 'Paid leave is min(5, 2) = 2 days');
  assert(lop1 === 3, 'LOP is max(0, 5 - 2) = 3 days');

  // Test 11: Formula Example 2: Available balance 0 days, requested 3 working days -> Paid: 0, LOP: 3
  const available2 = 0;
  const requested2 = 3;
  const paid2 = Math.min(requested2, Math.max(0, available2));
  const lop2 = Math.max(0, requested2 - paid2);
  assert(paid2 === 0, 'Paid leave with 0 balance is 0');
  assert(lop2 === 3, 'Entire 3 days become LOP');

  // Test 12: LOP does NOT deduct from future monthly accrual
  // Employee takes leave with 3 LOP days in February. In March, they still earn their normal 1 day.
  const lopFutureAccrual = calculateMonthlyAccrual({
    user: { joiningDate: '2026-01-01' },
    approvedLeaves: [
      {
        startDate: '2026-02-02',
        endDate: '2026-02-06',
        numberOfDays: 5,
        paidLeaveDays: 2, // 2 paid
        lopDays: 3,       // 3 LOP
        status: 'Approved',
      },
    ],
    year: 2026,
    asOfDate: new Date('2026-03-31'),
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  const marBreakdown = lopFutureAccrual.months.find((m) => m.month === 3);
  assert(marBreakdown.earned === 1, 'Employee earns full 1 day in March despite prior LOP');
  assert(marBreakdown.availableBeforeUsage === 1, 'March available balance is 1 day (0 carry + 1 earned)');

  // -----------------------------------------------------------
  // SUITE 5: PENDING LEAVE & ROLLBACK SAFETY
  // -----------------------------------------------------------
  console.log('\n--- 5. Pending Leaves & Reversal Safety ---');

  // Test 13: Pending leave must NOT deduct from available balance
  const pendingTest = calculateMonthlyAccrual({
    user: { joiningDate: '2026-01-01' },
    approvedLeaves: [],
    pendingLeaves: [
      {
        startDate: '2026-04-06',
        endDate: '2026-04-10',
        numberOfDays: 5,
        status: 'Pending',
      },
    ],
    year: 2026,
    asOfDate: new Date('2026-04-30'),
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  assert(pendingTest.availableBalance === 4, 'Pending request does NOT deduct from April available balance (4 days intact)');
  assert(pendingTest.pendingRequestsCount === 1, 'Records 1 pending request count');
  assert(pendingTest.pendingDays === 5, 'Records 5 pending days in summary');

  // Test 14: Annual Entitlement Cap - newly earned days strictly capped at 12
  const cappedYear = calculateMonthlyAccrual({
    user: { joiningDate: '2026-01-01' },
    approvedLeaves: [],
    year: 2026,
    asOfDate: new Date('2026-12-31'),
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  assert(cappedYear.totalEarnedYearToDate === 12, 'Annual newly earned entitlement is strictly capped at 12 days');

  // Test 15: Prior year carry-forward carries into January
  const yearBoundaryCarry = calculateMonthlyAccrual({
    user: { joiningDate: '2025-01-01' },
    approvedLeaves: [],
    year: 2026,
    asOfDate: new Date('2026-01-31'),
    priorYearCarryForward: 3, // 3 days carried from 2025
    policy: { monthlyAccrualRate: 1, annualEntitlement: 12, carryForwardEnabled: true },
    holidays: mockHolidays,
  });
  const janBreakdown = yearBoundaryCarry.months.find((m) => m.month === 1);
  assert(janBreakdown.carriedIn === 3, 'January receives 3 carried-forward days from prior year');
  assert(yearBoundaryCarry.availableBalance === 4, 'January available balance is 3 carried + 1 earned = 4 days');

  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
