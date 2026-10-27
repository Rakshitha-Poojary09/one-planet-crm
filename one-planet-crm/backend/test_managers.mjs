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
  try {
    data = await res.json();
  } catch (e) {
    // empty
  }
  return { status: res.status, ok: res.ok, data };
}

async function runManagerTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING MANAGER MANAGEMENT MODULE AUTOMATED TESTS');
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
  const usersCollection = db.collection('users');
  const auditLogsCollection = db.collection('auditlogs');

  const initialUserCount = await usersCollection.countDocuments();
  console.log(`ℹ️  Initial MongoDB user count: ${initialUserCount}`);

  let adminToken = '';
  let employeeToken = '';
  let tempManagerId = null;
  let testEmployeeId = null;
  let originalReportingManager = null;

  try {
    // 1. Authenticate as Admin
    const adminLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@oneplanet.tech', password: 'AdminPassword123!' },
    });
    assert(adminLogin.ok && adminLogin.data?.user?.role === 'Admin', 'Admin login successful with Admin role');
    adminToken = adminLogin.data?.token;

    // 2. Authenticate as Employee
    const empLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: 'employee@oneplanet.tech', password: 'EmployeePassword123!' },
    });
    assert(empLogin.ok && empLogin.data?.user?.role === 'Employee', 'Employee login successful with Employee role');
    employeeToken = empLogin.data?.token;
    testEmployeeId = empLogin.data?.user?._id;
    originalReportingManager = empLogin.data?.user?.reportingManager || null;

    // 3. RBAC: Employee cannot access Manager Management endpoints (403 Forbidden)
    const empGetManagers = await req('/managers', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert(empGetManagers.status === 403, 'RBAC: Employee GET /api/managers returns 403 Forbidden');

    const empPostManager = await req('/managers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: { name: 'Unauthorized Mgr' },
    });
    assert(empPostManager.status === 403, 'RBAC: Employee POST /api/managers returns 403 Forbidden');

    // 4. Security: Unauthenticated request rejected (401 Unauthorized)
    const unauthGet = await req('/managers');
    assert(unauthGet.status === 401, 'Security: Unauthenticated GET /api/managers returns 401 Unauthorized');

    // 5. Admin GET /api/managers returns managers list
    const getManagers = await req('/managers', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getManagers.ok && Array.isArray(getManagers.data?.managers), 'Admin GET /api/managers returns manager list');
    if (getManagers.data?.managers?.length > 0) {
      const first = getManagers.data.managers[0];
      assert(first.directReportsCount !== undefined, `Manager item includes directReportsCount (${first.directReportsCount})`);
    }

    // 6. Admin GET /api/managers/available-employees
    const getAvailable = await req('/managers/available-employees', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getAvailable.ok && Array.isArray(getAvailable.data?.employees), 'GET /api/managers/available-employees returns active employees');

    // 7. Duplicate Validations: Check Duplicate Email
    const dupEmail = await req('/managers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        fullName: 'Duplicate Test',
        email: 'manager@oneplanet.tech',
        employeeId: 'OPT-MGR-9988',
        password: 'Password@123',
        designation: 'Lead',
      },
    });
    assert(dupEmail.status === 400 && dupEmail.data?.message?.toLowerCase().includes('email'), 'Validation: Duplicate email rejected with 400');

    // 8. Duplicate Validations: Check Duplicate Employee ID
    const dupId = await req('/managers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        fullName: 'Duplicate Test',
        email: 'unique_temp_mgr_check@oneplanet.tech',
        employeeId: 'OPT-MGR-001',
        password: 'Password@123',
        designation: 'Lead',
      },
    });
    assert(dupId.status === 400 && dupId.data?.message?.toLowerCase().includes('employee id'), 'Validation: Duplicate employee ID rejected with 400');

    // 9. Create Manager Account
    const createRes = await req('/managers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        fullName: 'Test Temporary Lead',
        email: 'temp_lead_suite_test@oneplanet.tech',
        employeeId: 'OPT-TEST-MGR-999',
        password: 'TempPassword123!',
        designation: 'Senior Technical Lead',
        phone: '+91 9999999999',
        employmentType: 'Full-Time',
        joiningDate: new Date().toISOString(),
      },
    });
    assert(createRes.status === 201 && createRes.data?.manager?._id, 'POST /api/managers creates manager with 201 Created');
    tempManagerId = createRes.data?.manager?._id;

    // 10. View Manager Profile Details (GET /api/managers/:id)
    const getOne = await req(`/managers/${tempManagerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getOne.ok && getOne.data?.manager?.employeeId === 'OPT-TEST-MGR-999', 'GET /api/managers/:id returns manager profile details');
    assert(Array.isArray(getOne.data?.directReports) && getOne.data.directReports.length === 0, 'New manager has 0 direct reports');

    // 11. Edit Manager Details (PUT /api/managers/:id)
    const updateRes = await req(`/managers/${tempManagerId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        designation: 'Principal Engineering Lead',
        phone: '+91 8888888888',
      },
    });
    assert(updateRes.ok && updateRes.data?.manager?.designation === 'Principal Engineering Lead', 'PUT /api/managers/:id updates manager details');

    // 12. Employee-Manager Assignment (POST /api/managers/:id/assign-reports)
    if (testEmployeeId) {
      const assignRes = await req(`/managers/${tempManagerId}/assign-reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          employeeIds: [testEmployeeId],
        },
      });
      assert(assignRes.ok && assignRes.data?.assignedCount === 1, 'Assign direct report to manager returns success');

      // Verify assignment in manager details
      const checkReports = await req(`/managers/${tempManagerId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        checkReports.data?.directReports?.some((r) => r._id === testEmployeeId),
        'Employee immediately reflects in manager directReports list'
      );

      // 13. Reassign Employee back to original manager or unassign (POST /api/managers/:id/reassign-report)
      const reassignRes = await req(`/managers/${tempManagerId}/reassign-report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          employeeId: testEmployeeId,
          newManagerId: originalReportingManager,
        },
      });
      assert(reassignRes.ok, 'Reassign employee report returns success');

      // Verify direct report is removed from temp manager
      const checkReportsAfter = await req(`/managers/${tempManagerId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(checkReportsAfter.data?.directReports?.length === 0, 'Direct report successfully unlinked from temporary manager');
    }

    // 14. Toggle Manager Status (Active -> Inactive -> Active)
    const deactRes = await req(`/managers/${tempManagerId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Inactive' },
    });
    assert(deactRes.ok && deactRes.data?.manager?.status === 'Inactive', 'PATCH /api/managers/:id/status toggles status to Inactive');

    const actRes = await req(`/managers/${tempManagerId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Active' },
    });
    assert(actRes.ok && actRes.data?.manager?.status === 'Active', 'PATCH /api/managers/:id/status reactivates manager');

    // 15. Admin Dashboard Metrics verification
    const dashRes = await req('/dashboard/admin', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      dashRes.ok && typeof dashRes.data?.metrics?.totalManagers === 'number' && typeof dashRes.data?.metrics?.activeManagers === 'number',
      'GET /api/dashboard/admin returns totalManagers and activeManagers counts'
    );
  } finally {
    // CLEANUP GUARANTEE: Ensure zero test records remain in MongoDB
    console.log('\n🧹 Performing full database cleanup of test records...');
    if (tempManagerId) {
      await usersCollection.deleteOne({ _id: new mongoose.Types.ObjectId(tempManagerId) });
      console.log(`   Deleted temporary test manager ${tempManagerId}`);
    }
    if (testEmployeeId) {
      await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(testEmployeeId) },
        { $set: { reportingManager: originalReportingManager ? new mongoose.Types.ObjectId(originalReportingManager) : null } }
      );
      console.log(`   Restored employee ${testEmployeeId} reportingManager to original state`);
    }

    // Clean any audit logs with target OPT-TEST-MGR-999
    const cleanedAudit = await auditLogsCollection.deleteMany({
      $or: [
        { 'details.employeeId': 'OPT-TEST-MGR-999' },
        { targetId: tempManagerId ? new mongoose.Types.ObjectId(tempManagerId) : null },
      ],
    });
    console.log(`   Deleted ${cleanedAudit.deletedCount} temporary audit logs generated during tests`);

    const finalUserCount = await usersCollection.countDocuments();
    console.log(`ℹ️  Final MongoDB user count: ${finalUserCount}`);
    assert(finalUserCount === initialUserCount, `Zero leftover test data verified: user count (${finalUserCount}) matches initial (${initialUserCount})`);

    await mongoose.disconnect();
  }

  console.log('\n========================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runManagerTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
