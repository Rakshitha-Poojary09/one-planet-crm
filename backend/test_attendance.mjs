import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';

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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      // empty
    }
  } else {
    try {
      data = await res.text();
    } catch (e) {
      // empty
    }
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runAttendanceTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING ADMIN ATTENDANCE MANAGEMENT MODULE AUTOMATED TESTS');
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

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const attendanceCollection = db.collection('attendances');
  const correctionsCollection = db.collection('attendancecorrections');
  const auditLogsCollection = db.collection('auditlogs');
  const settingsCollection = db.collection('systemsettings');

  const initialAttendanceCount = await attendanceCollection.countDocuments();
  const initialCorrectionsCount = await correctionsCollection.countDocuments();
  console.log(`ℹ️  Initial MongoDB attendances: ${initialAttendanceCount}, corrections: ${initialCorrectionsCount}`);

  let adminToken = '';
  let employeeToken = '';
  let employeeId = '';
  let managerId = '';

  const testDate = '2026-10-25'; // A Sunday / test date for controlled verification
  let createdCorrectionId = null;
  let originalSettings = null;

  try {
    // 1. Authenticate as Admin
    const adminLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@oneplanet.tech', password: 'AdminPassword123!' },
    });
    assert(adminLogin.ok && adminLogin.data?.user?.role === 'Admin', 'Admin login successful');
    adminToken = adminLogin.data?.token;

    // 2. Authenticate as Employee
    const empLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: 'employee@oneplanet.tech', password: 'EmployeePassword123!' },
    });
    assert(empLogin.ok && empLogin.data?.user?.role === 'Employee', 'Employee login successful');
    employeeToken = empLogin.data?.token;
    employeeId = empLogin.data?.user?._id;
    managerId = empLogin.data?.user?.reportingManager || null;

    // 3. Operational Overview Endpoint (/api/attendance/overview)
    const overviewRes = await req(`/attendance/overview?date=${testDate}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(overviewRes.ok && overviewRes.data?.overview, 'Admin GET /api/attendance/overview returns 200 with overview object');
    const ov = overviewRes.data?.overview || {};
    assert(
      typeof ov.scheduledToWork === 'number' &&
      typeof ov.present === 'number' &&
      typeof ov.absent === 'number' &&
      typeof ov.lateArrivals === 'number' &&
      typeof ov.onApprovedLeave === 'number' &&
      typeof ov.weeklyOffAndHoliday === 'number',
      `Overview contains scheduled (${ov.scheduledToWork}), present (${ov.present}), absent (${ov.absent}), leave (${ov.onApprovedLeave}), weeklyOff/holiday (${ov.weeklyOffAndHoliday})`
    );

    // 4. Security check on Overview
    const unauthOverview = await req('/attendance/overview');
    assert(unauthOverview.status === 401, 'Unauthenticated GET /api/attendance/overview returns 401');

    // 5. Attendance Records Table with Manager Population
    const allAttendanceRes = await req('/attendance/all', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(allAttendanceRes.ok && Array.isArray(allAttendanceRes.data?.records), 'Admin GET /api/attendance/all returns records array');
    if (allAttendanceRes.data?.records?.length > 0) {
      const first = allAttendanceRes.data.records[0];
      assert(first.user !== undefined, 'Attendance record populates employee user');
      if (first.user?.reportingManager) {
        assert(typeof first.user.reportingManager === 'object', 'Attendance record populates user.reportingManager object');
      }
    }

    // 6. Attendance Settings: Fetch
    const getSettingsRes = await req('/attendance/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getSettingsRes.ok && getSettingsRes.data?.settings?.officeStartTime, 'Admin GET /api/attendance/settings returns policy configuration');
    originalSettings = getSettingsRes.data?.settings;

    // 7. Attendance Settings: Employee Access Forbidden (RBAC)
    const empSettingsRes = await req('/attendance/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: { gracePeriodMinutes: 30 },
    });
    assert(empSettingsRes.status === 403, 'RBAC: Employee PUT /api/attendance/settings returns 403 Forbidden');

    // 8. Attendance Settings: Validation & Update by Admin
    const invalidSettingRes = await req('/attendance/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { officeStartTime: 'invalid-time-format' },
    });
    assert(invalidSettingRes.status === 400, 'Validation: Invalid officeStartTime format rejected with 400');

    const updateSettingRes = await req('/attendance/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        officeStartTime: '09:15',
        officeEndTime: '18:15',
        gracePeriodMinutes: 20,
        maxCorrectionDaysAllowed: 10,
      },
    });
    assert(updateSettingRes.ok && updateSettingRes.data?.settings?.officeStartTime === '09:15', 'Admin PUT /api/attendance/settings updates policy settings successfully');

    // 9. Admin Manual Mark Attendance: Mandatory Reason Validation
    const noReasonRes = await req('/attendance/admin-mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        userId: employeeId,
        date: testDate,
        status: 'Present',
        // no reason or notes provided
      },
    });
    assert(noReasonRes.status === 400 && noReasonRes.data?.message?.toLowerCase().includes('reason'), 'Validation: Manual adjustment without reason rejected with 400');

    // 10. Admin Manual Mark Attendance: Invalid Time Range Validation (Check-out before Check-in)
    const invalidTimesRes = await req('/attendance/admin-mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        userId: employeeId,
        date: testDate,
        checkIn: `${testDate}T18:00:00.000Z`,
        checkOut: `${testDate}T09:00:00.000Z`, // Earlier than checkIn!
        reason: 'Testing invalid time range',
      },
    });
    assert(invalidTimesRes.status === 400 && invalidTimesRes.data?.message?.toLowerCase().includes('later'), 'Validation: Check-out before check-in rejected with 400');

    // 11. Admin Manual Mark Attendance: Valid Submission with Accurate Working Hours
    const validMarkRes = await req('/attendance/admin-mark', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        userId: employeeId,
        date: testDate,
        checkIn: `${testDate}T09:30:00.000Z`,
        checkOut: `${testDate}T18:00:00.000Z`, // 8.5 hours
        status: 'Present',
        reason: 'Manual biometric correction authorized by Administrator',
      },
    });
    assert(validMarkRes.ok && validMarkRes.data?.attendance?.workingHours === 8.5, 'Admin manual mark calculates workingHours (8.5 hrs) and records record');
    assert(validMarkRes.data?.attendance?.adjustedReason?.includes('biometric'), 'Admin manual mark stores mandatory adjustedReason');

    // 12. Employee Correction Request: Validation
    const invalidCorrectionTimes = await req('/attendance/corrections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: {
        date: testDate,
        requestedCheckIn: `${testDate}T18:00:00.000Z`,
        requestedCheckOut: `${testDate}T09:00:00.000Z`,
        reason: 'Punch card forgot',
      },
    });
    assert(invalidCorrectionTimes.status === 400, 'Employee correction with invalid time range rejected with 400');

    // 13. Employee Correction Request: Valid Submission
    const validCorrectionRes = await req('/attendance/corrections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: {
        date: testDate,
        requestedCheckIn: `${testDate}T09:00:00.000Z`,
        requestedCheckOut: `${testDate}T18:00:00.000Z`,
        reason: 'Biometric reader on 2nd floor failed during evening checkout',
      },
    });
    assert(validCorrectionRes.status === 201 && validCorrectionRes.data?.correction?._id, 'Employee POST /api/attendance/corrections creates pending request with 201 Created');
    createdCorrectionId = validCorrectionRes.data?.correction?._id;

    // 14. Verification: Attendance row reflects pending correction indicator
    const checkEnriched = await req(`/attendance/all?date=${testDate}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const enrichedRow = (checkEnriched.data?.records || []).find((r) => r.user?._id === employeeId);
    assert(enrichedRow && enrichedRow.hasPendingCorrection === true, 'Attendance record in table immediately reflects hasPendingCorrection: true');

    // 15. Correction Review: Employee Forbidden (RBAC)
    const empReviewRes = await req(`/attendance/corrections/${createdCorrectionId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: { status: 'Approved' },
    });
    assert(empReviewRes.status === 403, 'RBAC: Employee cannot review/approve their own correction request (403 Forbidden)');

    // 16. Correction Review: Admin Approves Request
    const adminReviewRes = await req(`/attendance/corrections/${createdCorrectionId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: 'Approved',
        reviewNotes: 'Verified via security desk visitor log and CCTV timestamps.',
      },
    });
    assert(adminReviewRes.ok && adminReviewRes.data?.correction?.status === 'Approved', 'Admin approves correction request successfully');

    // 17. Verification: Approved correction updates attendance hours (9.0 hrs) and sets notes
    const checkUpdatedAttendance = await req(`/attendance/all?date=${testDate}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const updatedRow = (checkUpdatedAttendance.data?.records || []).find((r) => r.user?._id === employeeId);
    assert(updatedRow && updatedRow.workingHours === 9 && updatedRow.hasPendingCorrection === false, 'Attendance record updated to 9.0 hrs with hasPendingCorrection: false');

    // 18. Export Attendance CSV: Employee Forbidden (RBAC)
    const empExportRes = await req('/attendance/export', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert(empExportRes.status === 403, 'RBAC: Employee GET /api/attendance/export returns 403 Forbidden');

    // 19. Export Attendance CSV: Admin Allowed & CSV Format Verification
    const adminExportRes = await req(`/attendance/export?date=${testDate}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminExportRes.ok, 'Admin GET /api/attendance/export returns 200 OK');
    assert(
      typeof adminExportRes.data === 'string' &&
      adminExportRes.data.includes('Employee Name') &&
      adminExportRes.data.includes('Assigned Manager') &&
      adminExportRes.data.includes('Working Hours'),
      'Exported CSV content contains proper headers including Assigned Manager and Working Hours'
    );
  } finally {
    // 20. CLEANUP GUARANTEE: Remove any test records and restore initial state
    console.log('\n🧹 Performing full database cleanup of test attendance records...');
    const deletedAttendance = await attendanceCollection.deleteMany({ date: testDate });
    console.log(`   Deleted ${deletedAttendance.deletedCount} temporary attendance records for ${testDate}`);

    if (createdCorrectionId) {
      await correctionsCollection.deleteOne({ _id: new mongoose.Types.ObjectId(createdCorrectionId) });
      console.log(`   Deleted temporary correction ${createdCorrectionId}`);
    }

    // Clean any audit logs from tests
    const cleanedAudit = await auditLogsCollection.deleteMany({
      $or: [
        { 'details.date': testDate },
        { action: 'UPDATE_ATTENDANCE_SETTINGS' },
        { changeSummary: { $regex: testDate } },
      ],
    });
    console.log(`   Deleted ${cleanedAudit.deletedCount} temporary audit logs generated during tests`);

    // Restore original settings
    if (originalSettings) {
      await settingsCollection.updateOne(
        {},
        {
          $set: {
            officeStartTime: originalSettings.officeStartTime,
            officeEndTime: originalSettings.officeEndTime,
            gracePeriodMinutes: originalSettings.gracePeriodMinutes,
            maxCorrectionDaysAllowed: originalSettings.maxCorrectionDaysAllowed,
          },
        }
      );
      console.log('   Restored original attendance settings');
    }

    const finalAttendanceCount = await attendanceCollection.countDocuments();
    const finalCorrectionsCount = await correctionsCollection.countDocuments();
    console.log(`ℹ️  Final attendances: ${finalAttendanceCount}, corrections: ${finalCorrectionsCount}`);
    assert(finalAttendanceCount === initialAttendanceCount, `Zero leftover attendances: count (${finalAttendanceCount}) matches initial (${initialAttendanceCount})`);
    assert(finalCorrectionsCount === initialCorrectionsCount, `Zero leftover corrections: count (${finalCorrectionsCount}) matches initial (${initialCorrectionsCount})`);

    await mongoose.disconnect();
  }

  console.log('\n========================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAttendanceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
