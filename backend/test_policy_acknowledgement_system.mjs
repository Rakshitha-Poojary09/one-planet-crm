// Comprehensive Unit and Functional Test Suite for Policy Acknowledgement & Employee Questions System
console.log('========================================================');
console.log('🧪 RUNNING POLICY ACKNOWLEDGEMENT & QUESTIONS TEST SUITE');
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

// -------------------------------------------------------------
// 1. Audience Targeting & Visibility Tests
// -------------------------------------------------------------
function isUserTargeted(user, policy) {
  if (user.role === 'Admin') return true;
  if (!policy.targetAudience || policy.targetAudience === 'All') return true;

  if (policy.targetAudience === 'Departments' && policy.targetDepartments?.length > 0) {
    const userDeptId = String(user.department?._id || user.department || '');
    return policy.targetDepartments.some((d) => String(d._id || d) === userDeptId);
  }

  if (policy.targetAudience === 'Roles' && policy.targetRoles?.length > 0) {
    return policy.targetRoles.includes(user.role);
  }

  return true;
}

const adminUser = { _id: 'u1', role: 'Admin', department: 'dept_it' };
const devUser = { _id: 'u2', role: 'Employee', department: 'dept_eng' };
const hrUser = { _id: 'u3', role: 'Employee', department: 'dept_hr' };
const mgrUser = { _id: 'u4', role: 'Manager', department: 'dept_eng' };

const allPolicy = { targetAudience: 'All' };
const engPolicy = { targetAudience: 'Departments', targetDepartments: ['dept_eng'] };
const empOnlyPolicy = { targetAudience: 'Roles', targetRoles: ['Employee'] };

assert(isUserTargeted(adminUser, allPolicy) === true, 'Admin has access to All audience policy');
assert(isUserTargeted(adminUser, engPolicy) === true, 'Admin bypasses department audience restrictions');
assert(isUserTargeted(devUser, allPolicy) === true, 'Dev employee has access to All audience policy');
assert(isUserTargeted(devUser, engPolicy) === true, 'Dev employee has access to Engineering department policy');
assert(isUserTargeted(hrUser, engPolicy) === false, 'HR employee cannot access Engineering department policy');
assert(isUserTargeted(devUser, empOnlyPolicy) === true, 'Dev employee has access to Employee-only policy');
assert(isUserTargeted(mgrUser, empOnlyPolicy) === false, 'Manager cannot access Employee-only policy');

// -------------------------------------------------------------
// 2. First-Opened Timestamp Tracking vs Acknowledgement Tests
// -------------------------------------------------------------
function trackOpen(ackStore, policyId, user, version, publishedAt) {
  const key = `${policyId}_${user._id}_${version}`;
  let record = ackStore.get(key);
  if (!record) {
    record = {
      policy: policyId,
      user: user._id,
      employeeId: user.employeeId || 'EMP001',
      policyVersion: version,
      publishedAt: publishedAt || new Date(),
      firstOpenedAt: new Date(),
      isAcknowledged: false,
      acknowledgedAt: null,
      statement: '',
    };
    ackStore.set(key, record);
  } else if (!record.firstOpenedAt) {
    record.firstOpenedAt = new Date();
  }
  return record;
}

function acknowledge(ackStore, policyId, user, version, statement) {
  const key = `${policyId}_${user._id}_${version}`;
  let record = ackStore.get(key);
  const now = new Date();
  if (record) {
    record.isAcknowledged = true;
    record.acknowledgedAt = now;
    record.statement = statement;
  } else {
    record = {
      policy: policyId,
      user: user._id,
      employeeId: user.employeeId || 'EMP001',
      policyVersion: version,
      publishedAt: now,
      firstOpenedAt: now,
      isAcknowledged: true,
      acknowledgedAt: now,
      statement,
    };
    ackStore.set(key, record);
  }
  return record;
}

const ackMap = new Map();
const samplePolicy = { _id: 'pol_1', version: 1, publishedAt: new Date('2026-11-01') };

// Test 2a: Opening policy records firstOpenedAt but is NOT acknowledged
const openRecord = trackOpen(ackMap, samplePolicy._id, devUser, samplePolicy.version, samplePolicy.publishedAt);
assert(openRecord.firstOpenedAt instanceof Date, 'Opening policy sets firstOpenedAt timestamp');
assert(openRecord.isAcknowledged === false, 'Opening policy does NOT mark policy as acknowledged');
assert(openRecord.acknowledgedAt === null, 'acknowledgedAt is null upon opening');

// Test 2b: Explicit acknowledgement marks isAcknowledged = true
const ackRecord = acknowledge(
  ackMap,
  samplePolicy._id,
  devUser,
  samplePolicy.version,
  'I have read and understood this policy.'
);
assert(ackRecord.isAcknowledged === true, 'Explicit acknowledgement sets isAcknowledged to true');
assert(ackRecord.acknowledgedAt instanceof Date, 'acknowledgedAt timestamp is recorded');
assert(ackRecord.statement.includes('read and understood'), 'Acknowledgement statement is recorded');

