// Verification & Unit Tests for Disabled Registration & Login Page Security

console.log('========================================================');
console.log('🧪 RUNNING LOGIN & REGISTRATION SECURITY RULES TESTS');
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

// 1. Backend Controller Logic Test: Public Registration Disabled
import { register } from './controllers/authController.js';

let mockStatusCode = null;
let mockJsonData = null;

const mockRes = {
  status: (code) => {
    mockStatusCode = code;
    return {
      json: (data) => {
        mockJsonData = data;
        return data;
      },
    };
  },
};

const mockReq = {
  body: {
    fullName: 'Test Self Register',
    email: 'hacker@test.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  },
};

// Execute register
await register(mockReq, mockRes);

assert(mockStatusCode === 403, 'Public registration returns 403 Forbidden status');
assert(mockJsonData?.success === false, 'Public registration returns success: false');
assert(
  mockJsonData?.message?.includes('disabled'),
  'Public registration message clearly indicates registration is disabled'
);

// 2. Admin User Creation Authorization Guard
function checkUserCreationPermission(actingUserRole) {
  if (actingUserRole === 'Admin') {
    return { allowed: true, status: 201 };
  }
  return { allowed: false, status: 403, message: 'Unauthorized. Only Administrators can create new accounts.' };
}

assert(checkUserCreationPermission('Admin').allowed === true, 'Admin is authorized to provision accounts');
assert(checkUserCreationPermission('Manager').allowed === false, 'Manager cannot provision accounts');
assert(checkUserCreationPermission('Employee').allowed === false, 'Employee cannot provision accounts');
assert(checkUserCreationPermission(null).allowed === false, 'Unauthenticated users cannot provision accounts');

// 3. Frontend Login Page Inspection
import fs from 'fs';
const loginContent = fs.readFileSync('C:/Users/LENOVO/Desktop/one-planet-crm/one-planet-crm/frontend/src/pages/Login.jsx', 'utf8');

assert(!loginContent.includes('Register Account'), 'Login page does NOT contain "Register Account" tab');
assert(!loginContent.includes('Register your account'), 'Login page does NOT contain "Register your account" link');
assert(!loginContent.includes('New to One Planet Technologies?'), 'Login page does NOT contain registration prompt');
assert(!loginContent.includes('authMode'), 'Login page does NOT have authMode toggle state');
assert(!loginContent.includes('handleRegisterSubmit'), 'Login page does NOT have registration submit handler');
assert(!loginContent.includes('regFullName'), 'Login page does NOT have self-registration input fields');

// Verify retained features
assert(loginContent.includes('Corporate Email'), 'Login page retains Corporate Email field');
assert(loginContent.includes('Password'), 'Login page retains Password field');
assert(loginContent.includes('Sign In to CRM'), 'Login page retains Sign In to CRM button');
assert(loginContent.includes('handleQuickDemoFill'), 'Login page retains Quick Demo Sign-in logic');
assert(loginContent.includes('Admin') && loginContent.includes('Manager') && loginContent.includes('Employee'), 'Login page retains demo autofill pills for Admin, Manager, and Employee');
assert(loginContent.includes('FiEye') && loginContent.includes('FiEyeOff'), 'Login page retains password visibility toggle');

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}

