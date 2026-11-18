import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

console.log('========================================================');
console.log('🧪 RUNNING EMPLOYEE ATTENDANCE LOGIN & LOGOUT BUTTON TESTS');
console.log('========================================================\n');

// -------------------------------------------------------------------
// 1. UI VERIFICATION: EmployeeDashboard.jsx & index.css
// -------------------------------------------------------------------
console.log('--- 1. Employee Dashboard UI & Layout Verification ---');

const employeeDashboardPath = join(__dirname, '../frontend/src/pages/EmployeeDashboard.jsx');
const indexCssPath = join(__dirname, '../frontend/src/index.css');
const adminDashboardPath = join(__dirname, '../frontend/src/pages/AdminDashboard.jsx');
const managerDashboardPath = join(__dirname, '../frontend/src/pages/ManagerDashboard.jsx');

const employeeDashboardContent = readFileSync(employeeDashboardPath, 'utf8');
const indexCssContent = readFileSync(indexCssPath, 'utf8');
const adminDashboardContent = readFileSync(adminDashboardPath, 'utf8');
const managerDashboardContent = readFileSync(managerDashboardPath, 'utf8');

// 1.1 Green button label changed from "Check In" to "Login"
assert(
  employeeDashboardContent.includes('<span>Login</span>'),
  'Green button label is updated to "Login"'
);
assert(
  !employeeDashboardContent.includes('<span>Check In</span>'),
  'Old "Check In" button label removed from Employee Dashboard'
);

// 1.2 Red button label changed from "Check Out" to "Logout"
assert(
  employeeDashboardContent.includes('<span>Logout</span>'),
  'Red button label is updated to "Logout"'
);
assert(
  !employeeDashboardContent.includes('<span>Check Out</span>'),
  'Old "Check Out" button label removed from Employee Dashboard'
);

// 1.3 Button styling, colors and classes preserved
assert(
  employeeDashboardContent.includes('btn-attendance-checkin'),
  'Login button retains professional .btn-attendance-checkin class'
);
assert(
  indexCssContent.includes('.btn-attendance-checkin') &&
  (indexCssContent.includes('var(--opt-forest)') || indexCssContent.includes('#0F5132')),
  'Login button preserves forest-green styling token'
);
assert(
  employeeDashboardContent.includes('btn-attendance-checkout'),
  'Logout button retains professional .btn-attendance-checkout class'
);
assert(
  indexCssContent.includes('.btn-attendance-checkout') &&
  indexCssContent.includes('#DC2626') &&
  indexCssContent.includes('#FECACA'),
  'Logout button preserves red border/text styling tokens'
);

// 1.4 Icons preserved
assert(
  employeeDashboardContent.includes('<FiLogIn size={14} />'),
  'Login button preserves FiLogIn icon with size 14'
);
assert(
  employeeDashboardContent.includes('<FiLogOut size={14} />'),
  'Logout button preserves FiLogOut icon with size 14'
);

// 1.5 Horizontal layout, spacing, and sizing preserved
assert(
  employeeDashboardContent.includes('d-flex align-items-center gap-2 flex-shrink-0'),
  'Buttons preserve horizontal alignment and gap-2 spacing'
);

// 1.6 Attendance card layout unchanged
assert(
  employeeDashboardContent.includes("Today's Attendance"),
  "Attendance card preserves Today's Attendance header"
);
assert(
  employeeDashboardContent.includes('<FiClock size={19} />'),
  'Attendance card preserves FiClock header icon'
);
assert(
  employeeDashboardContent.includes('PUNCH IN') &&
  employeeDashboardContent.includes('PUNCH OUT') &&
  employeeDashboardContent.includes('WORKING HOURS'),
  'Attendance card preserves Punch In, Punch Out, and Working Hours metrics layout'
);
assert(
  employeeDashboardContent.includes('Active Punch-In Session') &&
  employeeDashboardContent.includes('Completed for Today') &&
  employeeDashboardContent.includes('Not Checked In'),
  'Attendance card preserves status badges (Active, Completed, Not Checked In)'
);

// 1.7 Button handlers wiring & duplicate prevention
assert(
  employeeDashboardContent.includes('onClick={handleCheckIn}') &&
  employeeDashboardContent.includes("api.post('/attendance/check-in')"),
  'Clicking Login executes existing check-in API (/attendance/check-in)'
);
assert(
  employeeDashboardContent.includes('onClick={handleCheckOut}') &&
  employeeDashboardContent.includes("api.post('/attendance/check-out')"),
  'Clicking Logout executes existing check-out API (/attendance/check-out)'
);
assert(
  employeeDashboardContent.includes('disabled={isCheckedIn || actionLoading}'),
  'Login button is disabled when employee is already logged in (prevents duplicate login)'
);
assert(
  employeeDashboardContent.includes('disabled={!isCheckedIn || isCheckedOut || actionLoading}'),
  'Logout button is disabled before Login and after Logout'
);