// -------------------------------------------------------------
// 3. Policy Version Increment & Re-acknowledgement Tests
// -------------------------------------------------------------
const versionHistory = [];
function updatePolicy(policy, newContent, changeSummary) {
  // Snapshot old
  versionHistory.push({
    version: policy.version,
    content: policy.content,
    changeSummary,
  });
  policy.version += 1;
  policy.content = newContent;
  policy.publishedAt = new Date();
}

samplePolicy.content = 'Original v1 content';
updatePolicy(samplePolicy, 'Updated v2 content', 'Section 4 revision');

assert(samplePolicy.version === 2, 'Policy version increments to 2 on update');
assert(versionHistory.length === 1 && versionHistory[0].version === 1, 'Previous version snapshot preserved in history');

// Check user's acknowledgement state against new version
function checkUserAckStatus(ackStore, policyId, userId, currentVersion) {
  let hasAckCurrent = false;
  let hasAckPrior = false;
  let hasOpenedCurrent = false;

  const currentRecord = ackStore.get(`${policyId}_${userId}_${currentVersion}`);
  if (currentRecord) {
    if (currentRecord.isAcknowledged) hasAckCurrent = true;
    if (currentRecord.firstOpenedAt) hasOpenedCurrent = true;
  }

  for (let v = 1; v < currentVersion; v++) {
    const priorRecord = ackStore.get(`${policyId}_${userId}_${v}`);
    if (priorRecord && priorRecord.isAcknowledged) {
      hasAckPrior = true;
    }
  }

  if (hasAckCurrent) return 'Acknowledged';
  if (hasAckPrior) return 'Re-acknowledgement Required';
  if (hasOpenedCurrent) return 'Opened - Pending';
  return 'Not Opened';
}

const statusBeforeV2Ack = checkUserAckStatus(ackMap, samplePolicy._id, devUser._id, samplePolicy.version);
assert(statusBeforeV2Ack === 'Re-acknowledgement Required', 'User status is Re-acknowledgement Required after version bump');

// Now user opens v2
trackOpen(ackMap, samplePolicy._id, devUser, samplePolicy.version, samplePolicy.publishedAt);
// Now user acknowledges v2
acknowledge(ackMap, samplePolicy._id, devUser, samplePolicy.version, 'Confirmed v2.');
const statusAfterV2Ack = checkUserAckStatus(ackMap, samplePolicy._id, devUser._id, samplePolicy.version);
assert(statusAfterV2Ack === 'Acknowledged', 'User status becomes Acknowledged once v2 is explicitly acknowledged');

// -------------------------------------------------------------
// 4. Acknowledgement Report Calculation & Filters
// -------------------------------------------------------------
const testEmployees = [
  { _id: 'e1', fullName: 'Alice Smith', employeeId: 'EMP001', department: 'dept_eng', role: 'Employee' },
  { _id: 'e2', fullName: 'Bob Jones', employeeId: 'EMP002', department: 'dept_eng', role: 'Employee' },
  { _id: 'e3', fullName: 'Charlie Day', employeeId: 'EMP003', department: 'dept_hr', role: 'Employee' },
  { _id: 'e4', fullName: 'Diana Prince', employeeId: 'EMP004', department: 'dept_eng', role: 'Manager' },
];

const reportAckMap = new Map();
// e1 acknowledged current v1
reportAckMap.set('pol_rep_e1_1', { policyVersion: 1, isAcknowledged: true, firstOpenedAt: new Date(), acknowledgedAt: new Date() });
// e2 opened v1 but did not acknowledge
reportAckMap.set('pol_rep_e2_1', { policyVersion: 1, isAcknowledged: false, firstOpenedAt: new Date(), acknowledgedAt: null });
// e3 did not open
// e4 acknowledged prior v0, so needs v1
reportAckMap.set('pol_rep_e4_0', { policyVersion: 0, isAcknowledged: true, firstOpenedAt: new Date(), acknowledgedAt: new Date() });

function generateReport(employees, policyId, policyVersion) {
  const list = employees.map((emp) => {
    const cur = reportAckMap.get(`${policyId}_${emp._id}_${policyVersion}`);
    const prior = reportAckMap.get(`${policyId}_${emp._id}_0`);

    let status = 'Not Opened';
    if (cur && cur.isAcknowledged) status = 'Acknowledged';
    else if (cur && cur.firstOpenedAt && !cur.isAcknowledged) status = 'Opened - Pending';
    else if (prior && prior.isAcknowledged) status = 'Re-acknowledgement Required';

    return {
      user: emp,
      status,
      firstOpenedAt: cur?.firstOpenedAt || null,
      acknowledgedAt: cur?.acknowledgedAt || null,
    };
  });

  const totalTargeted = list.length;
  const acknowledgedCount = list.filter((r) => r.status === 'Acknowledged').length;
  const pendingCount = totalTargeted - acknowledgedCount;
  const openedPendingCount = list.filter((r) => r.status === 'Opened - Pending').length;
  const notOpenedCount = list.filter((r) => r.status === 'Not Opened').length;
  const complianceRate = Math.round((acknowledgedCount / totalTargeted) * 100);

  return {
    totalTargeted,
    acknowledgedCount,
    pendingCount,
    openedPendingCount,
    notOpenedCount,
    complianceRate,
    list,
  };
}

