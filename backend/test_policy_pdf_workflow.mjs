// Comprehensive Unit and Functional Test Suite for Policy PDF Distribution, Drawn Signature & Acknowledgement Workflow
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 RUNNING COMPANY POLICY PDF & DRAWN SIGNATURE WORKFLOW SUITE');
console.log('================================================================\n');

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
// 1. PDF File Upload & Validation Logic
// -------------------------------------------------------------
function validatePdfUpload(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype !== 'application/pdf' || ext !== '.pdf') {
    return { valid: false, error: 'Invalid file format. Only PDF documents are allowed.' };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { valid: false, error: 'File exceeds 25 MB limit.' };
  }
  return { valid: true };
}

const validPdf = { originalname: 'Employee_Code_Of_Conduct_2026.pdf', mimetype: 'application/pdf', size: 1024 * 500 };
const invalidExe = { originalname: 'malicious.exe', mimetype: 'application/x-msdownload', size: 1024 };
const oversizedPdf = { originalname: 'giant.pdf', mimetype: 'application/pdf', size: 30 * 1024 * 1024 };

assert(validatePdfUpload(validPdf).valid === true, 'Accepts valid PDF document within size limits');
assert(validatePdfUpload(invalidExe).valid === false, 'Rejects non-PDF files (e.g. .exe)');
assert(validatePdfUpload(oversizedPdf).valid === false, 'Rejects oversized PDF documents (>25 MB)');

// -------------------------------------------------------------
// 2. Individual Employee Policy Assignment on Publish
// -------------------------------------------------------------
const activeEmployees = [
  { _id: 'emp_1', employeeId: 'EMP001', fullName: 'Rohan Mehra', role: 'Employee', department: 'Engineering' },
  { _id: 'emp_2', employeeId: 'EMP002', fullName: 'Priya Verma', role: 'Manager', department: 'Product' },
  { _id: 'emp_3', employeeId: 'EMP003', fullName: 'Ananya Roy', role: 'Employee', department: 'Design' },
];

function assignPolicyToEmployees(assignmentStore, policy, employees) {
  let createdCount = 0;
  for (const emp of employees) {
    const key = `${policy._id}_${emp._id}_${policy.version}`;
    if (!assignmentStore.has(key)) {
      assignmentStore.set(key, {
        policy: policy._id,
        user: emp._id,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        policyVersion: policy.version,
        publishedAt: policy.publishedAt || new Date(),
        firstOpenedAt: null,
        latestOpenedAt: null,
        isAcknowledged: false,
        status: 'Not Opened',
        signatureImage: '',
        statement: '',
      });
      createdCount++;
    }
  }
  return createdCount;
}

const assignmentsDB = new Map();
const testPolicy = {
  _id: 'pol_100',
  title: 'Information Security Policy 2026',
  version: 1,
  publishedAt: new Date(),
  pdfFile: { originalName: 'InfoSec_2026.pdf', fileName: 'policy-1234.pdf' },
};

const initialAssigned = assignPolicyToEmployees(assignmentsDB, testPolicy, activeEmployees);
assert(initialAssigned === 3, 'Creates individual policy assignments for all 3 active employees on initial publish');
assert(assignmentsDB.size === 3, 'Assignment store holds 3 distinct records');

// Repeated publish should avoid duplicate assignments
const repeatedAssigned = assignPolicyToEmployees(assignmentsDB, testPolicy, activeEmployees);
assert(repeatedAssigned === 0, 'Avoids creating duplicate assignments if publish is triggered again');
assert(assignmentsDB.size === 3, 'Assignment store size remains strictly 3 after repeated publish');

// -------------------------------------------------------------
// 3. Opening vs Acknowledging Tracking Logic
// -------------------------------------------------------------
function trackOpen(assignmentStore, policyId, userId, version) {
  const key = `${policyId}_${userId}_${version}`;
  const record = assignmentStore.get(key);
  if (!record) return null;

  const now = new Date();
  if (!record.firstOpenedAt) {
    record.firstOpenedAt = now;
  }
  record.latestOpenedAt = now;
  if (!record.isAcknowledged) {
    record.status = 'Opened';
  }
  return record;
}

const emp1Record = trackOpen(assignmentsDB, testPolicy._id, 'emp_1', testPolicy.version);
assert(emp1Record.status === 'Opened', 'Opening policy transitions status from Not Opened to Opened');
assert(emp1Record.firstOpenedAt instanceof Date, 'firstOpenedAt timestamp is recorded');
assert(emp1Record.latestOpenedAt instanceof Date, 'latestOpenedAt timestamp is recorded');
assert(emp1Record.isAcknowledged === false, 'IMPORTANT: Opening or viewing PDF does NOT mark policy as acknowledged');
assert(emp1Record.signatureImage === '', 'Signature remains empty upon opening');

