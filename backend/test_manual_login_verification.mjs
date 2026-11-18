import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runManualLoginVerification() {
  console.log('====================================================');
  console.log('🔍 MANUAL LOGIN & DASHBOARD VERIFICATION SUITE');
  console.log('====================================================\n');

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

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';
  await mongoose.connect(MONGODB_URI);

  // Mount real application Express server
  const app = express();
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // Import routes
  const authRoutes = (await import('./routes/authRoutes.js')).default;
  const dashboardRoutes = (await import('./routes/dashboardRoutes.js')).default;
  const calendarRoutes = (await import('./routes/calendarRoutes.js')).default;
  const attendanceRoutes = (await import('./routes/attendanceRoutes.js')).default;
  const leaveRoutes = (await import('./routes/leaveRoutes.js')).default;
  const policyRoutes = (await import('./routes/policyRoutes.js')).default;
  const notificationRoutes = (await import('./routes/notificationRoutes.js')).default;
  const userRoutes = (await import('./routes/userRoutes.js')).default;

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/policies', policyRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/users', userRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const API_BASE = `http://127.0.0.1:${port}/api`;

  async function apiPost(endpoint, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  async function apiGet(endpoint, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  // -------------------------------------------------------------
  // TEST 1: Admin Login with Existing Credentials
  // -------------------------------------------------------------
  console.log('\n--- 1. Verifying Admin Login ---');
  let adminToken = null;
  let adminUser = null;
  const adminRes = await apiPost('/auth/login', {
    email: 'admin@oneplanet.tech',
    password: 'AdminPassword123!',
  });

  assert(adminRes.status === 200, 'Admin login returned HTTP 200 OK');
  assert(adminRes.data?.success === true, 'Admin login response success is true');
  assert(Boolean(adminRes.data?.token), 'Admin login returned valid JWT token');
  assert(adminRes.data?.user?.role === 'Admin', 'Admin user role is "Admin"');
  assert(adminRes.data?.user?.email === 'admin@oneplanet.tech', 'Admin email matches admin@oneplanet.tech');
  adminToken = adminRes.data?.token;
  adminUser = adminRes.data?.user;

  // -------------------------------------------------------------
  // TEST 2: Manager Login with Existing Credentials
  // -------------------------------------------------------------
  console.log('\n--- 2. Verifying Manager Login ---');
  let managerToken = null;
  let managerUser = null;
  const managerRes = await apiPost('/auth/login', {
    email: 'manager@oneplanet.tech',
    password: 'ManagerPassword123!',
  });

  assert(managerRes.status === 200, 'Manager login returned HTTP 200 OK');
  assert(managerRes.data?.success === true, 'Manager login response success is true');
  assert(Boolean(managerRes.data?.token), 'Manager login returned valid JWT token');
  assert(managerRes.data?.user?.role === 'Manager', 'Manager user role is "Manager"');
  assert(managerRes.data?.user?.email === 'manager@oneplanet.tech', 'Manager email matches manager@oneplanet.tech');
  managerToken = managerRes.data?.token;
  managerUser = managerRes.data?.user;

  // -------------------------------------------------------------
  // TEST 3: Employee Login with Existing Credentials
  // -------------------------------------------------------------
  console.log('\n--- 3. Verifying Employee Login ---');
  let employeeToken = null;
  let employeeUser = null;
  const employeeRes = await apiPost('/auth/login', {
    email: 'rakshithapoojary560@gmail.com',
    password: 'Rakshitha',
  });

  assert(employeeRes.status === 200, 'Employee (Rakshitha) login returned HTTP 200 OK');
  assert(employeeRes.data?.success === true, 'Employee login response success is true');
  assert(Boolean(employeeRes.data?.token), 'Employee login returned valid JWT token');
  assert(employeeRes.data?.user?.role === 'Employee', 'Employee user role is "Employee"');
  assert(employeeRes.data?.user?.email === 'rakshithapoojary560@gmail.com', 'Employee email verified');
  employeeToken = employeeRes.data?.token;
  employeeUser = employeeRes.data?.user;

  // Also verify alternate employee Kritika
  const employee2Res = await apiPost('/auth/login', {
    email: 'kriti@oneplanet.tech',
    password: 'Kritika',
  });
  assert(employee2Res.status === 200, 'Employee (Kritika) login returned HTTP 200 OK');
  assert(employee2Res.data?.user?.role === 'Employee', 'Employee (Kritika) user role is "Employee"');

  // -------------------------------------------------------------
  // TEST 4: Role-Based Redirect Verification
  // -------------------------------------------------------------
  console.log('\n--- 4. Verifying Role-Based Redirections ---');
  function getRedirectDestination(role) {
    if (role === 'Admin') return '/admin/dashboard';
    if (role === 'Manager') return '/manager/dashboard';
    return '/employee/dashboard';
  }

  assert(getRedirectDestination(adminUser.role) === '/admin/dashboard', 'Admin redirects to /admin/dashboard');
  assert(getRedirectDestination(managerUser.role) === '/manager/dashboard', 'Manager redirects to /manager/dashboard');
  assert(getRedirectDestination(employeeUser.role) === '/employee/dashboard', 'Employee redirects to /employee/dashboard');

  // Verify Login.jsx contains the exact role redirect logic
  const loginJsxContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/pages/Login.jsx'), 'utf8');
  assert(loginJsxContent.includes("if (res.data.user.role === 'Admin') {\n          navigate('/admin/dashboard');"), 'Login.jsx redirects Admin to /admin/dashboard');
  assert(loginJsxContent.includes("navigate('/manager/dashboard');"), 'Login.jsx redirects Manager to /manager/dashboard');
  assert(loginJsxContent.includes("navigate('/employee/dashboard');"), 'Login.jsx redirects Employee to /employee/dashboard');

  // -------------------------------------------------------------
  // TEST 5: Invalid Credentials Handling
  // -------------------------------------------------------------
  console.log('\n--- 5. Verifying Invalid Credentials Handling ---');
  const wrongPassRes = await apiPost('/auth/login', {
    email: 'admin@oneplanet.tech',
    password: 'IncorrectPassword!',
  });
  assert(wrongPassRes.status === 401, 'Wrong password returns HTTP 401 Unauthorized');
  assert(wrongPassRes.data?.success === false, 'Response indicates success: false');
  assert(wrongPassRes.data?.message?.toLowerCase().includes('invalid'), 'Error message states "Invalid email or password"');

  const wrongEmailRes = await apiPost('/auth/login', {
    email: 'nonexistent_user@oneplanet.tech',
    password: 'AnyPassword123!',
  });
  assert(wrongEmailRes.status === 401, 'Non-existent email returns HTTP 401 Unauthorized');
  assert(wrongEmailRes.data?.success === false, 'Response indicates success: false');
  assert(wrongEmailRes.data?.message?.toLowerCase().includes('invalid'), 'Non-existent email error message states "Invalid email or password"');

  const emptyRes = await apiPost('/auth/login', {
    email: '',
    password: '',
  });
  assert(emptyRes.status === 400, 'Empty email/password returns HTTP 400 Bad Request');
  assert(emptyRes.data?.message?.includes('Please provide both email and password'), 'Empty submission returns validation requirement');

  // -------------------------------------------------------------
  // TEST 6: Password Visibility Toggle Audit
  // -------------------------------------------------------------
  console.log('\n--- 6. Verifying Password Visibility Toggle Functionality ---');
  assert(loginJsxContent.includes('const [showPassword, setShowPassword] = useState(false);'), 'Password toggle state initialized to false');
  assert(loginJsxContent.includes("type={showPassword ? 'text' : 'password'}"), 'Input type dynamically toggles text/password');
  assert(loginJsxContent.includes('onClick={() => setShowPassword(!showPassword)}'), 'Toggle button flips showPassword state');
  assert(loginJsxContent.includes('{showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}'), 'Icon switches between FiEyeOff and FiEye');
  assert(loginJsxContent.includes('className="login-toggle-btn"'), 'Toggle button styled with login-toggle-btn');

  // -------------------------------------------------------------
  // TEST 7: Confirm No Demo Autofill or Credentials Remain
  // -------------------------------------------------------------
  console.log('\n--- 7. Confirming No Demo Autofill or Hardcoded Credentials in UI ---');
  assert(!loginJsxContent.includes('Quick Demo'), 'No "Quick Demo" text anywhere in Login.jsx');
  assert(!loginJsxContent.includes('1-Click Autofill'), 'No "1-Click Autofill" option anywhere in Login.jsx');
  assert(!loginJsxContent.includes('handleQuickDemoFill'), 'No demo autofill function exists in Login.jsx');
  assert(!loginJsxContent.includes('AdminPassword123!'), 'No hardcoded Admin password in Login.jsx');
  assert(!loginJsxContent.includes('ManagerPassword123!'), 'No hardcoded Manager password in Login.jsx');
  assert(!loginJsxContent.includes('EmployeePassword123!'), 'No hardcoded Employee password in Login.jsx');
  assert(!loginJsxContent.includes('login-demo-card'), 'No demo card class in Login.jsx');
  assert(!loginJsxContent.includes('login-demo-pill'), 'No demo pill buttons in Login.jsx');

  // -------------------------------------------------------------
  // TEST 8: Dashboard Data Loading After Login
  // -------------------------------------------------------------
  console.log('\n--- 8. Verifying Dashboard Data Loading for Each Role ---');
  
  // 8A. Admin Dashboard Data
  const adminDashboard = await apiGet('/dashboard/admin', adminToken);
  assert(adminDashboard.status === 200, 'Admin Dashboard: /api/dashboard/admin returns 200 OK');
  assert(adminDashboard.data?.success === true, 'Admin Dashboard data success is true');
  assert(Boolean(adminDashboard.data?.metrics), 'Admin Dashboard metrics payload exists');

  const adminCalendar = await apiGet('/calendar/data?year=2026&month=11', adminToken);
  assert(adminCalendar.status === 200, 'Admin Dashboard: /api/calendar/data returns 200 OK');
  assert(adminCalendar.data?.success === true, 'Admin Calendar data loaded successfully');

  const adminUsers = await apiGet('/users', adminToken);
  assert(adminUsers.status === 200, 'Admin Dashboard: /api/users returns 200 OK');

  // 8B. Manager Dashboard Data
  const managerDashboard = await apiGet('/dashboard/manager', managerToken);
  assert(managerDashboard.status === 200, 'Manager Dashboard: /api/dashboard/manager returns 200 OK');
  assert(managerDashboard.data?.success === true, 'Manager Dashboard data success is true');
  assert(Boolean(managerDashboard.data?.metrics), 'Manager Dashboard metrics payload exists');

  const managerCalendar = await apiGet('/calendar/data?year=2026&month=11', managerToken);
  assert(managerCalendar.status === 200, 'Manager Dashboard: /api/calendar/data returns 200 OK');

  const managerLeaves = await apiGet('/leaves/balances', managerToken);
  assert(managerLeaves.status === 200, 'Manager Dashboard: /api/leaves/balances returns 200 OK');

  // 8C. Employee Dashboard Data
  const empDashboard = await apiGet('/dashboard/employee', employeeToken);
  assert(empDashboard.status === 200, 'Employee Dashboard: /api/dashboard/employee returns 200 OK');
  assert(empDashboard.data?.success === true, 'Employee Dashboard data success is true');
  assert(Boolean(empDashboard.data?.monthSummary), 'Employee Dashboard monthSummary state loaded');

  const empCalendar = await apiGet('/calendar/data?year=2026&month=11', employeeToken);
  assert(empCalendar.status === 200, 'Employee Dashboard: /api/calendar/data returns 200 OK');

  const empSummary = await apiGet('/leaves/accrual-summary', employeeToken);
  assert(empSummary.status === 200, 'Employee Dashboard: /api/leaves/accrual-summary returns 200 OK');

  const empPolicies = await apiGet('/policies', employeeToken);
  assert(empPolicies.status === 200, 'Employee Dashboard: /api/policies returns 200 OK');

  // Close server and DB
  server.close();
  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`🏁 MANUAL VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runManualLoginVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
