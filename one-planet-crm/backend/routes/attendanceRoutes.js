import express from 'express';
import {
  checkIn,
  checkOut,
  getMyTodayAttendance,
  getMyAttendanceHistory,
  getAllAttendance,
  adminMarkAttendance,
  requestCorrection,
  getCorrections,
  reviewCorrection,
} from '../controllers/attendanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getMyTodayAttendance);
router.get('/my-history', getMyAttendanceHistory);
router.get('/all', authorize('Admin', 'Manager'), getAllAttendance);
router.post('/admin-mark', authorize('Admin'), adminMarkAttendance);

router.post('/corrections', requestCorrection);
router.get('/corrections', getCorrections);
router.put('/corrections/:id', authorize('Admin', 'Manager'), reviewCorrection);

export default router;
