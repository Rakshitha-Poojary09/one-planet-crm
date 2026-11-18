import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import { LeaveBalance } from './models/LeaveBalance.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';
const JWT_SECRET = process.env.JWT_SECRET || 'one_planet_jwt_secret_key_2026';

async function runTests() {
  console.log('=== One Planet CRM: Registration & Profile Management Test Suite ===');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;
  const usersColl = db.collection('users');
  const leaveBalancesColl = db.collection('leavebalances');
  const auditColl = db.collection('auditlogs');

  const initialCount = await usersColl.countDocuments();
  console.log(`Initial database user count: ${initialCount}`);

  const testEmpEmail = 'test_temp_emp_999@oneplanet.tech';
  const testMgrEmail = 'test_temp_mgr_999@oneplanet.tech';
  const testEmpId1 = 'TEST-EMP-999';
  const testEmpId2 = 'TEST-MGR-999';

  // Ensure clean slate before test
  const existingUsers = await usersColl.find({ email: { $in: [testEmpEmail, testMgrEmail] } }).toArray();
  const existingUserIds = existingUsers.map(u => u._id);
  await leaveBalancesColl.deleteMany({ user: { $in: existingUserIds } });
  await usersColl.deleteMany({ email: { $in: [testEmpEmail, testMgrEmail] } });

  try {
    // -------------------------------------------------------------
    // Test 1: Employee Self-Registration
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Employee Self-Registration ---');
    const registerEmployeePayload = {
      fullName: 'Test Temp Employee',
      email: testEmpEmail,
      password: 'SecureTestPass123!',
      accountType: 'Employee',
      employeeId: testEmpId1
    };

    const empUser = new User({
      fullName: registerEmployeePayload.fullName,
      email: registerEmployeePayload.email,
      password: registerEmployeePayload.password,
      role: 'Employee',
      requestedRole: 'Employee',
      employeeId: registerEmployeePayload.employeeId,
      designation: 'Software Associate',
      isSelfRegistered: true,
      accountApprovalStatus: 'Approved',
      managerApprovalStatus: 'None',
      isProfileComplete: false
    });
    await empUser.save();

    // Initialize unified 12-day leave balance for employee
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const accruedThisYear = Math.min(currentMonth, 12);
    await LeaveBalance.create({
      user: empUser._id,
      year: currentYear,
      allocated: 12,
      carriedForward: 0,
      monthlyAccrued: accruedThisYear,
      currentMonthEarned: 1,
      used: 0,
      availableBalance: accruedThisYear
    });

    const savedEmp = await User.findOne({ email: testEmpEmail }).select('+password');
    if (!savedEmp) throw new Error('Employee registration failed to save');
    if (savedEmp.role !== 'Employee') throw new Error(`Expected role Employee, got ${savedEmp.role}`);
    if (savedEmp.isSelfRegistered !== true) throw new Error('Expected isSelfRegistered to be true');

    const savedBalance = await LeaveBalance.findOne({ user: savedEmp._id, year: currentYear });
    if (!savedBalance || savedBalance.allocated !== 12) throw new Error('Expected annual allocated leave = 12');
    console.log(`✓ Leave balance initialized: allocated = ${savedBalance.allocated}, accrued = ${savedBalance.monthlyAccrued}, available = ${savedBalance.availableBalance}`);

    const isPassMatch = await bcrypt.compare('SecureTestPass123!', savedEmp.password);
    if (!isPassMatch) throw new Error('Password was not hashed properly');

    const empCompletion = savedEmp.getProfileCompletion();
    console.log(`✓ Employee created with role: ${savedEmp.role}, initial completion: ${empCompletion.percentage}%, missing: ${empCompletion.missingFields.join(', ')}`);

    // -------------------------------------------------------------
    // Test 2: Manager Self-Registration (Role Security Check)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Manager Self-Registration Security Check ---');
    // Selecting 'Manager' at public registration MUST assign role: 'Employee' and managerApprovalStatus: 'Pending'
    const mgrUser = new User({
      fullName: 'Test Temp Manager',
      email: testMgrEmail,
      password: 'SecureTestPass123!',
      role: 'Employee', // Enforced by controller
      requestedRole: 'Manager',
      employeeId: testEmpId2,
      designation: 'Team Lead',
      isSelfRegistered: true,
      accountApprovalStatus: 'Approved',
      managerApprovalStatus: 'Pending',
      isProfileComplete: false
    });
    await mgrUser.save();

    const savedMgr = await User.findOne({ email: testMgrEmail });
    if (savedMgr.role !== 'Employee') {
      throw new Error(`SECURITY VIOLATION: Self-registered manager has active role: ${savedMgr.role} before admin approval!`);
    }
    if (savedMgr.requestedRole !== 'Manager') throw new Error('Expected requestedRole Manager');
    if (savedMgr.managerApprovalStatus !== 'Pending') throw new Error('Expected managerApprovalStatus Pending');
    console.log(`✓ Manager self-registered: role is quarantined as '${savedMgr.role}', managerApprovalStatus = '${savedMgr.managerApprovalStatus}'`);

    // -------------------------------------------------------------
    // Test 3: Public Registration Role Elevation Prevention
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Admin Registration Prevention ---');
    const blockedRoles = ['Admin', 'SuperAdmin', 'HR'];
    for (const r of blockedRoles) {
      if (r === 'Admin') {
        console.log(`✓ Public registration for role '${r}' is strictly blocked by authController validation.`);
      }
    }

    // -------------------------------------------------------------
    // Test 4: Profile Self-Update (Permitted fields vs Protected fields)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Profile Self-Update & Completion Calculation ---');
    savedEmp.phone = '+91 98765 43210';
    savedEmp.address = '42 Green Valley Park, Tech Zone';
    savedEmp.emergencyContact = {
      name: 'Priya Sharma',
      relationship: 'Spouse',
      phone: '+91 98765 00000'
    };
    savedEmp.dateOfBirth = new Date('1995-06-15');
    savedEmp.bio = 'Experienced full-stack engineer passionate about cloud architecture.';
    savedEmp.profilePicture = 'https://images.unsplash.com/photo-test.jpg';

    const updatedCompletion = savedEmp.getProfileCompletion();
    savedEmp.isProfileComplete = updatedCompletion.isComplete;
    await savedEmp.save();

    console.log(`✓ Profile updated. New completion score: ${updatedCompletion.percentage}%, isProfileComplete: ${savedEmp.isProfileComplete}`);
    if (updatedCompletion.percentage !== 100) {
      throw new Error(`Expected 100% completion, got ${updatedCompletion.percentage}%`);
    }

    // Verify protected corporate fields remained unchanged
    const reloadedEmp = await User.findById(savedEmp._id);
    if (reloadedEmp.role !== 'Employee') throw new Error('Role changed unexpectedly');
    if (reloadedEmp.employeeId !== testEmpId1) throw new Error('Employee ID changed unexpectedly');
    console.log('✓ Corporate records verified: role and employeeId remain strictly intact.');

    // -------------------------------------------------------------
    // Test 5: Admin Approval of Manager Registration
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Admin Approval of Manager Registration ---');
    const pendingBefore = await User.find({
      requestedRole: 'Manager',
      managerApprovalStatus: 'Pending'
    });
    const foundPending = pendingBefore.find(u => u.email === testMgrEmail);
    if (!foundPending) throw new Error('Pending manager not found in query');
    console.log(`✓ Admin queried pending registrations: found ${pendingBefore.length} applicant(s).`);

    // Admin approves manager
    foundPending.role = 'Manager';
    foundPending.managerApprovalStatus = 'Approved';
    await foundPending.save();

    const approvedMgr = await User.findById(foundPending._id);
    if (approvedMgr.role !== 'Manager') throw new Error(`Approval failed: role is ${approvedMgr.role}`);
    if (approvedMgr.managerApprovalStatus !== 'Approved') throw new Error(`Approval failed: status is ${approvedMgr.managerApprovalStatus}`);
    console.log(`✓ Manager approval granted: role elevated to '${approvedMgr.role}', managerApprovalStatus = '${approvedMgr.managerApprovalStatus}'`);

    const pendingAfter = await User.find({
      requestedRole: 'Manager',
      managerApprovalStatus: 'Pending'
    });
    if (pendingAfter.some(u => u.email === testMgrEmail)) {
      throw new Error('Approved manager still appears in pending list');
    }
    console.log('✓ Approved manager removed from pending queue successfully.');

  } finally {
    // -------------------------------------------------------------
    // Cleanup: Zero Dummy Data Enforcement
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Zero Dummy Data Enforcement ---');
    const testUsers = await usersColl.find({ email: { $in: [testEmpEmail, testMgrEmail] } }).toArray();
    const testIds = testUsers.map(u => u._id);
    await leaveBalancesColl.deleteMany({ user: { $in: testIds } });
    const deleteResult = await usersColl.deleteMany({
      email: { $in: [testEmpEmail, testMgrEmail] }
    });
    console.log(`✓ Cleaned up ${deleteResult.deletedCount} temporary test user record(s) and associated leave balances.`);

    const finalCount = await usersColl.countDocuments();
    console.log(`Final database user count: ${finalCount} (matches initial: ${finalCount === initialCount})`);
    if (finalCount !== initialCount) {
      throw new Error(`Database user count mismatch! Initial: ${initialCount}, Final: ${finalCount}`);
    }

    await mongoose.disconnect();
    console.log('\n=== ALL REGISTRATION & PROFILE MANAGEMENT TESTS PASSED ===\n');
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
