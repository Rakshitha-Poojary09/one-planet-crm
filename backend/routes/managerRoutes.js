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
  getPendingManagerRegistrations,
  approveManagerRegistration,
  rejectManagerRegistration,
} from '../controllers/managerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Strict Role-Based Security: Only Administrators can access manager management
router.use(authenticate);
router.use(authorize('Admin'));

router.get('/', getManagers);
router.get('/pending-registrations', getPendingManagerRegistrations);
router.put('/pending-registrations/:id/approve', approveManagerRegistration);
router.put('/pending-registrations/:id/reject', rejectManagerRegistration);
router.get('/available-employees', getAvailableEmployeesForAssignment);
router.get('/:id', getManagerById);
router.post('/', createManager);
router.put('/:id', updateManager);
router.patch('/:id/status', toggleManagerStatus);
router.get('/:id/reports', getManagerReports);
router.post('/:id/assign-reports', assignReportsToManager);
router.post('/:id/reassign-report', reassignReport);

export default router;
