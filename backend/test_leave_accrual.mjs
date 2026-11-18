import assert from 'assert';
import { calculateMonthlyAccrual } from './utils/leaveAccrual.js';

console.log('========================================================');
console.log('🧪 RUNNING ISOLATED LEAVE ACCRUAL & CARRY-FORWARD TESTS');
console.log('========================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc} - ${err.message}`);
    failed++;
  }
}

// ----------------------------------------------------
// 1. Core Policy Example Verification (Jan, Feb, Mar)
// ----------------------------------------------------
it('January: 1 leave earned, unused -> available balance = 1', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-01-15'),
    approvedLeaves: [],
    pendingLeaves: [],
  });

  assert.strictEqual(result.currentMonth, 1);
  assert.strictEqual(result.carriedForward, 0);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.leaveTakenThisMonth, 0);
  assert.strictEqual(result.availableBalance, 1);
});

it('February: 1 new leave + 1 carried forward from Jan -> available balance = 2', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-02-15'),
    approvedLeaves: [],
    pendingLeaves: [],
  });

  assert.strictEqual(result.currentMonth, 2);
  assert.strictEqual(result.carriedForward, 1);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.leaveTakenThisMonth, 0);
  assert.strictEqual(result.availableBalance, 2);
});

it('March: Feb 2 unused leaves + 1 March leave -> available balance = 3', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-15'),
    approvedLeaves: [],
    pendingLeaves: [],
  });

  assert.strictEqual(result.currentMonth, 3);
  assert.strictEqual(result.carriedForward, 2);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.leaveTakenThisMonth, 0);
  assert.strictEqual(result.availableBalance, 3);
});

it('March with 1 leave taken: remaining available balance becomes 2', () => {
  const approvedLeaves = [
    {
      startDate: new Date('2026-03-10'),
      endDate: new Date('2026-03-10'),
      numberOfDays: 1,
      status: 'Approved',
    },
  ];

  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-15'),
    approvedLeaves,
    pendingLeaves: [],
  });

  assert.strictEqual(result.currentMonth, 3);
  assert.strictEqual(result.carriedForward, 2);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.leaveTakenThisMonth, 1);
  assert.strictEqual(result.availableBalance, 2);
  assert.strictEqual(result.totalLeaveTakenYear, 1);
});

// ----------------------------------------------------
// 2. Pending Requests Do Not Deduct from Available Balance
// ----------------------------------------------------
it('Pending leave requests do NOT deduct from available balance', () => {
  const pendingLeaves = [
    {
      startDate: new Date('2026-03-20'),
      endDate: new Date('2026-03-21'),
      numberOfDays: 2,
      status: 'Pending',
    },
  ];

  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-15'),
    approvedLeaves: [],
    pendingLeaves,
  });

  // Balance must remain 3 despite 2 pending days
  assert.strictEqual(result.availableBalance, 3);
  assert.strictEqual(result.pendingRequestsCount, 1);
  assert.strictEqual(result.pendingDays, 2);
});

// ----------------------------------------------------
// 3. Multi-Month Boundary Range Splitting
// ----------------------------------------------------
it('Month boundary leave: spans March 31 to April 1 (1 day in Mar, 1 day in Apr)', () => {
  const approvedLeaves = [
    {
      startDate: new Date('2026-03-31'),
      endDate: new Date('2026-04-01'),
      numberOfDays: 2,
      status: 'Approved',
    },
  ];

  // Check as of March
  const marResult = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-31'),
    approvedLeaves,
  });
  // March had 2 carried forward + 1 earned = 3 available; took 1 day on Mar 31 -> closing = 2
  assert.strictEqual(marResult.leaveTakenThisMonth, 1);
  assert.strictEqual(marResult.availableBalance, 2);

  // Check as of April
  const aprResult = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-04-10'),
    approvedLeaves,
  });
  // April receives 2 carried forward from March + 1 April earned = 3 availableBeforeUsage;
  // takes 1 day on April 1 -> closing = 2
  assert.strictEqual(aprResult.carriedForward, 2);
  assert.strictEqual(aprResult.currentMonthEarned, 1);
  assert.strictEqual(aprResult.leaveTakenThisMonth, 1);
  assert.strictEqual(aprResult.availableBalance, 2);
  assert.strictEqual(aprResult.totalLeaveTakenYear, 2);
});

