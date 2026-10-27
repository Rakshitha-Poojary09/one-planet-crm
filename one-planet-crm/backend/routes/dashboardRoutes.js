import express from 'express';
import {
  getAdminDashboard,
  getManagerDashboard,
  getEmployeeDashboard,
} from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/admin', authorize('Admin'), getAdminDashboard);
router.get('/manager', authorize('Admin', 'Manager'), getManagerDashboard);
router.get('/employee', getEmployeeDashboard);

export default router;
