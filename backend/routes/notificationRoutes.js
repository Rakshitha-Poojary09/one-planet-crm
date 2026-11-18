import express from 'express';
import {
  getMyNotifications,
  markNotificationsAsRead,
} from '../controllers/announcementController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getMyNotifications);
router.get('/my', getMyNotifications);
router.put('/mark-read', markNotificationsAsRead);
router.put('/:id/read', markNotificationsAsRead);
router.patch('/:id/read', markNotificationsAsRead);
router.put('/:id', markNotificationsAsRead);

export default router;