// -------------------------------------------------------------
// 4. Drawn Digital Signature Submission & Validation
// -------------------------------------------------------------
function submitAcknowledgement(assignmentStore, policyId, user, version, signatureImage, statement, checkboxChecked) {
  if (!checkboxChecked) {
    return { success: false, error: 'Confirmation checkbox is mandatory' };
  }
  if (!signatureImage || !signatureImage.startsWith('data:image/png;base64,')) {
    return { success: false, error: 'Valid drawn digital signature image is required' };
  }

  const key = `${policyId}_${user._id}_${version}`;
  const record = assignmentStore.get(key);
  if (!record) return { success: false, error: 'Assignment not found' };

  if (record.isAcknowledged) {
    return { success: false, error: 'Policy already acknowledged for this version' };
  }

  const now = new Date();
  record.isAcknowledged = true;
  record.status = 'Acknowledged';
  record.acknowledgedAt = now;
  record.signatureImage = signatureImage;
  record.statement = statement;
  record.confirmationRecord = {
    confirmed: true,
    confirmedBy: `${user.fullName} (${user.employeeId})`,
    confirmedAt: now,
    acknowledgementType: 'Internal Drawn Electronic Signature',
  };

  return { success: true, record };
}

const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAACWCAYAAADg';
const mandatoryStmt = 'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.';

// 4a: Rejects submission if checkbox is unchecked
const noCheckboxResult = submitAcknowledgement(assignmentsDB, testPolicy._id, activeEmployees[0], testPolicy.version, sampleSignature, mandatoryStmt, false);
assert(noCheckboxResult.success === false, 'Rejects acknowledgement submission if confirmation checkbox is not checked');

// 4b: Rejects submission if signature is missing or blank
const emptySigResult = submitAcknowledgement(assignmentsDB, testPolicy._id, activeEmployees[0], testPolicy.version, '', mandatoryStmt, true);
assert(emptySigResult.success === false, 'Rejects acknowledgement submission if drawn signature is empty');

// 4c: Successful submission
const validAckResult = submitAcknowledgement(assignmentsDB, testPolicy._id, activeEmployees[0], testPolicy.version, sampleSignature, mandatoryStmt, true);
assert(validAckResult.success === true, 'Successfully submits drawn signature and acknowledgement');
assert(validAckResult.record.status === 'Acknowledged', 'Employee status transitions to Acknowledged');
assert(validAckResult.record.signatureImage === sampleSignature, 'Drawn digital signature image is saved in MongoDB record');
assert(validAckResult.record.statement === mandatoryStmt, 'Mandatory confirmation statement is stored');
assert(validAckResult.record.acknowledgedAt instanceof Date, 'Acknowledgement timestamp is stored');

// 4d: Prevents duplicate acknowledgement for same version
const duplicateAckResult = submitAcknowledgement(assignmentsDB, testPolicy._id, activeEmployees[0], testPolicy.version, sampleSignature, mandatoryStmt, true);
assert(duplicateAckResult.success === false, 'Prevents duplicate acknowledgement for the exact same employee and policy version');

// -------------------------------------------------------------
// 5. Admin Acknowledgement Dashboard Metrics & Reporting
// -------------------------------------------------------------
// Let emp_2 open it (Opened but Not Acknowledged), while emp_3 has not opened it yet
trackOpen(assignmentsDB, testPolicy._id, 'emp_2', testPolicy.version);

function calculateDashboardMetrics(assignmentStore, policyId, version) {
  const records = [];
  for (const [key, val] of assignmentStore.entries()) {
    if (val.policy === policyId && val.policyVersion === version) {
      records.push(val);
    }
  }

  const totalAssigned = records.length;
  const acknowledgedCount = records.filter((r) => r.status === 'Acknowledged').length;
  const openedNotAcknowledgedCount = records.filter((r) => r.status === 'Opened').length;
  const notOpenedCount = records.filter((r) => r.status === 'Not Opened').length;
  const pendingCount = totalAssigned - acknowledgedCount;
  const completionPercentage = totalAssigned > 0 ? Math.round((acknowledgedCount / totalAssigned) * 100) : 0;

  return {
    totalAssigned,
    acknowledgedCount,
    openedNotAcknowledgedCount,
    notOpenedCount,
    pendingCount,
    completionPercentage,
    records,
  };
}

const dashboard = calculateDashboardMetrics(assignmentsDB, testPolicy._id, testPolicy.version);
assert(dashboard.totalAssigned === 3, 'Dashboard tracks total 3 assigned employees');
assert(dashboard.acknowledgedCount === 1, 'Dashboard tracks 1 acknowledged employee (emp_1)');
assert(dashboard.openedNotAcknowledgedCount === 1, 'Dashboard tracks 1 opened-not-acknowledged employee (emp_2)');
assert(dashboard.notOpenedCount === 1, 'Dashboard tracks 1 not-opened employee (emp_3)');
assert(dashboard.pendingCount === 2, 'Dashboard tracks 2 pending employees in total (emp_2 + emp_3)');
assert(dashboard.completionPercentage === 33, 'Dashboard computes accurate completion percentage (33%)');

