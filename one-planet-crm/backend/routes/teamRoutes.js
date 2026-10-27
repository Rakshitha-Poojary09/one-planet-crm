import express from 'express';
import { getTeams, createTeam, updateTeam, deleteTeam } from '../controllers/teamController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTeams);
router.post('/', authorize('Admin', 'Manager'), createTeam);
router.put('/:id', authorize('Admin', 'Manager'), updateTeam);
router.delete('/:id', authorize('Admin'), deleteTeam);

export default router;
