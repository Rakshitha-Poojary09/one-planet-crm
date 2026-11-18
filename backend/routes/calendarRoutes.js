import express from 'express';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getCalendarLeaves,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getCalendarData,
  getAdminCalendarData,
  getDateAttendanceDetails,
} from '../controllers/calendarController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Role-scoped calendar consolidated data (Admin = company, Manager = authorized team, Employee = self)
router.get('/data', getCalendarData);

// Detailed employee attendance status breakdown for a specific date (Admin/Manager/Employee inspector)
router.get('/date-details', getDateAttendanceDetails);

// Admin consolidated month data (backward compatibility)
router.get('/admin-data', authorize('Admin'), getAdminCalendarData);

router.get('/holidays', getHolidays);
router.post('/holidays', authorize('Admin'), createHoliday);
router.put('/holidays/:id', authorize('Admin'), updateHoliday);
router.delete('/holidays/:id', authorize('Admin'), deleteHoliday);

router.get('/leaves', getCalendarLeaves);

router.get('/events', getEvents);
router.post('/events', authorize('Admin', 'Manager'), createEvent);
router.put('/events/:id', authorize('Admin', 'Manager'), updateEvent);
router.delete('/events/:id', authorize('Admin'), deleteEvent);

export default router;
