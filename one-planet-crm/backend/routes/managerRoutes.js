import express from 'express';
import {
  getManagers,
  getManagerById,
  createManager,
  updateManager,
  toggleManagerStatus,
  getManagerReports,
  assignReportsToManager,
  reassignReport,
  getAvailableEmployeesForAssignment,
} from '../controllers/managerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Strict Role-Based Security: Only Administrators can access manager management
router.use(authenticate);
router.use(authorize('Admin'));

router.get('/', getManagers);
router.get('/available-employees', getAvailableEmployeesForAssignment);
router.get('/:id', getManagerById);
router.post('/', createManager);
router.put('/:id', updateManager);
router.patch('/:id/status', toggleManagerStatus);
router.get('/:id/reports', getManagerReports);
router.post('/:id/assign-reports', assignReportsToManager);
router.post('/:id/reassign-report', reassignReport);

export default router;
