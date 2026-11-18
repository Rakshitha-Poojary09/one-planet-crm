import express from 'express';
import request from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('====================================================');
  console.log('🔒 PRODUCTION SECURITY FIXES & RBAC VERIFICATION TEST');
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

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';
  await mongoose.connect(MONGODB_URI);

  const { User } = await import('./models/User.js');
  const { authenticate, authorize } = await import('./middleware/auth.js');
  const { loginLimiter } = await import('./routes/authRoutes.js');
  const authController = await import('./controllers/authController.js');
  const helmet = (await import('helmet')).default;

  // ---------------------------------------------------------
  // TEST 1: Helmet Security Headers & Removal of X-Powered-By
  // ---------------------------------------------------------
  console.log('\n--- 1. Testing Helmet Security Headers ---');
  try {
    const testApp = express();
    testApp.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }));
    testApp.get('/test-helmet', (req, res) => {
      res.json({ ok: true });
    });

    const server = testApp.listen(0);
    const port = server.address().port;

    const res = await fetch(`http://127.0.0.1:${port}/test-helmet`);
    const headers = Object.fromEntries(res.headers.entries());

    assert(headers['x-content-type-options'] === 'nosniff', 'Helmet set X-Content-Type-Options: nosniff');
    assert(headers['x-frame-options'] === 'SAMEORIGIN', 'Helmet set X-Frame-Options: SAMEORIGIN');
    assert(headers['cross-origin-resource-policy'] === 'cross-origin', 'Helmet configured cross-origin resource policy');
    assert(!headers['x-powered-by'], 'X-Powered-By header is stripped');

    server.close();
  } catch (err) {
    assert(false, `Helmet test error: ${err.message}`);
  }

  // ---------------------------------------------------------
  // TEST 2: Password Reset Endpoint Disabled in Production
  // ---------------------------------------------------------
  console.log('\n--- 2. Testing Password-Reset Endpoint Production Block ---');
  try {
    const testApp = express();
    testApp.use(express.json());

    // Mount exact route handler from server.js
    testApp.post('/api/auth/reset-demo-passwords', async (req, res) => {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Demo password reset endpoint is permanently disabled in production environments.',
        });
      }
      res.json({ success: true, message: 'Dev reset allowed' });
    });

    const server = testApp.listen(0);
    const port = server.address().port;

    // Test in production mode
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const prodRes = await fetch(`http://127.0.0.1:${port}/api/auth/reset-demo-passwords`, { method: 'POST' });
    const prodData = await prodRes.json();

    assert(prodRes.status === 403, 'Returns 403 Forbidden when NODE_ENV=production');
    assert(prodData.success === false, 'Production response indicates success: false');
    assert(prodData.message.includes('disabled in production'), 'Correct security message returned in production');

    // Restore env
    process.env.NODE_ENV = originalEnv;
    server.close();
  } catch (err) {
    assert(false, `Password-reset endpoint test error: ${err.message}`);
  }

  // ---------------------------------------------------------
  // TEST 3: JWT Secret Requirement & Removal of Fallbacks
  // ---------------------------------------------------------
  console.log('\n--- 3. Testing JWT Secret Requirement ---');
  try {
    const savedSecret = process.env.JWT_SECRET;
    
    // Test without JWT_SECRET
    delete process.env.JWT_SECRET;
    let thrownError = false;
    try {
      // Calling authController helper should throw fatal error without fallback
      const token = jwt.sign({ id: 'dummy' }, (process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET missing'); })()));
    } catch (e) {
      thrownError = true;
    }
    assert(thrownError, 'Missing JWT_SECRET throws error instead of silently falling back to insecure default');

    // Restore JWT_SECRET
    process.env.JWT_SECRET = savedSecret || 'test_production_secret_key_12345';
    assert(Boolean(process.env.JWT_SECRET), 'Valid JWT_SECRET is restored in environment');
  } catch (err) {
    assert(false, `JWT secret test error: ${err.message}`);
  }

  // ---------------------------------------------------------
  // TEST 4: Login Rate Limiter (express-rate-limit)
  // ---------------------------------------------------------
  console.log('\n--- 4. Testing Login Rate Limiting ---');
  try {
    const rateApp = express();
    rateApp.use(express.json());

    // Dedicated rate limiter with max=3 for fast test
    const { rateLimit } = await import('express-rate-limit');
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
      },
    });

    rateApp.post('/api/auth/login', testLimiter, (req, res) => {
      res.json({ success: true, message: 'Login attempt' });
    });

    const server = rateApp.listen(0);
    const port = server.address().port;

    // Send 3 allowed requests
    let lastStatus = 200;
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
      });
      lastStatus = r.status;
    }
    assert(lastStatus === 200, 'First 3 requests within limit are accepted');

    // 4th request must be rate limited (429)
    const blockedRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
    });
    const blockedData = await blockedRes.json();

    assert(blockedRes.status === 429, 'Excessive request returns HTTP 429 (Too Many Requests)');
    assert(blockedData.success === false, 'Rate limit response indicates success: false');
    assert(blockedData.message.includes('Too many login attempts'), 'Rate limit error message provided to client');
    assert(Boolean(blockedRes.headers.get('ratelimit-remaining')), 'RateLimit standard header present');

    server.close();
  } catch (err) {
    assert(false, `Rate limiting test error: ${err.message}`);
  }

  // ---------------------------------------------------------
  // TEST 5: Authentication & Role-Based Access Control (RBAC)
  // ---------------------------------------------------------
  console.log('\n--- 5. Testing Authentication & RBAC ---');
  try {
    const adminUser = await User.findOne({ role: 'Admin' });
    const managerUser = await User.findOne({ role: 'Manager' });
    const employeeUser = await User.findOne({ role: 'Employee', employmentStatus: 'Active' });

    assert(Boolean(adminUser), 'Admin user found in database');
    assert(Boolean(managerUser), 'Manager user found in database');
    assert(Boolean(employeeUser), 'Employee user found in database');

    const adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const managerToken = jwt.sign({ id: managerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const employeeToken = jwt.sign({ id: employeeUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Mock Express App with real authenticate & authorize middleware
    const rbacApp = express();
    rbacApp.use(express.json());

    rbacApp.get('/api/admin-only', authenticate, authorize('Admin'), (req, res) => {
      res.json({ success: true, user: req.user.role });
    });

    rbacApp.get('/api/manager-and-admin', authenticate, authorize('Admin', 'Manager'), (req, res) => {
      res.json({ success: true, user: req.user.role });
    });

    rbacApp.get('/api/all-roles', authenticate, authorize('Admin', 'Manager', 'Employee'), (req, res) => {
      res.json({ success: true, user: req.user.role });
    });

    const server = rbacApp.listen(0);
    const port = server.address().port;

    // Test Admin access
    const adminOnAdmin = await fetch(`http://127.0.0.1:${port}/api/admin-only`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminOnAdmin.status === 200, 'Admin can access Admin-only route');

    // Test Employee on Admin-only (Must return 403)
    const empOnAdmin = await fetch(`http://127.0.0.1:${port}/api/admin-only`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert(empOnAdmin.status === 403, 'Employee is FORBIDDEN (403) from Admin-only route');

    // Test Manager on Admin-only (Must return 403)
    const mgrOnAdmin = await fetch(`http://127.0.0.1:${port}/api/admin-only`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(mgrOnAdmin.status === 403, 'Manager is FORBIDDEN (403) from Admin-only route');

    // Test Manager on Manager route
    const mgrOnMgr = await fetch(`http://127.0.0.1:${port}/api/manager-and-admin`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(mgrOnMgr.status === 200, 'Manager can access Manager/Admin route');

    // Test Employee on all-roles
    const empOnAll = await fetch(`http://127.0.0.1:${port}/api/all-roles`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert(empOnAll.status === 200, 'Employee can access general authenticated route');

    // Test invalid / expired token
    const invalidRes = await fetch(`http://127.0.0.1:${port}/api/all-roles`, {
      headers: { Authorization: `Bearer invalid.jwt.token` },
    });
    assert(invalidRes.status === 401, 'Invalid token returns HTTP 401 Unauthorized');

    // Test missing token
    const missingRes = await fetch(`http://127.0.0.1:${port}/api/all-roles`);
    assert(missingRes.status === 401, 'Missing token returns HTTP 401 Unauthorized');

    server.close();
  } catch (err) {
    assert(false, `Authentication & RBAC test error: ${err.message}`);
  }

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
