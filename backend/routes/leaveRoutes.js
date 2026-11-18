import express from 'express';
import {
  getLeaveTypes,
  createLeaveType,
  getMyLeaveBalances,
  getAllLeaveBalances,
  allocateLeaveBalance,
  applyLeave,
  getLeaves,
  cancelLeave,
  reviewLeave,
  deleteLeave,
  getMyAccrualSummary,
  getLeavePolicy,
  updateLeavePolicy,
  previewLopBreakdown,
} from '../controllers/leaveController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Leave Types
router.get('/types', getLeaveTypes);
router.post('/types', authorize('Admin'), createLeaveType);

// Monthly Leave Accrual & Policy
router.get('/accrual-summary', getMyAccrualSummary);
router.get('/preview-lop', previewLopBreakdown);
router.get('/policy', getLeavePolicy);
router.put('/policy', authorize('Admin'), updateLeavePolicy);

// Leave Balances
router.get('/balances/my', getMyLeaveBalances);
router.get('/balances', authorize('Admin', 'Manager'), getAllLeaveBalances);
router.post('/balances', authorize('Admin'), allocateLeaveBalance);

// Leave Requests
router.get('/', getLeaves);
router.post('/', applyLeave);
router.put('/:id/cancel', cancelLeave);
router.put('/:id/review', authorize('Admin', 'Manager'), reviewLeave);
router.delete('/:id', deleteLeave);

export default router;
