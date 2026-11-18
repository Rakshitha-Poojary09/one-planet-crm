// Comprehensive Unit & Functional Tests for Company Policies Module
// Tests role restrictions, version control preservation, acknowledgement tracking, and database integrity

console.log('========================================================');
console.log('🧪 RUNNING COMPANY POLICIES MODULE ISOLATED TESTS');
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

// 1. Role Authorization Rules Verification
function canUserManagePolicies(role) {
  // Only Admin can create, edit, publish, or archive
  return role === 'Admin';
}

function canUserViewPolicy(role, policyStatus) {
  if (role === 'Admin') return true; // Admin can view Draft, Published, Archived
  return policyStatus === 'Published'; // Manager & Employee can ONLY view Published
}

assert(canUserManagePolicies('Admin') === true, 'Admin has full policy management permissions');
assert(canUserManagePolicies('Manager') === false, 'Manager is strictly restricted from editing/publishing policies');
assert(canUserManagePolicies('Employee') === false, 'Employee is strictly restricted from editing/publishing policies');

assert(canUserViewPolicy('Employee', 'Published') === true, 'Employee can view Published policy');
assert(canUserViewPolicy('Employee', 'Draft') === false, 'Employee cannot view Draft policy');
assert(canUserViewPolicy('Employee', 'Archived') === false, 'Employee cannot view Archived policy');
assert(canUserViewPolicy('Manager', 'Draft') === false, 'Manager cannot view Draft policy');
assert(canUserViewPolicy('Admin', 'Draft') === true, 'Admin can view Draft policy');
assert(canUserViewPolicy('Admin', 'Archived') === true, 'Admin can view Archived policy');

// 2. Version Preservation & Snapshot Logic
function createInitialPolicy({ title, category, content, effectiveDate, createdBy }) {
  return {
    _id: 'policy_101',
    title,
    category,
    content,
    effectiveDate: new Date(effectiveDate),
    status: 'Published',
    version: 1,
    versionHistory: [],
    createdBy,
    updatedBy: createdBy,
  };
}

function updatePolicyWithVersionHistory(policy, updates, updatedBy, changeSummary) {
  // 1. Take snapshot of current state
  const snapshot = {
    version: policy.version,
    title: policy.title,
    category: policy.category,
    content: policy.content,
    effectiveDate: policy.effectiveDate,
    changeSummary: changeSummary || `Revision from v${policy.version}`,
    updatedBy,
    savedAt: new Date(),
  };

  // 2. Push snapshot into versionHistory
  const updatedHistory = [...policy.versionHistory, snapshot];

  // 3. Increment version and apply new values
  return {
    ...policy,
    ...updates,
    version: policy.version + 1,
    versionHistory: updatedHistory,
    updatedBy,
    updatedAt: new Date(),
  };
}

const initialPolicy = createInitialPolicy({
  title: 'Information Security Policy',
  category: 'Information Security & IT',
  content: 'Initial terms: All devices must be password protected.',
  effectiveDate: '2026-01-01',
  createdBy: 'admin_user_1',
});

assert(initialPolicy.version === 1, 'Initial policy starts at Version 1');
assert(initialPolicy.versionHistory.length === 0, 'Initial policy has empty version history');

// Admin updates policy
const updatedPolicyV2 = updatePolicyWithVersionHistory(
  initialPolicy,
  { content: 'Updated terms: All devices must use 2FA and 12-char passwords.' },
  'admin_user_1',
  'Added two-factor authentication requirement'
);

assert(updatedPolicyV2.version === 2, 'Policy version increments to 2 on update');
assert(updatedPolicyV2.versionHistory.length === 1, 'Previous version snapshot preserved in history');
assert(updatedPolicyV2.versionHistory[0].version === 1, 'Preserved snapshot has version 1');
assert(
  updatedPolicyV2.versionHistory[0].content === 'Initial terms: All devices must be password protected.',
  'Preserved snapshot holds exact original content'
);
assert(
  updatedPolicyV2.versionHistory[0].changeSummary === 'Added two-factor authentication requirement',
  'Revision notes saved in history'
);

// Admin updates again
const updatedPolicyV3 = updatePolicyWithVersionHistory(
  updatedPolicyV2,
  { title: 'Information Security & Device Usage Policy' },
  'admin_user_1',
  'Expanded title to include device usage'
);

assert(updatedPolicyV3.version === 3, 'Policy version increments to 3 on second update');
assert(updatedPolicyV3.versionHistory.length === 2, 'History holds both v1 and v2 snapshots');
assert(updatedPolicyV3.versionHistory[1].version === 2, 'Second snapshot holds v2');

// 3. Employee Acknowledgement Logic
const acknowledgementsDb = [];

