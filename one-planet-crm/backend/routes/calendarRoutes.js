import express from 'express';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getCalendarLeaves,
  getEvents,
  createEvent,
  deleteEvent,
} from '../controllers/calendarController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/holidays', getHolidays);
router.post('/holidays', authorize('Admin'), createHoliday);
router.put('/holidays/:id', authorize('Admin'), updateHoliday);
router.delete('/holidays/:id', authorize('Admin'), deleteHoliday);

router.get('/leaves', getCalendarLeaves);

router.get('/events', getEvents);
router.post('/events', authorize('Admin', 'Manager'), createEvent);
router.delete('/events/:id', authorize('Admin'), deleteEvent);

export default router;
