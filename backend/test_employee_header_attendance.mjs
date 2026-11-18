import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
console.log('🧪 RUNNING EMPLOYEE DASHBOARD HEADER-STYLE ATTENDANCE BAR TESTS');
console.log('========================================================');

const mainLayoutPath = join(__dirname, '../frontend/src/layouts/MainLayout.jsx');
const indexCssPath = join(__dirname, '../frontend/src/index.css');
const employeeDashboardPath = join(__dirname, '../frontend/src/pages/EmployeeDashboard.jsx');

const mainLayoutContent = readFileSync(mainLayoutPath, 'utf8');
const indexCssContent = readFileSync(indexCssPath, 'utf8');
const employeeDashboardContent = readFileSync(employeeDashboardPath, 'utf8');

// 1. MainLayout does NOT duplicate buttons beside search bar
assert(
  !mainLayoutContent.includes('btn-nav-checkin') && !mainLayoutContent.includes('btn-nav-checkout'),
  'MainLayout does not contain attendance buttons beside the Search CRM field'
);

// 2. Attendance bar is placed prominently at the top of Employee Dashboard, directly below main header
assert(
  employeeDashboardContent.includes("Today's Attendance") &&
  employeeDashboardContent.indexOf("Today's Attendance") < employeeDashboardContent.indexOf('row g-4'),
  'Attendance bar is placed prominently at the top of the Employee Dashboard, directly above the column grid'
);

// 3. Label & Clock Icon
assert(
  employeeDashboardContent.includes("Today's Attendance") && employeeDashboardContent.includes('<FiClock'),
  "Attendance bar contains 'Today\\'s Attendance' label and clock icon"
);

// 4. Current Attendance Status
assert(
  employeeDashboardContent.includes('Active Punch-In Session') &&
  employeeDashboardContent.includes('Completed for Today') &&
  employeeDashboardContent.includes('Not Checked In'),
  'Attendance bar displays current attendance status (Active Punch-In Session, Completed for Today, Not Checked In)'
);

// 5. Punch-in time, punch-out time, and working hours in neat compact layout
assert(
  employeeDashboardContent.includes('PUNCH IN') &&
  employeeDashboardContent.includes('PUNCH OUT') &&
  employeeDashboardContent.includes('WORKING HOURS'),
  'Attendance bar displays Punch In, Punch Out, and Working Hours metrics'
);

// 6. Horizontal Check In & Check Out Controls
assert(
  employeeDashboardContent.includes('btn-attendance-checkin') &&
  employeeDashboardContent.includes('btn-attendance-checkout'),
  'Attendance bar includes Check In and Check Out controls'
);
assert(
  employeeDashboardContent.includes('d-flex align-items-center gap-2 flex-shrink-0'),
  'Check In and Check Out controls are displayed horizontally in the same row'
);

// 7. Professional styling
assert(
  indexCssContent.includes('.btn-attendance-checkin') &&
  (indexCssContent.includes('var(--opt-forest)') || indexCssContent.includes('#0F5132')),
  'Check In uses professional forest-green styling'
);
assert(
  indexCssContent.includes('.btn-attendance-checkout') &&
  indexCssContent.includes('#DC2626') &&
  indexCssContent.includes('#FECACA'),
  'Check Out uses contrasting red outline and text'
);

// 8. Existing APIs used
assert(
  employeeDashboardContent.includes("api.post('/attendance/check-in')"),
  'Check-in uses existing /attendance/check-in endpoint'
);
assert(
  employeeDashboardContent.includes("api.post('/attendance/check-out')"),
  'Check-out uses existing /attendance/check-out endpoint'
);
assert(
  employeeDashboardContent.includes("api.get('/dashboard/employee')"),
  'Attendance data fetched from existing dashboard endpoint'
);

// 9. Prevention of duplicate check-ins and check-outs
assert(
  employeeDashboardContent.includes('disabled={isCheckedIn || actionLoading}'),
  'Check In button is disabled after checking in or while loading'
);
assert(
  employeeDashboardContent.includes('disabled={!isCheckedIn || isCheckedOut || actionLoading}'),
  'Check Out button is disabled before checking in, after checking out, or while loading'
);

// 10. Late arrival notification
assert(
  employeeDashboardContent.includes('Late arrival recorded for today'),
  'Late arrival notification is preserved in a compact notification strip'
);

// 11. Real-time synchronization
assert(
  employeeDashboardContent.includes("window.dispatchEvent(new CustomEvent('attendance-updated'"),
  'EmployeeDashboard dispatches attendance-updated custom event'
);
assert(
  employeeDashboardContent.includes("window.addEventListener('attendance-updated'"),
  'EmployeeDashboard listens for attendance-updated events'
);

console.log('========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}