// ----------------------------------------------------
// 4. Half-Day Leave Support
// ----------------------------------------------------
it('Half-day leave support: 0.5 day taken in Feb carries 1.5 forward into March', () => {
  const approvedLeaves = [
    {
      startDate: new Date('2026-02-13'),
      endDate: new Date('2026-02-13'),
      isHalfDay: true,
      numberOfDays: 0.5,
      status: 'Approved',
    },
  ];

  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-15'),
    approvedLeaves,
  });

  // Jan: 1 earned, 0 taken -> 1 closing
  // Feb: 1 carried + 1 earned = 2; taken 0.5 -> 1.5 closing
  // Mar: 1.5 carried + 1 earned = 2.5 available
  assert.strictEqual(result.carriedForward, 1.5);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.availableBalance, 2.5);
});

// ----------------------------------------------------
// 5. Mid-Year Joiner (e.g. joined in April)
// ----------------------------------------------------
it('Employee joining in April: accrual begins in April (0 for Jan-Mar)', () => {
  const user = {
    joiningDate: '2026-04-01',
  };

  const result = calculateMonthlyAccrual({
    user,
    year: 2026,
    asOfDate: new Date('2026-05-15'),
    approvedLeaves: [],
  });

  // April earned 1 -> carried 1 into May; May earns 1 -> 2 available in May
  assert.strictEqual(result.currentMonth, 5);
  assert.strictEqual(result.carriedForward, 1);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.availableBalance, 2);
  assert.strictEqual(result.totalEarnedYearToDate, 2);
});

// ----------------------------------------------------
// 6. Annual Entitlement Cap (Max 12 Days Newly Earned)
// ----------------------------------------------------
it('Annual entitlement cap: cannot accrue more than 12 newly earned days in a year', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-12-31'),
    approvedLeaves: [],
    policy: {
      monthlyAccrualRate: 1,
      annualEntitlement: 12,
      carryForwardEnabled: true,
    },
  });

  assert.strictEqual(result.totalEarnedYearToDate, 12);
  assert.strictEqual(result.availableBalance, 12);
  assert.strictEqual(result.totalAnnualAllowance, 12);
});

// ----------------------------------------------------
// 7. Policy Toggle: Carry-Forward Disabled
// ----------------------------------------------------
it('Carry-forward disabled: unused leave lapses each month', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-15'),
    approvedLeaves: [],
    policy: {
      monthlyAccrualRate: 1,
      annualEntitlement: 12,
      carryForwardEnabled: false,
    },
  });

  // Since carry-forward is disabled, carriedForward into March is 0
  assert.strictEqual(result.carriedForward, 0);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.availableBalance, 1);
});

// ----------------------------------------------------
// 8. Year Boundary Carry-Forward: From Prior Year into January
// ----------------------------------------------------
it('Year boundary: 2 unused leaves from prior year carry into January', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-01-15'),
    approvedLeaves: [],
    pendingLeaves: [],
    priorYearCarryForward: 2,
    policy: {
      monthlyAccrualRate: 1,
      annualEntitlement: 12,
      carryForwardEnabled: true,
    },
  });

  // Jan: 2 carried from prior year + 1 Jan earned = 3 available
  assert.strictEqual(result.currentMonth, 1);
  assert.strictEqual(result.carriedForward, 2);
  assert.strictEqual(result.currentMonthEarned, 1);
  assert.strictEqual(result.availableBalance, 3);
  // Newly earned in 2026 is still 1
  assert.strictEqual(result.totalEarnedYearToDate, 1);
});

// ----------------------------------------------------
// 9. Year Boundary Cap: Max 12 newly earned days in the new year
// ----------------------------------------------------
it('Year boundary cap: newly earned in new year strictly capped at 12 despite prior carry', () => {
  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-12-31'),
    approvedLeaves: [],
    pendingLeaves: [],
    priorYearCarryForward: 3,
    policy: {
      monthlyAccrualRate: 1,
      annualEntitlement: 12,
      carryForwardEnabled: true,
    },
  });

  // 12 months * 1 earned = 12 newly earned (capped at annualEntitlement)
  assert.strictEqual(result.totalEarnedYearToDate, 12);
  // Total available = 3 carried from prior year + 12 earned = 15
  assert.strictEqual(result.availableBalance, 15);
});

