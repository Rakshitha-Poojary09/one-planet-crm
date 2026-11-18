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
console.log('🧪 RUNNING HEADER NOTIFICATION BELL & LOGOUT SUITE');
console.log('========================================================\n');

// -------------------------------------------------------------------
// 1. FRONTEND UI & WORKFLOW STATIC VERIFICATION
// -------------------------------------------------------------------
console.log('--- 1. Frontend Layout & Component Verification ---');

const mainLayoutPath = join(__dirname, '../frontend/src/layouts/MainLayout.jsx');
const authContextPath = join(__dirname, '../frontend/src/context/AuthContext.jsx');
const serverPath = join(__dirname, 'server.js');
const authRoutesPath = join(__dirname, 'routes/authRoutes.js');
const notificationRoutesPath = join(__dirname, 'routes/notificationRoutes.js');

const mainLayoutContent = readFileSync(mainLayoutPath, 'utf8');
const authContextContent = readFileSync(authContextPath, 'utf8');
const serverContent = readFileSync(serverPath, 'utf8');
const authRoutesContent = readFileSync(authRoutesPath, 'utf8');
const notificationRoutesContent = readFileSync(notificationRoutesPath, 'utf8');

// 1.1 Notification bell is an interactive toggle button, NOT a dead link to /announcements
assert(
  mainLayoutContent.includes('onClick={handleToggleNotificationPanel}') &&
  mainLayoutContent.includes('top-nav-icon-btn'),
  'Notification bell is an interactive button that toggles the live notifications panel'
);
assert(
  !mainLayoutContent.includes('<NavLink to="/announcements" className="top-nav-icon-btn"'),
  'Notification bell is no longer a static NavLink redirecting away from the page'
);

// 1.2 Unread count displayed from MongoDB
assert(
  mainLayoutContent.includes('top-nav-badge-count') &&
  mainLayoutContent.includes('{unreadCount > 99 ? \'99+\' : unreadCount}'),
  'Notification bell dynamically renders the unread badge count from MongoDB'
);
assert(
  mainLayoutContent.includes('{unreadCount > 0 && ('),
  'Unread count badge is hidden when there are 0 unread notifications'
);

// 1.3 Notifications dropdown panel layout
assert(
  mainLayoutContent.includes('showNotificationPanel && (') &&
  mainLayoutContent.includes('Notifications') &&
  mainLayoutContent.includes('notificationPanelRef'),
  'Notifications panel opens as a dedicated dropdown positioned under the bell'
);
assert(
  mainLayoutContent.includes('handleOutsideClick') &&
  mainLayoutContent.includes('notificationPanelRef.current.contains(event.target)'),
  'Notifications panel cleanly closes when clicking outside'
);

// 1.4 Immediate mark as read and count update
assert(
  mainLayoutContent.includes('handleMarkAsRead') &&
  mainLayoutContent.includes('setUnreadCount((prev) => Math.max(0, prev - 1))'),
  'Individual notification mark-as-read updates count immediately in UI'
);
assert(
  mainLayoutContent.includes('handleMarkAllRead') &&
  mainLayoutContent.includes('setUnreadCount(0)'),
  'Mark all as read resets unread count to 0 immediately in UI'
);
assert(
  mainLayoutContent.includes("api.put('/communication/notifications/mark-read'"),
  'Mark as read persists to backend endpoint'
);
assert(
  mainLayoutContent.includes('handleNotificationClick'),
  'Clicking a notification marks it as read and navigates to destination'
);

// 1.5 Header Logout Button & Session Clearing
assert(
  mainLayoutContent.includes('onClick={handleLogout}') &&
  mainLayoutContent.includes('Logout'),
  'Header contains prominent Logout button'
);
assert(
  mainLayoutContent.includes('await logout()') &&
  mainLayoutContent.includes("navigate('/login', { replace: true })"),
  'handleLogout executes logout and redirects to Sign In page (/login)'
);
assert(
  authContextContent.includes("api.post('/auth/logout')") &&
  authContextContent.includes("localStorage.removeItem('opt_token')") &&
  authContextContent.includes("localStorage.removeItem('opt_user')") &&
  authContextContent.includes('sessionStorage.clear()'),
  'AuthContext logout clears all local storage, session storage, and notifies backend'
);

// 1.6 Backend routing setup
assert(
  serverContent.includes('/api/notifications') &&
  serverContent.includes('notificationRoutes'),
  'server.js mounts /api/notifications routes'
);
assert(
  authRoutesContent.includes("router.post('/logout'"),
  'authRoutes.js registers POST /api/auth/logout endpoint'
);
assert(
  notificationRoutesContent.includes("router.get('/', getMyNotifications)") &&
  notificationRoutesContent.includes("router.put('/mark-read', markNotificationsAsRead)"),
  'notificationRoutes.js provides notification listing and mark-read routes'
);

