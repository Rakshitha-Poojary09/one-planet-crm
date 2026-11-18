import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  resetEmployeePassword,
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', authorize('Admin'), createUser);
router.put('/:id', updateUser);
router.patch('/:id/status', authorize('Admin'), toggleUserStatus);
router.post('/:id/reset-password', authorize('Admin'), resetEmployeePassword);

export default router;
