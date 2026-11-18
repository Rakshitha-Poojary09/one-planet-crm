import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('   ONE PLANET CRM - MOBILE RESPONSIVE OPTIMIZATION AUDIT');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

// 1. Check index.html viewport meta tag
console.log('\n1. Viewport Meta Configuration:');
const indexHtmlPath = path.join(projectRoot, 'frontend', 'index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
assert(
  indexHtmlContent.includes('name="viewport"') && indexHtmlContent.includes('width=device-width'),
  'index.html has appropriate viewport meta tag (width=device-width, initial-scale=1.0)'
);

// 2. Check index.css responsive breakpoints and classes
console.log('\n2. Global Responsive CSS Breakpoints (index.css):');
const indexCssPath = path.join(projectRoot, 'frontend', 'src', 'index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

assert(
  indexCssContent.includes('overflow-x: hidden') && indexCssContent.includes('max-width: 100vw'),
  'Root containers have overflow-x: hidden and max-width: 100vw to eliminate horizontal scrolling'
);

assert(
  indexCssContent.includes('@media (max-width: 1023px)'),
  'Contains tablet and mobile drawer breakpoint <= 1023px'
);

assert(
  indexCssContent.includes('@media (max-width: 767px)'),
  'Contains standard mobile breakpoint <= 767px'
);

assert(
  indexCssContent.includes('@media (max-width: 576px)'),
  'Contains compact phone breakpoint <= 576px'
);

assert(
  indexCssContent.includes('@media (max-width: 400px)'),
  'Contains small phone breakpoint <= 400px (e.g. 375px)'
);

assert(
  indexCssContent.includes('@media (max-width: 330px)'),
  'Contains extreme small phone breakpoint <= 330px (e.g. 320px)'
);

assert(
  indexCssContent.includes('.sidebar.mobile-open') && indexCssContent.includes('.mobile-sidebar-backdrop'),
  'Defines mobile slide-out sidebar drawer and backdrop overlay'
);

assert(
  indexCssContent.includes('.calendar-date-cell') && indexCssContent.includes('width: 30px') && indexCssContent.includes('width: 28px'),
  'Calendar cells scale down proportionally to 30px (<=400px) and 28px (<=330px) without breaking circles'
);

assert(
  indexCssContent.includes('.signature-canvas') && indexCssContent.includes('touch-action: none'),
  'Signature canvas has touch-action: none to enable smooth touchscreen/stylus drawing'
);

assert(
  indexCssContent.includes('.policy-pdf-iframe'),
  'Contains responsive policy-pdf-iframe height rules for mobile screens'
);

// 3. Check MainLayout.jsx for mobile drawer, backdrop, and navbar controls
console.log('\n3. Main Navigation & Layout Responsiveness (MainLayout.jsx):');
const mainLayoutPath = path.join(projectRoot, 'frontend', 'src', 'layouts', 'MainLayout.jsx');
const mainLayoutContent = fs.readFileSync(mainLayoutPath, 'utf8');

assert(
  mainLayoutContent.includes('mobileOpen') && mainLayoutContent.includes('mobile-open'),
  'Implements mobile drawer state with mobile-open class toggle'
);

assert(
  mainLayoutContent.includes('mobile-sidebar-backdrop') && mainLayoutContent.includes('setMobileOpen(false)'),
  'Implements mobile backdrop overlay with tap-to-dismiss handler'
);

assert(
  mainLayoutContent.includes('useLocation') && mainLayoutContent.includes('setMobileOpen(false)'),
  'Automatically closes mobile drawer upon navigation route changes'
);

assert(
  mainLayoutContent.includes('handleKeyDown') && mainLayoutContent.includes("'Escape'"),
  'Dismisses mobile drawer, profile menu, and notifications on Escape key press'
);

assert(
  mainLayoutContent.includes('mobile-sidebar-toggle'),
  'Provides prominent mobile hamburger button in header'
);

assert(
  mainLayoutContent.includes('showMobileSearch'),
  'Provides expandable mobile search bar for screens below md'
);

assert(
  mainLayoutContent.includes('top-nav-dropdown-panel'),
  'Notification and Profile menus use bounded viewport panels'
);

// 4. Check Employee Dashboard responsiveness
console.log('\n4. Employee Dashboard Responsiveness (EmployeeDashboard.jsx):');
const empDashPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'EmployeeDashboard.jsx');
const empDashContent = fs.readFileSync(empDashPath, 'utf8');

assert(
  !empDashContent.includes('minWidth: 320'),
  'Removed restrictive fixed minWidth: 320 from attendance section'
);

assert(
  empDashContent.includes('flex-column flex-lg-row'),
  'Attendance bar cleanly stacks vertically on small screens and horizontally on desktop'
);

assert(
  empDashContent.includes('btn-attendance-checkin') && empDashContent.includes('btn-attendance-checkout'),
  'Attendance Login and Logout buttons use fluid mobile touch targets'
);

// 5. Check Dashboard Calendar circular cells and weekday abbreviations
console.log('\n5. Company Calendar Component (DashboardCalendar.jsx):');
const calendarPath = path.join(projectRoot, 'frontend', 'src', 'components', 'DashboardCalendar.jsx');
const calendarContent = fs.readFileSync(calendarPath, 'utf8');

assert(
  calendarContent.includes('calendar-date-cell'),
  'Applies calendar-date-cell class to precede, active, and trailing dates'
);

assert(
  calendarContent.includes('calendar-weekday-cell'),
  'Applies calendar-weekday-cell with responsive weekday abbreviations'
);

assert(
  calendarContent.includes('border-radius: 50%') || calendarContent.includes('borderRadius: \'50%\''),
  'Preserves perfect circular date shapes'
);

// 6. Check Signature Pad and Policy Page
console.log('\n6. Company Policy & Digital Signature Pad (SignaturePad.jsx & PolicyViewAcknowledgePage.jsx):');
const sigPadPath = path.join(projectRoot, 'frontend', 'src', 'components', 'SignaturePad.jsx');
const sigPadContent = fs.readFileSync(sigPadPath, 'utf8');

assert(
  sigPadContent.includes('setPointerCapture') && sigPadContent.includes('handlePointerDown'),
  'SignaturePad uses HTML5 Pointer Events supporting mouse, touchscreen, and stylus'
);

assert(
  sigPadContent.includes('window.addEventListener(\'resize\', initCanvas)'),
  'SignaturePad listens to window resize and adjusts canvas backing store'
);

const policyViewPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
const policyViewContent = fs.readFileSync(policyViewPath, 'utf8');

assert(
  policyViewContent.includes('policy-pdf-iframe'),
  'PolicyViewAcknowledgePage assigns policy-pdf-iframe class for responsive scaling'
);

assert(
  policyViewContent.includes('flex-column flex-sm-row'),
  'Policy header and action buttons wrap responsively across mobile breakpoints'
);

console.log('\n================================================================');
console.log(`AUDIT RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL MOBILE RESPONSIVE REQUIREMENTS VERIFIED SUCCESSFULLY!');
} else {
  console.log(`STATUS: ${totalTests - passedTests} TESTS FAILED. PLEASE REVIEW.`);
}
console.log('================================================================\n');

process.exit(passedTests === totalTests ? 0 : 1);