// ----------------------------------------------------
// 10. Duplicate Approval Prevention Simulation
// ----------------------------------------------------
it('Duplicate approval prevention: application cannot be approved twice to prevent double deduction', () => {
  // Simulates controller state transition logic
  const mockLeave = {
    _id: 'leave123',
    status: 'Pending',
    numberOfDays: 2,
    reviewedBy: null,
  };

  let balanceUsed = 0;

  function reviewLeave(leave, newStatus) {
    if (leave.status !== 'Pending') {
      throw new Error(`This leave request is already ${leave.status}.`);
    }
    leave.status = newStatus;
    if (newStatus === 'Approved') {
      balanceUsed += leave.numberOfDays;
    }
    return leave;
  }

  // First approval: succeeds
  reviewLeave(mockLeave, 'Approved');
  assert.strictEqual(mockLeave.status, 'Approved');
  assert.strictEqual(balanceUsed, 2);

  // Second approval: must be blocked with error
  assert.throws(
    () => reviewLeave(mockLeave, 'Approved'),
    /already Approved/
  );
  // Balance used remains 2, preventing duplicate deduction
  assert.strictEqual(balanceUsed, 2);
});

// ----------------------------------------------------
// 11. Loss of Pay (LOP) Automatic Calculations
// ----------------------------------------------------
it('LOP Formula Example 1: Available balance 2 days, requested 5 days -> Paid: 2, LOP: 3', () => {
  // Employee in February has 2 available days (Jan 1 + Feb 1)
  const febState = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-02-15'),
    approvedLeaves: [],
  });
  const availableBalance = febState.availableBalance;
  assert.strictEqual(availableBalance, 2);

  const requestedDays = 5;
  const paidLeave = Math.min(requestedDays, Math.max(0, availableBalance));
  const lopDays = Math.max(0, requestedDays - availableBalance);

  assert.strictEqual(paidLeave, 2, 'Paid leave must equal Minimum(requested, available)');
  assert.strictEqual(lopDays, 3, 'LOP days must equal Maximum(0, requested - available)');

  // Simulate approved leave with 2 paid and 3 LOP days in February (5 working days: Mon Feb 9 to Fri Feb 13)
  const approvedLeaves = [
    {
      startDate: new Date('2026-02-09'),
      endDate: new Date('2026-02-13'),
      numberOfDays: 5,
      paidLeaveDays: paidLeave,
      lopDays: lopDays,
      status: 'Approved',
    },
  ];

  const postApprovalState = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-02-15'),
    approvedLeaves,
  });

  // Only the 2 paid days should be deducted from balance; closing balance is 0
  assert.strictEqual(postApprovalState.leaveTakenThisMonth, 2);
  assert.strictEqual(postApprovalState.availableBalance, 0);
  assert.strictEqual(postApprovalState.totalLopDaysYear, 3);
});

it('LOP Formula Example 2: Available balance 0 days, requested 3 days -> Paid: 0, LOP: 3', () => {
  // Available balance is 0
  const availableBalance = 0;
  const requestedDays = 3;
  const paidLeave = Math.min(requestedDays, Math.max(0, availableBalance));
  const lopDays = Math.max(0, requestedDays - availableBalance);

  assert.strictEqual(paidLeave, 0);
  assert.strictEqual(lopDays, 3);

  // When approved, 0 paid days are deducted, available balance remains 0 (not negative!)
  const approvedLeaves = [
    {
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-12'),
      numberOfDays: 3,
      paidLeaveDays: 0,
      lopDays: 3,
      status: 'Approved',
    },
  ];

  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-02-15'),
    approvedLeaves,
  });

  // Jan 1 + Feb 1 = 2 earned before usage; if 0 paid taken, balance = 2;
  // If user had 0 balance initially (e.g. took 2 paid days in Jan/Feb on working days):
  const approvedWithPriorUsage = [
    {
      startDate: new Date('2026-01-12'),
      endDate: new Date('2026-01-12'),
      numberOfDays: 1,
      paidLeaveDays: 1,
      lopDays: 0,
      status: 'Approved',
    },
    {
      startDate: new Date('2026-02-05'),
      endDate: new Date('2026-02-05'),
      numberOfDays: 1,
      paidLeaveDays: 1,
      lopDays: 0,
      status: 'Approved',
    },
    {
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-12'),
      numberOfDays: 3,
      paidLeaveDays: 0,
      lopDays: 3,
      status: 'Approved',
    },
  ];

  const postState = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-02-15'),
    approvedLeaves: approvedWithPriorUsage,
  });

  assert.strictEqual(postState.availableBalance, 0, 'Available balance must remain 0 and never drop below 0');
  assert.strictEqual(postState.totalLopDaysYear, 3, 'Total LOP days must record 3');
});

