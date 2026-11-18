import express from 'express';
import { getSettings, updateSettings, getAuditLogs, getExportReportData } from '../controllers/settingsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Settings
router.get('/', getSettings);
router.put('/', authorize('Admin'), updateSettings);
router.get('/settings', getSettings);
router.put('/settings', authorize('Admin'), updateSettings);

// Reports & Audit
router.get('/audit-logs', authorize('Admin'), getAuditLogs);
router.get('/export-data', authorize('Admin', 'Manager', 'Employee'), getExportReportData);

export default router;
