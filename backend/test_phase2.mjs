
const BASE_URL = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore
  }
  return { status: res.status, ok: res.ok, data };
}

async function runPhase2Tests() {
  console.log('========================================================');
  console.log('🧪 RUNNING PHASE 2 AUTOMATED TEST SUITE');
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

  // 1. Health & Reset demo passwords
  try {
    const reset = await req('/auth/reset-demo-passwords', { method: 'POST' });
    assert(reset.ok, 'Reset demo credentials successfully');
  } catch (e) {
    assert(false, `Password reset endpoint failed: ${e.message}`);
  }

  // 2. Authentication: Logins for Admin, Manager, and Employee
  let adminToken = '';
  let adminUser = null;
  let managerToken = '';
  let managerUser = null;
  let employeeToken = '';
  let employeeUser = null;

  try {
    const resA = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@oneplanet.tech', password: 'AdminPassword123!' },
    });
    assert(resA.ok && resA.data?.user?.role === 'Admin', 'Admin login verified');
    adminToken = resA.data.token;
    adminUser = resA.data.user;

    const resM = await req('/auth/login', {
      method: 'POST',
      body: { email: 'manager@oneplanet.tech', password: 'ManagerPassword123!' },
    });
    assert(resM.ok && resM.data?.user?.role === 'Manager', 'Manager login verified');
    managerToken = resM.data.token;
    managerUser = resM.data.user;

    const resE = await req('/auth/login', {
      method: 'POST',
      body: { email: 'employee@oneplanet.tech', password: 'EmployeePassword123!' },
    });
    assert(resE.ok && resE.data?.user?.role === 'Employee', 'Employee login verified');
    employeeToken = resE.data.token;
    employeeUser = resE.data.user;
  } catch (e) {
    assert(false, `Authentication setup failed: ${e.message}`);
  }

  const authA = { Authorization: `Bearer ${adminToken}` };
  const authM = { Authorization: `Bearer ${managerToken}` };
  const authE = { Authorization: `Bearer ${employeeToken}` };

  // ==========================================
  // MODULE 1: ATTENDANCE MANAGEMENT
  // ==========================================
  console.log('\n--- 1. Attendance Management & Timestamps ---');

  // 1.1 Check-in as Employee
  let employeeCheckInRecord = null;
  try {
    const res = await req('/attendance/check-in', {
      method: 'POST',
      headers: authE,
    });
    // If already checked in today, it returns 400 with 'already checked in'
    if (res.ok) {
      assert(res.ok && res.data?.attendance?.checkIn, 'Employee punched check-in successfully');
      employeeCheckInRecord = res.data.attendance;
    } else {
      assert(res.data?.message?.includes('already'), 'Employee check-in properly detected today record');
    }
  } catch (e) {
    assert(false, `Check-in failed: ${e.message}`);
  }

  // 1.2 Prevent duplicate check-in
  try {
    const res = await req('/attendance/check-in', {
      method: 'POST',
      headers: authE,
    });
    assert(res.status === 400, 'Duplicate check-in blocked with 400 Bad Request');
  } catch (e) {
    assert(false, `Duplicate check-in prevention failed: ${e.message}`);
  }

  // 1.3 Today attendance retrieval
  try {
    const res = await req('/attendance/today', { headers: authE });
    assert(res.ok && res.data?.attendance?.checkIn, 'GET /attendance/today accurately returns today punch timestamp');
  } catch (e) {
    assert(false, `Get today attendance failed: ${e.message}`);
  }

  // 1.4 Check-out as Employee & Working Hours calculation
  try {
    const res = await req('/attendance/check-out', {
      method: 'POST',
      headers: authE,
    });
    if (res.ok) {
      assert(
        res.ok && res.data?.attendance?.checkOut && res.data?.attendance?.workingHours !== undefined,
        `Check-out recorded with workingHours = ${res.data?.attendance?.workingHours} hrs`
      );
    } else {
      assert(res.data?.message?.includes('already'), 'Duplicate check-out blocked if already checked out');
    }
  } catch (e) {
    assert(false, `Check-out failed: ${e.message}`);
  }

  // 1.5 Prevent duplicate check-out
  try {
    const res = await req('/attendance/check-out', {
      method: 'POST',
      headers: authE,
    });
    assert(res.status === 400, 'Duplicate check-out blocked with 400 Bad Request');
  } catch (e) {
    assert(false, `Duplicate check-out test failed: ${e.message}`);
  }

  // 1.6 Attendance Correction Request
  let correctionId = null;
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  try {
    const res = await req('/attendance/corrections', {
      method: 'POST',
      headers: authE,
      body: {
        date: yesterdayStr,
        requestedCheckIn: `${yesterdayStr}T09:30:00.000Z`,
        requestedCheckOut: `${yesterdayStr}T18:30:00.000Z`,
        reason: 'Office biometric scanner was offline during morning shift',
      },
    });
    assert(res.ok && res.data?.correction?.status === 'Pending', 'Employee submitted attendance correction request');
    correctionId = res.data?.correction?._id;
  } catch (e) {
    assert(false, `Attendance correction submission failed: ${e.message}`);
  }

  // 1.7 RBAC: Employee cannot review correction
  if (correctionId) {
    try {
      const res = await req(`/attendance/corrections/${correctionId}`, {
        method: 'PUT',
        headers: authE,
        body: { status: 'Approved', reviewNotes: 'Self approved' },
      });
      assert(res.status === 403, 'Employee forbidden from approving correction (403)');
    } catch (e) {
      assert(false, `Employee review barrier test failed: ${e.message}`);
    }

    // 1.8 Admin or Manager can review correction
    try {
      const res = await req(`/attendance/corrections/${correctionId}`, {
        method: 'PUT',
        headers: authA,
        body: { status: 'Approved', reviewNotes: 'Verified with security logs' },
      });
      assert(res.ok && res.data?.correction?.status === 'Approved', 'Admin approved attendance correction');
    } catch (e) {
      assert(false, `Correction approval failed: ${e.message}`);
    }
  }

  // ==========================================
  // MODULE 2: LEAVE APPLICATIONS & APPROVALS
  // ==========================================
  console.log('\n--- 2. Leave Applications & Quota Approvals ---');

  // 2.1 Fetch leave types & balances
  let leaveTypes = [];
  try {
    const res = await req('/leaves/types', { headers: authE });
    assert(res.ok && res.data?.leaveTypes?.length > 0, `Fetched ${res.data?.leaveTypes?.length} active leave categories`);
    leaveTypes = res.data.leaveTypes;
  } catch (e) {
    assert(false, `Get leave types failed: ${e.message}`);
  }

  let leaveBalances = [];
  try {
    const res = await req('/leaves/balances/my', { headers: authE });
    assert(res.ok && res.data?.balances?.length > 0, `Retrieved ${res.data?.balances?.length} leave balances for user`);
    leaveBalances = res.data.balances;
  } catch (e) {
    assert(false, `Get leave balances failed: ${e.message}`);
  }

  // 2.2 Detect invalid date range (start > end)
  const targetType = leaveTypes[0]?._id;
  try {
    const res = await req('/leaves', {
      method: 'POST',
      headers: authE,
      body: {
        leaveType: targetType,
        startDate: '2026-11-10',
        endDate: '2026-11-05',
        reason: 'Invalid dates',
      },
    });
    assert(res.status === 400, 'Invalid date range (start > end) rejected with 400');
  } catch (e) {
    assert(false, `Invalid date validation failed: ${e.message}`);
  }

  // 2.3 Apply for Leave with Attachment
  let leaveRequestId = null;
  const leaveStartDate = '2026-11-20';
  const leaveEndDate = '2026-11-21';
  try {
    const res = await req('/leaves', {
      method: 'POST',
      headers: authE,
      body: {
        leaveType: targetType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        isHalfDay: false,
        reason: 'Personal family event',
        attachment: 'https://docs.oneplanet.tech/family-notice.pdf',
      },
    });
    assert(res.ok && res.data?.leaveRequest?.attachment, 'Applied for leave with supporting attachment');
    leaveRequestId = res.data?.leaveRequest?._id;
  } catch (e) {
    assert(false, `Leave application failed: ${e.message}`);
  }

  // 2.4 Detect conflicting duplicate leave request
  try {
    const res = await req('/leaves', {
      method: 'POST',
      headers: authE,
      body: {
        leaveType: targetType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: 'Conflicting leave test',
      },
    });
    assert(res.status === 400, 'Conflicting overlapping leave request rejected with 400');
  } catch (e) {
    assert(false, `Conflicting leave validation failed: ${e.message}`);
  }

  // 2.5 Manager cannot approve their own leave
  try {
    // If manager applied for leave
    const mLeave = await req('/leaves', {
      method: 'POST',
      headers: authM,
      body: {
        leaveType: targetType,
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        reason: 'Manager personal off',
      },
    });
    if (mLeave.ok && mLeave.data?.leaveRequest?._id) {
      const selfReview = await req(`/leaves/${mLeave.data.leaveRequest._id}/review`, {
        method: 'PUT',
        headers: authM,
        body: { status: 'Approved', reviewNotes: 'Self approved' },
      });
      assert(selfReview.status === 403, 'Manager prevented from self-approving their own leave (403)');
    }
  } catch (e) {
    assert(false, `Manager self approval check failed: ${e.message}`);
  }

  // 2.6 Admin / Manager approves employee leave & verifies balance deduction
  if (leaveRequestId) {
    try {
      const res = await req(`/leaves/${leaveRequestId}/review`, {
        method: 'PUT',
        headers: authA,
        body: { status: 'Approved', reviewNotes: 'Approved by Admin' },
      });
      assert(res.ok && res.data?.leave?.status === 'Approved', 'Leave request approved successfully');

      // Verify leave balance was deducted
      const balRes = await req('/leaves/balances/my', { headers: authE });
      const updatedBal = balRes.data?.balances?.find((b) => b.leaveType?._id === targetType);
      assert(updatedBal && updatedBal.used > 0, `Leave balance deducted: ${updatedBal?.used} days used`);
    } catch (e) {
      assert(false, `Leave approval and deduction failed: ${e.message}`);
    }
  }

  // ==========================================
  // MODULE 3: HOLIDAY CALENDAR & NOTIFICATIONS
  // ==========================================
  console.log('\n--- 3. Holiday Calendar & Staff Notifications ---');

  let holidayId = null;
  // 3.1 Admin creates Holiday
  try {
    const res = await req('/calendar/holidays', {
      method: 'POST',
      headers: authA,
      body: {
        name: 'Company Founders Day',
        date: '2026-12-15',
        type: 'Company',
        description: 'Celebration of One Planet Technologies foundation',
      },
    });
    assert(res.ok && res.data?.holiday?._id, 'Admin created new company holiday');
    holidayId = res.data?.holiday?._id;
  } catch (e) {
    assert(false, `Holiday creation failed: ${e.message}`);
  }

  // 3.2 Non-admin cannot create holiday
  try {
    const res = await req('/calendar/holidays', {
      method: 'POST',
      headers: authE,
      body: { name: 'Unauthorized Holiday', date: '2026-12-20' },
    });
    assert(res.status === 403, 'Employee forbidden from creating holidays (403)');
  } catch (e) {
    assert(false, `Holiday RBAC barrier failed: ${e.message}`);
  }

  // 3.3 Admin updates Holiday
  if (holidayId) {
    try {
      const res = await req(`/calendar/holidays/${holidayId}`, {
        method: 'PUT',
        headers: authA,
        body: {
          name: 'One Planet Annual Founders Day',
          description: 'Updated celebration schedule',
        },
      });
      assert(res.ok && res.data?.holiday?.name === 'One Planet Annual Founders Day', 'Admin updated holiday details');
    } catch (e) {
      assert(false, `Holiday update failed: ${e.message}`);
    }
  }

  // 3.4 Shared Calendar approved leaves endpoint
  try {
    const res = await req('/calendar/leaves', { headers: authE });
    assert(res.ok && Array.isArray(res.data?.leaves), 'Shared calendar approved leaves retrieved');
  } catch (e) {
    assert(false, `Calendar leaves retrieval failed: ${e.message}`);
  }

  // 3.5 Admin removes holiday
  if (holidayId) {
    try {
      const res = await req(`/calendar/holidays/${holidayId}`, {
        method: 'DELETE',
        headers: authA,
      });
      assert(res.ok, 'Admin removed holiday successfully');
    } catch (e) {
      assert(false, `Holiday deletion failed: ${e.message}`);
    }
  }

  // ==========================================
  // MODULE 4: ATTENDANCE REPORTS & CSV EXPORT
  // ==========================================
  console.log('\n--- 4. Attendance Reports & CSV Export Datasets ---');

  // 4.1 Attendance report dataset with summary
  try {
    const res = await req('/reports/export-data?type=attendance', { headers: authA });
    assert(
      res.ok && Array.isArray(res.data?.rows) && res.data?.summary?.totalRecords !== undefined,
      `Attendance export report returned ${res.data?.rows?.length} records with summary metrics`
    );
  } catch (e) {
    assert(false, `Attendance report export failed: ${e.message}`);
  }

  // 4.2 Attendance report filtered by month
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const res = await req(`/reports/export-data?type=attendance&month=${currentMonth}&year=${currentYear}`, {
      headers: authA,
    });
    assert(res.ok && res.data?.summary !== undefined, 'Monthly attendance report generated accurately');
  } catch (e) {
    assert(false, `Monthly report generation failed: ${e.message}`);
  }

  // 4.3 Employee access scoping on reports (can only see own records)
  try {
    const res = await req('/reports/export-data?type=attendance', { headers: authE });
    assert(res.ok, 'Employee can export their own attendance data');
    const allOwn = res.data?.rows?.every(
      (r) => r.EmployeeID === employeeUser.employeeId || r.Name === employeeUser.fullName
    );
    assert(allOwn, 'Employee export strictly scoped to their own attendance records');
  } catch (e) {
    assert(false, `Employee report scoping failed: ${e.message}`);
  }

  // ==========================================
  // MODULE 5: PHASE 1 REGRESSION CHECK
  // ==========================================
  console.log('\n--- 5. Phase 1 Regression Verification ---');
  try {
    const dash = await req('/dashboard/admin', { headers: authA });
    assert(
      dash.ok && dash.data?.metrics?.taskCompletionRate !== undefined && dash.data?.projectsWithProgress !== undefined,
      'Phase 1 Admin Dashboard metrics and project completion rates remain intact'
    );

    const empDash = await req('/dashboard/employee', { headers: authE });
    assert(
      empDash.ok && empDash.data?.upcomingHolidays !== undefined,
      'Phase 1 Employee Dashboard loads with upcoming holidays'
    );
  } catch (e) {
    assert(false, `Regression check failed: ${e.message}`);
  }

  // ==========================================
  // CLEANUP: REMOVE ALL TEST RECORDS CREATED DURING TEST RUN
  // ==========================================
  try {
    const { default: mongoose } = await import('mongoose');
    await mongoose.connect('mongodb://127.0.0.1:27017/one_planet_crm');
    
    // Clean test leaves
    if (leaveRequestId) {
      await mongoose.connection.db.collection('leaverequests').deleteOne({ _id: new mongoose.Types.ObjectId(leaveRequestId) });
    }
    await mongoose.connection.db.collection('leaverequests').deleteMany({
      reason: { $in: ['Personal family event', 'Manager personal off', 'Conflicting leave test', 'Invalid dates'] }
    });

    // Clean test attendances
    const todayStr = new Date().toISOString().split('T')[0];
    await mongoose.connection.db.collection('attendances').deleteMany({
      date: { $in: ['2026-11-20', '2026-11-21', yesterdayStr, todayStr] }
    });

    // Clean test correction
    if (correctionId) {
      await mongoose.connection.db.collection('attendancecorrections').deleteOne({ _id: new mongoose.Types.ObjectId(correctionId) });
    }

    // Reset used leave balance for tested user
    if (targetType) {
      await mongoose.connection.db.collection('leavebalances').updateMany(
        { leaveType: new mongoose.Types.ObjectId(targetType) },
        { $set: { used: 0 } }
      );
    }

    await mongoose.disconnect();
    console.log('🧹 Cleaned up 100% of test records from application database.');
  } catch (cleanErr) {
    console.warn('Test cleanup warning:', cleanErr.message);
  }

  console.log('\n========================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests();