it('LOP does NOT reduce future leave accrual: employee earns normal 1 day in following month', () => {
  // Employee takes 5 working days (2 paid + 3 LOP) in February, leaving balance at 0
  const approvedLeaves = [
    {
      startDate: new Date('2026-02-09'),
      endDate: new Date('2026-02-13'),
      numberOfDays: 5,
      paidLeaveDays: 2,
      lopDays: 3,
      status: 'Approved',
    },
  ];

  // Check state in March
  const marState = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-03-15'),
    approvedLeaves,
  });

  // March carried forward = 0 (from Feb closing balance), earns 1 day in March -> March available = 1
  assert.strictEqual(marState.carriedForward, 0);
  assert.strictEqual(marState.currentMonthEarned, 1, 'Employee must earn standard 1 day in March');
  assert.strictEqual(marState.availableBalance, 1, 'March balance must be 1 day');
  assert.strictEqual(marState.totalLopDaysYear, 3, 'LOP history preserved');
});

it('Pending application with LOP does NOT deduct balance while pending', () => {
  const pendingLeaves = [
    {
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-14'),
      numberOfDays: 5,
      paidLeaveDays: 2,
      lopDays: 3,
      status: 'Pending',
    },
  ];

  const result = calculateMonthlyAccrual({
    year: 2026,
    asOfDate: new Date('2026-02-15'),
    approvedLeaves: [],
    pendingLeaves,
  });

  // Available balance in Feb must remain 2 despite 5 days pending
  assert.strictEqual(result.availableBalance, 2);
  assert.strictEqual(result.pendingRequestsCount, 1);
  assert.strictEqual(result.pendingDays, 5);
});

it('Approval recalculation & separate LOP recording simulation', () => {
  let mockBalance = { used: 0, lopDays: 0 };

  const application = {
    _id: 'app100',
    status: 'Pending',
    numberOfDays: 6,
    paidLeaveDays: 2,
    lopDays: 4,
  };

  // Simulates controller approval logic
  function approveApplication(app, liveAvailableBalance) {
    if (app.status !== 'Pending') {
      throw new Error(`Already ${app.status}`);
    }
    const finalPaid = Math.min(app.numberOfDays, Math.max(0, liveAvailableBalance));
    const finalLop = Math.max(0, app.numberOfDays - finalPaid);

    app.paidLeaveDays = finalPaid;
    app.lopDays = finalLop;
    app.status = 'Approved';

    // Deduct only paid leave days
    mockBalance.used += finalPaid;
    // Record LOP days separately
    mockBalance.lopDays += finalLop;
    return app;
  }

  // Suppose live available balance is 3 at approval time (e.g. March accrual was added)
  approveApplication(application, 3);

  assert.strictEqual(application.status, 'Approved');
  assert.strictEqual(application.paidLeaveDays, 3);
  assert.strictEqual(application.lopDays, 3);
  assert.strictEqual(mockBalance.used, 3, 'Only 3 paid days deducted from balance');
  assert.strictEqual(mockBalance.lopDays, 3, '3 LOP days recorded separately');

  // Prevent duplicate approval / duplicate deduction
  assert.throws(() => approveApplication(application, 3), /Already Approved/);
  assert.strictEqual(mockBalance.used, 3);
  assert.strictEqual(mockBalance.lopDays, 3);
});

it('Delete/Rollback of approved LOP leave rolls back ONLY paid days', () => {
  let balanceUsed = 3; // 3 paid days had been deducted

  const approvedLeave = {
    _id: 'leave200',
    status: 'Approved',
    numberOfDays: 6,
    paidLeaveDays: 3,
    lopDays: 3,
  };

  function rollbackLeave(leave) {
    const paidToRollback = leave.paidLeaveDays !== undefined ? leave.paidLeaveDays : leave.numberOfDays;
    balanceUsed -= paidToRollback;
  }

  rollbackLeave(approvedLeave);
  assert.strictEqual(balanceUsed, 0, 'Rolled back 3 paid days, not 6 total days');
});

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}