// -------------------------------------------------------------------
// 2. BACKEND & DATABASE FUNCTIONAL VERIFICATION
// -------------------------------------------------------------------
console.log('\n--- 2. Backend & Database Functional Verification ---');

import { User } from './models/User.js';
import { Notification } from './models/Notification.js';
import { AuditLog } from './models/AuditLog.js';
import { getMyNotifications, markNotificationsAsRead } from './controllers/announcementController.js';
import { logout as authLogout } from './controllers/authController.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';

const mockRes = () => {
  let statusCode = 200;
  let responseData = null;
  return {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseData = data;
          return data;
        },
      };
    },
    json: (data) => {
      responseData = data;
      return data;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
};

async function runDatabaseTests() {
  await mongoose.connect(MONGODB_URI);

  const roles = ['Admin', 'Manager', 'Employee'];

  for (const role of roles) {
    console.log(`\nTesting Role: ${role}`);
    const user = await User.findOne({ role });
    assert(!!user, `Found ${role} user in database: ${user?.email}`);

    if (!user) continue;

    // A. Verify Notification Flow in MongoDB
    // Clean any prior test notifications
    await Notification.deleteMany({ recipient: user._id, title: `Test Automated Notification for ${role}` });

    // 1. Create a fresh unread notification in MongoDB
    const testNotif = new Notification({
      recipient: user._id,
      title: `Test Automated Notification for ${role}`,
      message: `Important CRM notification test for ${role} profile.`,
      type: 'System',
      isRead: false,
    });
    await testNotif.save();

    // 2. Fetch notifications via controller (same as GET /api/notifications)
    const reqGet = { user };
    const resGet = mockRes();
    await getMyNotifications(reqGet, resGet);

    assert(resGet.getStatusCode() === 200, `${role}: getMyNotifications returns 200 OK`);
    const fetchedData = resGet.getData();
    assert(fetchedData.success === true, `${role}: Response success is true`);
    assert(fetchedData.unreadCount >= 1, `${role}: unreadCount is >= 1 (actual: ${fetchedData.unreadCount})`);
    const foundTestNotif = fetchedData.notifications.find((n) => n._id.toString() === testNotif._id.toString());
    assert(!!foundTestNotif && foundTestNotif.isRead === false, `${role}: Fetched notifications contains unread test item`);

    // 3. Mark single notification as read
    const reqMarkSingle = { user, body: { id: testNotif._id.toString() } };
    const resMarkSingle = mockRes();
    await markNotificationsAsRead(reqMarkSingle, resMarkSingle);

    assert(resMarkSingle.getStatusCode() === 200, `${role}: markNotificationsAsRead for single item returns 200 OK`);
    const markSingleData = resMarkSingle.getData();
    assert(markSingleData.success === true, `${role}: Single mark-as-read success is true`);

    // Verify in MongoDB directly
    const updatedTestNotif = await Notification.findById(testNotif._id);
    assert(updatedTestNotif.isRead === true, `${role}: Notification isRead is true in MongoDB`);

    // 4. Mark all notifications as read
    const reqMarkAll = { user, body: {} };
    const resMarkAll = mockRes();
    await markNotificationsAsRead(reqMarkAll, resMarkAll);

    assert(resMarkAll.getStatusCode() === 200, `${role}: mark all notifications as read returns 200 OK`);
    const remainingUnread = await Notification.countDocuments({ recipient: user._id, isRead: false });
    assert(remainingUnread === 0, `${role}: All notifications marked as read; unread count in MongoDB is 0`);

    // Clean up test notification
    await Notification.findByIdAndDelete(testNotif._id);

    // B. Verify Logout & Audit Trail
    const reqLogout = {
      user,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Automated Test Client' },
    };
    const resLogout = mockRes();
    await authLogout(reqLogout, resLogout);

    assert(resLogout.getStatusCode() === 200, `${role}: POST /auth/logout returns 200 OK`);
    const logoutData = resLogout.getData();
    assert(logoutData.success === true && logoutData.message.includes('Logged out'), `${role}: Logout response message confirms termination`);

    // Verify AuditLog record in MongoDB
    const auditRecord = await AuditLog.findOne({
      entityId: user._id,
      action: 'USER_LOGOUT',
    }).sort({ timestamp: -1 });

    assert(
      !!auditRecord && auditRecord.changeSummary.includes(user.email),
      `${role}: USER_LOGOUT audit trail written to MongoDB: "${auditRecord?.changeSummary}"`
    );
  }

  await mongoose.disconnect();
}

try {
  await runDatabaseTests();
} catch (err) {
  console.error('Database test exception:', err);
  failed++;
}

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}

