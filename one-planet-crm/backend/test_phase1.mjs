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

async function runPhase1Tests() {
  console.log('========================================================');
  console.log('🧪 RUNNING PHASE 1 AUTOMATED TESTS (Node Fetch)');
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

  // 1. Health check
  try {
    const res = await req('/health');
    assert(res.ok && res.data?.status === 'ok', 'Server health check returned 200 OK');
  } catch (e) {
    assert(false, `Health check failed: ${e.message}`);
  }

  // 2. Authentication: Admin Login
  let adminToken = '';
  let adminUser = null;
  try {
    const res = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@oneplanet.tech', password: 'AdminPassword123!' },
    });
    assert(res.ok && res.data?.user?.role === 'Admin', 'Admin login successful and role is Admin');
    adminToken = res.data.token;
    adminUser = res.data.user;
  } catch (e) {
    assert(false, `Admin login failed: ${e.message}`);
  }

  // 3. Authentication: Manager Login
  let managerToken = '';
  try {
    const res = await req('/auth/login', {
      method: 'POST',
      body: { email: 'manager@oneplanet.tech', password: 'ManagerPassword123!' },
    });
    assert(res.ok && res.data?.user?.role === 'Manager', 'Manager login successful and role is Manager');
    managerToken = res.data.token;
  } catch (e) {
    assert(false, `Manager login failed: ${e.message}`);
  }

  // 4. Authentication: Employee Login
  let employeeToken = '';
  let employeeUser = null;
  try {
    const res = await req('/auth/login', {
      method: 'POST',
      body: { email: 'employee@oneplanet.tech', password: 'EmployeePassword123!' },
    });
    assert(res.ok && res.data?.user?.role === 'Employee', 'Employee login successful and role is Employee');
    employeeToken = res.data.token;
    employeeUser = res.data.user;
  } catch (e) {
    assert(false, `Employee login failed: ${e.message}`);
  }

  // 5. Auth /me endpoint verification
  try {
    const res = await req('/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.ok && res.data?.user?.email === 'admin@oneplanet.tech', '/auth/me returns populated admin user');
  } catch (e) {
    assert(false, `/auth/me failed: ${e.message}`);
  }

  // 6. Security & Privilege Escalation Prevention
  // Employee tries to make themselves Admin
  try {
    await req(`/users/${employeeUser._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: { role: 'Admin' },
    });
    const check = await req(`/users/${employeeUser._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(check.data?.user?.role === 'Employee', 'Privilege Escalation Blocked: Employee role remains Employee');
  } catch (e) {
    assert(false, `Privilege escalation test failed: ${e.message}`);
  }

  // Manager tries to edit another user's role to Admin
  try {
    const res = await req(`/users/${employeeUser._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { role: 'Admin' },
    });
    assert(res.status === 403, 'Privilege Escalation Blocked: Manager received 403 Forbidden editing another user');
  } catch (e) {
    assert(false, `Manager escalation test failed: ${e.message}`);
  }

  // 7. Employee Management: Creation
  let createdUserId = '';
  const testEmail = `test.emp.${Date.now()}@oneplanet.tech`;
  try {
    const res = await req('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        fullName: 'Vikram Joshi',
        email: testEmail,
        password: 'TempPassword123!',
        role: 'Employee',
        designation: 'QA Automation Engineer',
        employmentType: 'Full-Time',
        phone: '+91 91234 56789',
        joiningDate: '2026-01-15',
        address: 'Cyber City, Gurugram',
        shiftTiming: { startTime: '10:00', endTime: '19:00', graceMinutes: 20 },
        weeklyOff: ['Saturday', 'Sunday'],
        emergencyContact: { name: 'Kavita Joshi', relationship: 'Spouse', phone: '+91 91234 00000' },
        documents: [{ name: 'Offer Letter', fileUrl: 'https://docs.oneplanet.tech/offer-vj.pdf' }],
      },
    });
    assert(res.ok && res.data?.user?.employeeId, `Employee created with ID: ${res.data?.user?.employeeId}`);
    createdUserId = res.data?.user?._id;
  } catch (e) {
    assert(false, `Employee creation failed: ${e.message}`);
  }

  // 8. Employee Directory Search & Filter
  try {
    const res = await req('/users?search=Vikram', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.ok && res.data?.users?.some((u) => u.fullName === 'Vikram Joshi'), 'Search by name found newly created employee');
  } catch (e) {
    assert(false, `User search failed: ${e.message}`);
  }

  // 9. Employee Update (Admin)
  try {
    const res = await req(`/users/${createdUserId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { designation: 'Senior QA Automation Lead' },
    });
    assert(res.ok && res.data?.user?.designation === 'Senior QA Automation Lead', 'Admin updated employee designation');
  } catch (e) {
    assert(false, `Employee update failed: ${e.message}`);
  }

  // 10. Status Toggle / Deactivation
  try {
    const res = await req(`/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Inactive' },
    });
    assert(res.ok && res.data?.user?.employmentStatus === 'Inactive', 'Employee status changed to Inactive');
  } catch (e) {
    assert(false, `Employee deactivation failed: ${e.message}`);
  }

  // Try to log in with Inactive account -> Expect 403
  try {
    const res = await req('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'TempPassword123!' },
    });
    assert(res.status === 403, 'Deactivated account blocked at login with 403 Forbidden');
  } catch (e) {
    assert(false, `Deactivated account test failed: ${e.message}`);
  }

  // 11. Admin Lockout Prevention
  // Try to deactivate sole Admin
  try {
    const res = await req(`/users/${adminUser._id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'Inactive' },
    });
    assert(res.status === 400, 'Admin Lockout Prevention: Blocked deactivating sole Admin');
  } catch (e) {
    assert(false, `Admin lockout prevention failed: ${e.message}`);
  }

  // 12. Admin Dashboard Metrics API
  try {
    const res = await req('/dashboard/admin', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.ok === true, 'Admin dashboard API returned 200 OK');
    assert(typeof res.data?.metrics?.totalEmployees === 'number', 'Total active employees metric is computed');
    assert(Array.isArray(res.data?.projectsWithProgress), 'Projects with progress returned in dashboard');
    assert(typeof res.data?.metrics?.taskCompletionRate === 'number', 'Task completion rate computed');
    assert(Array.isArray(res.data?.recentAnnouncements), 'Recent announcements returned');
    assert(Array.isArray(res.data?.weeklyTrend), 'Weekly attendance trend returned');
  } catch (e) {
    assert(false, `Admin dashboard metrics failed: ${e.message}`);
  }

  // Clean up test employee from DB
  if (createdUserId) {
    try {
      const { connectDB } = await import('./config/db.js');
      const mongoose = (await import('mongoose')).default;
      const dotenv = (await import('dotenv')).default;
      dotenv.config();
      await connectDB();
      await mongoose.connection.db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(createdUserId) });
      console.log('🧹 Cleaned up temporary test employee from database.');
      await mongoose.disconnect();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }

  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runPhase1Tests().catch((e) => {
  console.error('Test script crashed:', e);
  process.exit(1);
});