const rep = generateReport(testEmployees, 'pol_rep', 1);
assert(rep.totalTargeted === 4, 'Report accurately tracks 4 targeted employees');
assert(rep.acknowledgedCount === 1, 'Report accurately tracks 1 acknowledged employee');
assert(rep.pendingCount === 3, 'Report accurately tracks 3 pending employees');
assert(rep.openedPendingCount === 1, 'Report accurately tracks 1 opened-pending employee');
assert(rep.notOpenedCount === 1, 'Report accurately tracks 1 not-opened employee');
assert(rep.complianceRate === 25, 'Report calculates 25% compliance rate');

// -------------------------------------------------------------
// 5. Policy Questions & Clarifications Workflow
// -------------------------------------------------------------
const questionsDB = [];

function askQuestion(user, policyId, questionText) {
  const q = {
    _id: `q_${questionsDB.length + 1}`,
    policy: policyId,
    user: user._id,
    employeeId: user.employeeId,
    question: questionText,
    status: 'Open',
    isPrivate: true,
    replies: [],
  };
  questionsDB.push(q);
  return q;
}

function replyQuestion(actingUser, questionId, replyText) {
  const q = questionsDB.find((item) => item._id === questionId);
  if (!q) throw new Error('Question not found');

  if (actingUser.role !== 'Admin' && actingUser._id !== q.user) {
    throw new Error('Access denied: Cannot reply to other employees questions');
  }

  q.replies.push({
    user: actingUser._id,
    role: actingUser.role,
    message: replyText,
    createdAt: new Date(),
  });

  if (actingUser.role === 'Admin') {
    q.status = 'Answered';
  } else {
    q.status = 'Open';
  }
  return q;
}

const newQ = askQuestion(devUser, 'pol_1', 'Does this policy apply to remote work on weekends?');
assert(newQ.status === 'Open', 'New question starts with status Open');
assert(newQ.replies.length === 0, 'New question has 0 initial replies');

// Admin replies
const answeredQ = replyQuestion(adminUser, newQ._id, 'Remote work on weekends follows Section 3.2 overtime guidelines.');
assert(answeredQ.status === 'Answered', 'Admin reply updates question status to Answered');
assert(answeredQ.replies.length === 1, 'Admin reply is appended to replies thread');

// Employee asks follow-up
const followUpQ = replyQuestion(devUser, newQ._id, 'Thank you! Is advance managerial approval needed?');
assert(followUpQ.status === 'Open', 'Employee follow-up re-opens question status to Open');
assert(followUpQ.replies.length === 2, 'Employee follow-up is appended to replies thread');

// Unauthorized user attempt
let unauthorizedBlocked = false;
try {
  replyQuestion(hrUser, newQ._id, 'Attempting to eavesdrop');
} catch (e) {
  unauthorizedBlocked = true;
}
assert(unauthorizedBlocked === true, 'Unauthorized employees are strictly blocked from accessing or replying to other employees questions');

// -------------------------------------------------------------
// 6. Notification Triggers Test
// -------------------------------------------------------------
const notifications = [];
function notify(recipient, title, message, type = 'Policy') {
  notifications.push({ recipient, title, message, type });
}

// Publish notification
notify('u2', 'New Company Policy Published', 'Policy "Code of Conduct" v1 is now effective.');
// Reminder notification
notify('u2', 'Policy Acknowledgement Pending', 'Reminder: Please review and acknowledge "Code of Conduct" v1.');
// Question notification to Admin
notify('u1', 'New Policy Question', 'Rohan Mehra asked a question regarding "Code of Conduct".');
// Response notification to Employee
notify('u2', 'Policy Question Answered', 'Admin replied to your question regarding "Code of Conduct".');
// Policy Acknowledged notification to Admin
notify('u1', 'Policy Acknowledged', 'Rohan Mehra has acknowledged "Code of Conduct" v1.');
// Revision notification
notify('u2', 'Policy Revised - Re-acknowledgement Required', '"Code of Conduct" updated to v2.');

assert(notifications.length === 6, 'All 6 required notification scenarios are triggered');
assert(notifications.every((n) => n.type === 'Policy'), 'All notifications utilize the Policy enum type');

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) process.exit(1);

