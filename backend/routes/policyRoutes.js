import express from 'express';
import {
  getPolicies,
  getPolicyById,
  streamPolicyPdf,
  streamSignedPolicyPdf,
  trackPolicyOpen,
  acknowledgePolicy,
  createPolicy,
  updatePolicy,
  updatePolicyStatus,
  deletePolicy,
  getPolicyAcknowledgements,
  getEmployeeSignature,
  sendPolicyReminder,
  getPolicyVersions,
  getPolicyQuestions,
  askPolicyQuestion,
  replyPolicyQuestion,
  updateQuestionStatus,
  toggleQuestionFAQ,
  getAllPolicyQuestions,
} from '../controllers/policyController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { policyUpload } from '../utils/policyUpload.js';

const router = express.Router();

// All policy routes require standard authentication
router.use(authenticate);

// Central questions listing & actions (Must be defined before parameterized :id routes)
router.get('/questions/all', getAllPolicyQuestions);
router.patch('/questions/:questionId/status', authorize('Admin'), updateQuestionStatus);
router.patch('/questions/:questionId/faq', authorize('Admin'), toggleQuestionFAQ);

// Public policy access (Admin, Manager, Employee)
router.get('/', getPolicies);
router.get('/:id', getPolicyById);
router.get('/:id/pdf', streamPolicyPdf); // Authenticated PDF streaming
router.post('/:id/track-open', trackPolicyOpen);
router.post('/:id/acknowledge', acknowledgePolicy);

// Individual Signed PDF Streaming and Download
router.get('/:id/signed-pdf', streamSignedPolicyPdf);
router.get('/:id/signed-pdf/download', streamSignedPolicyPdf);
router.get('/:id/signed-pdf/:userId', streamSignedPolicyPdf);
router.get('/:id/signed-pdf/:userId/download', streamSignedPolicyPdf);

// Policy questions & clarifications
router.get('/:id/questions', getPolicyQuestions);
router.post('/:id/questions', askPolicyQuestion);
router.post('/:id/questions/:questionId/reply', replyPolicyQuestion);
router.patch('/:id/questions/:questionId/status', authorize('Admin'), updateQuestionStatus);
router.patch('/:id/questions/:questionId/faq', authorize('Admin'), toggleQuestionFAQ);

// Signature view (Admin or self)
router.get('/:id/signature/:userId', getEmployeeSignature);

// Admin-only management endpoints
router.post('/', authorize('Admin'), policyUpload.single('pdf'), createPolicy);
router.put('/:id', authorize('Admin'), policyUpload.single('pdf'), updatePolicy);
router.patch('/:id/status', authorize('Admin'), updatePolicyStatus);
router.delete('/:id', authorize('Admin'), deletePolicy);
router.get('/:id/acknowledgements', authorize('Admin'), getPolicyAcknowledgements);
router.get('/:id/report', authorize('Admin'), getPolicyAcknowledgements);
router.post('/:id/send-reminder', authorize('Admin'), sendPolicyReminder);
router.get('/:id/versions', authorize('Admin'), getPolicyVersions);

export default router;