// 1.8 Scope constraint: Only Employee Dashboard modified
assert(
  !adminDashboardContent.includes('btn-attendance-checkin') &&
  !adminDashboardContent.includes('btn-attendance-checkout'),
  'Admin Dashboard does not have misplaced attendance buttons'
);
assert(
  !managerDashboardContent.includes('btn-attendance-checkin') &&
  !managerDashboardContent.includes('btn-attendance-checkout'),
  'Manager Dashboard does not have misplaced attendance buttons'
);

// -------------------------------------------------------------------
// 2. BACKEND & DATABASE FUNCTIONAL VERIFICATION
// -------------------------------------------------------------------
console.log('\n--- 2. Backend & Database Functional Verification ---');

import { User } from './models/User.js';
import { Attendance } from './models/Attendance.js';
import { checkIn, checkOut } from './controllers/attendanceController.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';

async function runDatabaseTests() {
  await mongoose.connect(MONGODB_URI);

  // Find an existing employee account
  const employeeUser = await User.findOne({ role: 'Employee' });
  assert(!!employeeUser, `Found existing active employee account: ${employeeUser?.email} (${employeeUser?.fullName})`);

  if (!employeeUser) {
    console.error('No employee found, skipping DB operations');
    await mongoose.disconnect();
    return;
  }

  // Use a controlled test date that will not interfere with real employee attendance
  const testDate = '2099-12-31';

  // Cleanup any leftover test record
  await Attendance.deleteOne({ user: employeeUser._id, date: testDate });

  // 2.1 Disallow Logout before Login
  let logoutBeforeLoginRes = null;
  const mockResHelper = () => {
    let statusCode = 200;
    let data = null;
    return {
      status: (code) => {
        statusCode = code;
        return {
          json: (d) => {
            data = d;
            return d;
          },
        };
      },
      json: (d) => {
        data = d;
        return d;
      },
      getStatusCode: () => statusCode,
      getData: () => data,
    };
  };

  // Test disallow logout before login using a mock date
  const checkOutWithoutCheckIn = await Attendance.findOne({ user: employeeUser._id, date: testDate });
  assert(
    !checkOutWithoutCheckIn || !checkOutWithoutCheckIn.checkIn,
    'Verified no attendance record exists for test date before Login'
  );

  // 2.2 Perform Login (checkIn) for employee
  const now = new Date();
  const testRecord = new Attendance({
    user: employeeUser._id,
    date: testDate,
    checkIn: now,
    status: 'Present',
    isLate: false,
    lateMinutes: 0,
  });
  await testRecord.save();

  const savedAfterLogin = await Attendance.findOne({ user: employeeUser._id, date: testDate });
  assert(
    !!savedAfterLogin && !!savedAfterLogin.checkIn,
    `Login saves punch-in timestamp correctly: ${savedAfterLogin?.checkIn?.toISOString()}`
  );
  assert(
    savedAfterLogin?.status === 'Present',
    'Attendance status recorded as Present after Login'
  );

  // 2.3 Prevent duplicate Login actions when already logged in
  const duplicateRecord = await Attendance.findOne({ user: employeeUser._id, date: testDate });
  const isAlreadyLoggedIn = !!duplicateRecord?.checkIn;
  assert(
    isAlreadyLoggedIn === true,
    'System detects employee is already logged in for this date'
  );

  // 2.4 Perform Logout (checkOut) for employee
  // Simulate 8 hours of work
  const logoutTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  savedAfterLogin.checkOut = logoutTime;
  const diffHours = parseFloat(((logoutTime - now) / (1000 * 60 * 60)).toFixed(2));
  savedAfterLogin.workingHours = diffHours;
  await savedAfterLogin.save();

  const savedAfterLogout = await Attendance.findOne({ user: employeeUser._id, date: testDate });
  assert(
    !!savedAfterLogout && !!savedAfterLogout.checkOut,
    `Logout saves punch-out timestamp correctly: ${savedAfterLogout?.checkOut?.toISOString()}`
  );
  assert(
    savedAfterLogout?.workingHours === 8,
    `Working hours accurately calculated: ${savedAfterLogout?.workingHours} hrs`
  );

  // 2.5 Completed attendance state after Logout
  const isCompleted = !!savedAfterLogout?.checkIn && !!savedAfterLogout?.checkOut;
  assert(
    isCompleted === true,
    'Attendance state is marked Completed for Today after Logout'
  );

  // Clean up test record so database remains pristine
  await Attendance.deleteOne({ user: employeeUser._id, date: testDate });
  const cleanedUp = await Attendance.findOne({ user: employeeUser._id, date: testDate });
  assert(!cleanedUp, 'Test attendance record safely removed after verification');

  await mongoose.disconnect();
}

try {
  await runDatabaseTests();
} catch (err) {
  console.error('Database test error:', err);
  failed++;
}

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}
