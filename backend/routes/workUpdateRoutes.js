import express from 'express';
import {
  submitWorkUpdate,
  getWorkUpdates,
  getWorkUpdateById,
  addCommentOrClarification,
  getMissingUpdates,
} from '../controllers/workUpdateController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', submitWorkUpdate);
router.get('/', getWorkUpdates);
router.get('/missing', authorize('Admin', 'Manager'), getMissingUpdates);
router.get('/:id', getWorkUpdateById);
router.post('/:id/comments', addCommentOrClarification);
router.put('/:id/feedback', authorize('Admin', 'Manager'), addCommentOrClarification);

export default router;