function acknowledgePolicy({ policy, userId, policyVersion, ipAddress }) {
  // Check duplicate
  const existing = acknowledgementsDb.find(
    (a) => a.policyId === policy._id && a.userId === userId && a.policyVersion === policyVersion
  );

  if (existing) {
    return { success: true, message: 'Already acknowledged', existing: true, record: existing };
  }

  const newAck = {
    _id: `ack_${Date.now()}_${userId}`,
    policyId: policy._id,
    userId,
    policyVersion,
    acknowledgedAt: new Date(),
    ipAddress,
  };

  acknowledgementsDb.push(newAck);
  return { success: true, message: 'Acknowledged successfully', existing: false, record: newAck };
}

// User acknowledges v1
const ack1 = acknowledgePolicy({
  policy: initialPolicy,
  userId: 'emp_001',
  policyVersion: 1,
  ipAddress: '192.168.1.10',
});

assert(ack1.success === true, 'Employee acknowledges policy successfully');
assert(ack1.record.policyVersion === 1, 'Acknowledgement records policy version 1');
assert(ack1.record.acknowledgedAt instanceof Date, 'Acknowledgement records exact timestamp');

// User tries to acknowledge v1 again (duplicate check)
const ackDup = acknowledgePolicy({
  policy: initialPolicy,
  userId: 'emp_001',
  policyVersion: 1,
  ipAddress: '192.168.1.10',
});

assert(ackDup.existing === true, 'Duplicate acknowledgement for same version is safely prevented');

// When policy is updated to v2, employee acknowledgement status evaluation
function getEmployeePolicyStatus(policy, userAcknowledgements) {
  const userAcks = userAcknowledgements.filter((a) => a.policyId === policy._id);
  if (userAcks.length === 0) {
    return { isAcknowledged: false, needsReacknowledgement: false, status: 'Pending' };
  }

  const latestAck = userAcks.reduce((max, a) => (a.policyVersion > max.policyVersion ? a : max), userAcks[0]);

  if (latestAck.policyVersion === policy.version) {
    return {
      isAcknowledged: true,
      needsReacknowledgement: false,
      status: 'Acknowledged',
      acknowledgedAt: latestAck.acknowledgedAt,
      version: latestAck.policyVersion,
    };
  }

  return {
    isAcknowledged: false,
    needsReacknowledgement: true,
    status: 'Re-acknowledgement Required',
    acknowledgedAt: latestAck.acknowledgedAt,
    previousVersion: latestAck.policyVersion,
    currentVersion: policy.version,
  };
}

const statusOnV1 = getEmployeePolicyStatus(initialPolicy, acknowledgementsDb);
assert(statusOnV1.isAcknowledged === true, 'Employee has acknowledged v1');

const statusOnV2 = getEmployeePolicyStatus(updatedPolicyV2, acknowledgementsDb);
assert(statusOnV2.needsReacknowledgement === true, 'Flags re-acknowledgement required when policy advances to v2');

// Employee acknowledges v2
const ackV2 = acknowledgePolicy({
  policy: updatedPolicyV2,
  userId: 'emp_001',
  policyVersion: 2,
  ipAddress: '192.168.1.10',
});
assert(ackV2.success === true, 'Employee successfully acknowledges v2');

const statusOnV2AfterAck = getEmployeePolicyStatus(updatedPolicyV2, acknowledgementsDb);
assert(statusOnV2AfterAck.isAcknowledged === true, 'Employee status is now fully acknowledged for v2');

// 4. Admin Compliance Calculation
const activeEmployees = [
  { _id: 'emp_001', name: 'Rohan Mehra' },
  { _id: 'emp_002', name: 'Ananya Roy' },
  { _id: 'emp_003', name: 'Priya Verma' },
  { _id: 'emp_004', name: 'Vikram Joshi' },
];

function calculateCompliance(policy, allAcknowledgements, totalActiveEmployees) {
  const policyAcks = allAcknowledgements.filter(
    (a) => a.policyId === policy._id && a.policyVersion === policy.version
  );

  const uniqueUsers = new Set(policyAcks.map((a) => a.userId));
  const count = uniqueUsers.size;
  const percentage = totalActiveEmployees.length > 0 ? Math.round((count / totalActiveEmployees.length) * 100) : 0;

  const pendingList = totalActiveEmployees.filter((e) => !uniqueUsers.has(e._id));

  return {
    acknowledgedCount: count,
    pendingCount: pendingList.length,
    percentage,
    pendingList,
  };
}

const compliance = calculateCompliance(updatedPolicyV2, acknowledgementsDb, activeEmployees);
assert(compliance.acknowledgedCount === 1, 'Compliance tracks 1 employee acknowledged');
assert(compliance.pendingCount === 3, 'Compliance tracks 3 employees pending');
assert(compliance.percentage === 25, 'Compliance rate is 25% (1/4)');
assert(compliance.pendingList.some((e) => e._id === 'emp_002'), 'Ananya Roy is listed in pending roster');

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}

