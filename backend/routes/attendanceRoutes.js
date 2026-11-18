import express from 'express';
import {
  checkIn,
  checkOut,
  getMyTodayAttendance,
  getMyAttendanceHistory,
  getAllAttendance,
  getAttendanceOverview,
  adminMarkAttendance,
  requestCorrection,
  getCorrections,
  reviewCorrection,
  getAttendanceSettings,
  updateAttendanceSettings,
  exportAttendanceCSV,
} from '../controllers/attendanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Employee check-in / check-out
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getMyTodayAttendance);
router.get('/my-history', getMyAttendanceHistory);

// Admin & Manager Attendance views
router.get('/all', authorize('Admin', 'Manager'), getAllAttendance);
router.get('/overview', authorize('Admin', 'Manager'), getAttendanceOverview);
router.get('/export', authorize('Admin', 'Manager'), exportAttendanceCSV);

// Admin manual recording / adjustments with mandatory reason
router.post('/admin-mark', authorize('Admin'), adminMarkAttendance);

// Attendance Policy Settings (Admin only)
router.get('/settings', authorize('Admin'), getAttendanceSettings);
router.put('/settings', authorize('Admin'), updateAttendanceSettings);

// Corrections
router.post('/corrections', requestCorrection);
router.get('/corrections', getCorrections);
router.put('/corrections/:id', authorize('Admin', 'Manager'), reviewCorrection);

export default router;