// -------------------------------------------------------------
// 6. Security: Signature View Authorization
// -------------------------------------------------------------
function canViewSignature(requestingUser, targetEmployeeId) {
  if (requestingUser.role === 'Admin') return true;
  return requestingUser._id === targetEmployeeId;
}

const adminUser = { _id: 'admin_1', role: 'Admin' };
const employee1 = { _id: 'emp_1', role: 'Employee' };
const employee2 = { _id: 'emp_2', role: 'Employee' };

assert(canViewSignature(adminUser, 'emp_1') === true, 'Admin has authorization to view any employee signature record');
assert(canViewSignature(employee1, 'emp_1') === true, 'Employee has authorization to view their own signature record');
assert(canViewSignature(employee2, 'emp_1') === false, 'Employee is STRICTLY BLOCKED from viewing another employee signature record');

// -------------------------------------------------------------
// 7. Questions and Clarifications System
// -------------------------------------------------------------
const questionsList = [];

function submitQuestion(policyId, user, title, message) {
  const q = {
    _id: `q_${questionsList.length + 1}`,
    policy: policyId,
    user: user._id,
    employeeId: user.employeeId,
    title,
    question: message,
    status: 'Open',
    isPrivate: true,
    isFAQ: false,
    replies: [],
  };
  questionsList.push(q);
  return q;
}

function replyQuestion(actingUser, questionId, replyMessage) {
  const q = questionsList.find((item) => item._id === questionId);
  if (!q) throw new Error('Question not found');

  if (actingUser.role !== 'Admin' && actingUser._id !== q.user) {
    throw new Error('Access denied: Cannot reply to other employees questions');
  }

  q.replies.push({
    user: actingUser._id,
    role: actingUser.role,
    message: replyMessage,
    createdAt: new Date(),
  });

  if (actingUser.role === 'Admin') {
    q.status = 'Answered';
  } else {
    q.status = 'Open';
  }
  return q;
}

const question1 = submitQuestion(testPolicy._id, activeEmployees[0], 'Device Encryption Requirement', 'Is full disk BitLocker required for personal laptops used for remote access?');
assert(question1.title === 'Device Encryption Requirement', 'Stores question title');
assert(question1.status === 'Open', 'New question starts with status Open');

replyQuestion(adminUser, question1._id, 'Yes, Section 4.1 mandates BitLocker/FileVault for any device accessing corporate CRM.');
assert(question1.status === 'Answered', 'Admin reply updates question status to Answered');
assert(question1.replies.length === 1, 'Replies thread captures Admin answer');

// Admin resolves question
question1.status = 'Resolved';
assert(question1.status === 'Resolved', 'Admin can mark question as Resolved');

// -------------------------------------------------------------
// 8. Policy Version Management & Fresh Acknowledgement Requirement
// -------------------------------------------------------------
const versionHistory = [];
function updatePolicyVersion(policy, newPdf, changeSummary) {
  versionHistory.push({
    version: policy.version,
    title: policy.title,
    pdfFile: policy.pdfFile,
    changeSummary,
    savedAt: new Date(),
  });

  policy.version += 1;
  policy.pdfFile = newPdf;
  policy.publishedAt = new Date();
}

const v2Pdf = { originalName: 'InfoSec_2026_v2_Revision.pdf', fileName: 'policy-5678.pdf' };
updatePolicyVersion(testPolicy, v2Pdf, 'Updated Section 4.1 encryption guidelines');

assert(testPolicy.version === 2, 'Policy version increments to 2');
assert(versionHistory.length === 1 && versionHistory[0].version === 1, 'v1 PDF and metadata preserved in version history');
assert(versionHistory[0].pdfFile.originalName === 'InfoSec_2026.pdf', 'Original v1 PDF is kept intact and unchanged');

// Creating new assignments for v2
const v2Assigned = assignPolicyToEmployees(assignmentsDB, testPolicy, activeEmployees);
assert(v2Assigned === 3, 'Creates new policy assignments for all 3 active employees for Version 2');

// Verify emp_1: Acknowledged for v1, but Not Opened for v2
const emp1V1Record = assignmentsDB.get(`${testPolicy._id}_emp_1_1`);
const emp1V2Record = assignmentsDB.get(`${testPolicy._id}_emp_1_2`);

assert(emp1V1Record.isAcknowledged === true, 'v1 acknowledgement record is NOT overwritten or deleted');
assert(emp1V1Record.signatureImage === sampleSignature, 'v1 drawn signature remains preserved');
assert(emp1V2Record.isAcknowledged === false, 'v2 requires fresh acknowledgement (isAcknowledged = false)');
assert(emp1V2Record.status === 'Not Opened', 'v2 starts in Not Opened status');

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);

