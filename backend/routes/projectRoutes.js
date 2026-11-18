import express from 'express';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/projectController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Projects
router.get('/projects', getProjects);
router.post('/projects', authorize('Admin', 'Manager'), createProject);
router.put('/projects/:id', authorize('Admin', 'Manager'), updateProject);
router.delete('/projects/:id', authorize('Admin', 'Manager'), deleteProject);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', authorize('Admin', 'Manager'), createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', authorize('Admin', 'Manager'), deleteTask);

export default router;
