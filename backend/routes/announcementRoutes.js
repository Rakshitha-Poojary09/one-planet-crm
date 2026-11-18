import express from 'express';
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getMyNotifications,
  markNotificationsAsRead,
} from '../controllers/announcementController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Announcements
router.get('/announcements', getAnnouncements);
router.post('/announcements', authorize('Admin', 'Manager'), createAnnouncement);
router.delete('/announcements/:id', authorize('Admin', 'Manager'), deleteAnnouncement);

// Notifications
router.get('/notifications', getMyNotifications);
router.put('/notifications/mark-read', markNotificationsAsRead);
router.put('/notifications/:id/read', markNotificationsAsRead);
router.patch('/notifications/:id/read', markNotificationsAsRead);
router.put('/notifications/:id', markNotificationsAsRead);

export default router;
