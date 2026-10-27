import express from 'express';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getDepartments);
router.post('/', authorize('Admin'), createDepartment);
router.put('/:id', authorize('Admin'), updateDepartment);
router.delete('/:id', authorize('Admin'), deleteDepartment);

export default router;
