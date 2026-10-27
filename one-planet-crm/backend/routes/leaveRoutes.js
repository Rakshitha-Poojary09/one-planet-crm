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
} from '../controllers/leaveController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/types', getLeaveTypes);
router.post('/types', authorize('Admin'), createLeaveType);

router.get('/balances/my', getMyLeaveBalances);
router.get('/balances', authorize('Admin', 'Manager'), getAllLeaveBalances);
router.post('/balances', authorize('Admin'), allocateLeaveBalance);

router.get('/', getLeaves);
router.post('/', applyLeave);
router.put('/:id/cancel', cancelLeave);
router.put('/:id/review', authorize('Admin', 'Manager'), reviewLeave);
router.delete('/:id', deleteLeave);

export default router;
