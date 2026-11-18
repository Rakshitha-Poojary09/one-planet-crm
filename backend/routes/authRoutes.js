import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  login,
  register,
  getMe,
  updateSelfProfile,
  changePassword,
  logout,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Strict login rate limiter to protect against brute force and credential stuffing
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: process.env.LOGIN_RATE_LIMIT ? parseInt(process.env.LOGIN_RATE_LIMIT, 10) : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
});

router.post('/login', loginLimiter, login);
router.post('/register', register);
router.post('/logout', (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  if (!token) {
    return logout(req, res);
  }
  return authenticate(req, res, (err) => {
    // Even if token verification fails, allow logout to complete gracefully
    return logout(req, res);
  });
});
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateSelfProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
