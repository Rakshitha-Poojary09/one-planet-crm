import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLoginCleanup() {
  console.log('====================================================');
  console.log('🧪 TEST: REMOVAL OF QUICK DEMO SIGN-IN & LOGIN AUDIT');
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

  // 1. Audit frontend/src/pages/Login.jsx
  const loginFilePath = path.resolve(__dirname, '../frontend/src/pages/Login.jsx');
  const loginContent = fs.readFileSync(loginFilePath, 'utf8');

  console.log('--- 1. Auditing Login.jsx UI Code ---');
  assert(!loginContent.includes('Quick Demo Sign-in'), 'Removed "Quick Demo Sign-in" text');
  assert(!loginContent.includes('1-Click Autofill'), 'Removed "1-Click Autofill" badge/option');
  assert(!loginContent.includes('handleQuickDemoFill'), 'Removed handleQuickDemoFill function');
  assert(!loginContent.includes('login-demo-card'), 'Removed login-demo-card container');
  assert(!loginContent.includes('login-demo-pill'), 'Removed login-demo-pill buttons');
  assert(!loginContent.includes('AdminPassword123!'), 'Removed hardcoded Admin demo password from UI');
  assert(!loginContent.includes('ManagerPassword123!'), 'Removed hardcoded Manager demo password from UI');
  assert(!loginContent.includes('EmployeePassword123!'), 'Removed hardcoded Employee demo password from UI');
  assert(!loginContent.includes('admin@oneplanet.tech'), 'Removed hardcoded Admin demo email from UI');
  assert(!loginContent.includes('manager@oneplanet.tech'), 'Removed hardcoded Manager demo email from UI');
  assert(!loginContent.includes('employee@oneplanet.tech'), 'Removed hardcoded Employee demo email from UI');

  console.log('\n--- 2. Auditing Preserved Login Fields & Controls ---');
  assert(loginContent.includes('Corporate Email'), 'Corporate Email label is present');
  assert(loginContent.includes('type="email"'), 'Email input type is email');
  assert(loginContent.includes('placeholder="name@oneplanet.tech"'), 'Standard email placeholder is present');
  assert(loginContent.includes('Password'), 'Password label is present');
  assert(loginContent.includes('placeholder="••••••••••••"'), 'Standard password placeholder is present');
  assert(loginContent.includes('login-toggle-btn') && loginContent.includes('showPassword'), 'Password visibility toggle button is present');
  assert(loginContent.includes('FiEye') && loginContent.includes('FiEyeOff'), 'Eye icons for password toggle are present');
  assert(loginContent.includes('Sign In to CRM'), 'Sign In to CRM button is present');
  assert(loginContent.includes('handleLoginSubmit'), 'Form submit handler handleLoginSubmit is present');

  console.log('\n--- 3. Auditing Role-Based Routing & Authentication Handlers ---');
  assert(loginContent.includes("navigate('/admin/dashboard')"), 'Role routing for Admin to /admin/dashboard preserved');
  assert(loginContent.includes("navigate('/manager/dashboard')"), 'Role routing for Manager to /manager/dashboard preserved');
  assert(loginContent.includes("navigate('/employee/dashboard')"), 'Role routing for Employee to /employee/dashboard preserved');
  assert(loginContent.includes("api.post('/auth/login'"), 'Actual login API request preserved');

  console.log('\n--- 4. Verifying Backend Database Credentials & User Accounts Intact ---');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';
  await mongoose.connect(MONGODB_URI);

  const { User } = await import('./models/User.js');
  const bcrypt = (await import('bcryptjs')).default;

  const admin = await User.findOne({ email: 'admin@oneplanet.tech' }).select('+password');
  const manager = await User.findOne({ email: 'manager@oneplanet.tech' }).select('+password');

  assert(Boolean(admin), 'Admin account exists in MongoDB');
  assert(Boolean(manager), 'Manager account exists in MongoDB');

  const adminMatch = await bcrypt.compare('AdminPassword123!', admin.password);
  const managerMatch = await bcrypt.compare('ManagerPassword123!', manager.password);

  assert(adminMatch, 'Admin password hash in database remains intact');
  assert(managerMatch, 'Manager password hash in database remains intact');

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testLoginCleanup().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
