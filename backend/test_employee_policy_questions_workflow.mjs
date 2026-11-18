import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Employee Policy Questions & Admin Replies Complete Workflow Suite', () => {

  it('1. Step 1: Employee can submit a policy question even if unacknowledged', async () => {
    // Model and controller verification
    const questionModelPath = path.join(projectRoot, 'backend', 'models', 'PolicyQuestion.js');
    const questionModelContent = fs.readFileSync(questionModelPath, 'utf8');

    assert.ok(questionModelContent.includes('policy:'), 'Schema must associate question with policy');
    assert.ok(questionModelContent.includes('policyVersion:'), 'Schema must track policyVersion');
    assert.ok(questionModelContent.includes('user:'), 'Schema must track asking user');
    assert.ok(questionModelContent.includes('status:'), 'Schema must track status');
    assert.ok(questionModelContent.includes('replies:'), 'Schema must contain replies array');

    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    assert.ok(controllerContent.includes('export const askPolicyQuestion'), 'Controller must export askPolicyQuestion');
    // Verify question submission does not check for or require prior acknowledgement
    const askFnStr = controllerContent.substring(controllerContent.indexOf('export const askPolicyQuestion'));
    const askFnBody = askFnStr.substring(0, askFnStr.indexOf('export const replyPolicyQuestion'));
    assert.ok(!askFnBody.includes('myAck.isAcknowledged'), 'askPolicyQuestion must NOT require prior acknowledgement');
  });

  it('2. Step 2: Admin receives a notification when an employee submits a question', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const askFnStr = content.substring(content.indexOf('export const askPolicyQuestion'));
    const askFnBody = askFnStr.substring(0, askFnStr.indexOf('export const replyPolicyQuestion'));

    assert.ok(askFnBody.includes("role: 'Admin'"), 'Must query active Admins for notification');
    assert.ok(askFnBody.includes('New Policy Question'), 'Notification title must be "New Policy Question"');
    assert.ok(askFnBody.includes("type: 'Policy'"), 'Notification type must be "Policy"');
    assert.ok(askFnBody.includes('/policies?tab=questions&questionId='), 'Must link to admin questions tab with questionId');
  });

  it('3. Step 3: Admin views and replies to the question (status -> Answered)', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const replyFnStr = content.substring(content.indexOf('export const replyPolicyQuestion'));
    const replyFnBody = replyFnStr.substring(0, replyFnStr.indexOf('export const updateQuestionStatus'));

    assert.ok(replyFnBody.includes("question.status = 'Answered'"), 'Admin reply must set question status to Answered');
    assert.ok(replyFnBody.includes('question.replies.push'), 'Admin reply must be appended to conversation history');
  });

  it('4. Step 4: Employee receives notification when Admin replies', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const replyFnStr = content.substring(content.indexOf('export const replyPolicyQuestion'));
    const replyFnBody = replyFnStr.substring(0, replyFnStr.indexOf('export const updateQuestionStatus'));

    assert.ok(replyFnBody.includes('Policy Question Answered'), 'Notification title must be "Policy Question Answered"');
    assert.ok(replyFnBody.includes('recipient: question.user'), 'Notification must target the asking employee');
    assert.ok(replyFnBody.includes('?tab=questions&questionId='), 'Notification must direct employee to question conversation');
  });

  it('5. Step 5: Employee views reply and sends follow-up (status -> Open, notifies Admin)', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const replyFnStr = content.substring(content.indexOf('export const replyPolicyQuestion'));
    const replyFnBody = replyFnStr.substring(0, replyFnStr.indexOf('export const updateQuestionStatus'));

    assert.ok(replyFnBody.includes("question.status = 'Open'"), 'Employee follow-up must reset status to Open');
    assert.ok(replyFnBody.includes('Policy Question Follow-up'), 'Notification title must be "Policy Question Follow-up"');
    assert.ok(replyFnBody.includes('/policies?tab=questions&questionId='), 'Must link to admin questions tab');
  });

  it('6. Step 6: Admin resolves question (notifies employee) and can reopen if necessary', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const updateStatusFn = content.substring(content.indexOf('export const updateQuestionStatus'));
    assert.ok(updateStatusFn.includes('Policy Question Resolved'), 'Must notify employee when question is marked Resolved');
    assert.ok(updateStatusFn.includes('Policy Question Reopened'), 'Must notify employee when question is reopened');
    assert.ok(updateStatusFn.includes('question.status = status'), 'Must persist updated status in MongoDB');
  });

  it('7. Privacy and Security: Strict isolation of employee questions and role checks', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    // In getPolicyQuestions:
    const getFn = content.substring(content.indexOf('export const getPolicyQuestions'));
    assert.ok(getFn.includes('!isAdmin'), 'Must check if requester is Admin');
    assert.ok(getFn.includes('user: req.user._id'), 'Non-admin users can ONLY fetch their own questions');

    // In replyPolicyQuestion:
    const replyFn = content.substring(content.indexOf('export const replyPolicyQuestion'));
    assert.ok(replyFn.includes('String(question.user) !== String(req.user._id)'), 'Other employees are strictly blocked from replying');

    // In policyRoutes.js:
    const routesPath = path.join(projectRoot, 'backend', 'routes', 'policyRoutes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    assert.ok(routesContent.includes("authorize('Admin'), updateQuestionStatus"), 'updateQuestionStatus is Admin-only');
    assert.ok(routesContent.includes("authorize('Admin'), toggleQuestionFAQ"), 'toggleQuestionFAQ is Admin-only');
  });

  it('8. Employee Interface: PolicyViewAcknowledgePage renders "Ask a Question" below viewer & signature', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // Questions section is present below PDF viewer & signature
    assert.ok(content.includes('id="policy-questions-section"'), 'Must have dedicated policy questions section on the page');
    assert.ok(content.includes('Policy Questions & Clarifications'), 'Must display Questions section title');
    assert.ok(content.includes('Ask a Question'), 'Must have Ask a Question form');
    assert.ok(content.includes('newQuestionTitle'), 'Must have Question Title field');
    assert.ok(content.includes('newQuestionMessage'), 'Must have Question Description/Message field');
    assert.ok(content.includes('Submit Question to HR'), 'Must have Submit Question button');
    assert.ok(content.includes('My Questions & Admin Replies'), 'Must have My Questions section');
    assert.ok(content.includes('Conversation History:'), 'Must show conversation history thread');
    assert.ok(content.includes('q.status'), 'Must show question status');
    assert.ok(content.includes('handleSubmitReply'), 'Must support continuing the conversation with follow-ups');
    assert.ok(content.includes('targetQuestionId'), 'Must support deep-linking from notifications');
  });

  it('9. Admin Interface: PoliciesPage renders "Employee Questions" tab with Open, Resolved & All filters', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PoliciesPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('Employee Questions'), 'Admin tab must be labeled "Employee Questions"');
    assert.ok(content.includes('<option value="All">All Questions</option>'), 'Must provide All Questions filter');
    assert.ok(content.includes('<option value="Open">Open</option>'), 'Must provide Open filter');
    assert.ok(content.includes('<option value="Resolved">Resolved</option>'), 'Must provide Resolved filter');
    assert.ok(content.includes('Mark Resolved'), 'Must have Mark Resolved button');
    assert.ok(content.includes('Reopen Question'), 'Must have Reopen Question button');
    assert.ok(content.includes('q.user?.department?.name || q.user?.department'), 'Must display employee department');
    assert.ok(content.includes('q.user?.employeeId'), 'Must display employee ID');
    assert.ok(content.includes('handleReplyQuestion'), 'Must support Admin replying to employee');
  });

  it('10. Notifications: Clicking notification in AnnouncementsPage navigates to conversation', () => {
    const annPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'AnnouncementsPage.jsx');
    const content = fs.readFileSync(annPath, 'utf8');

    assert.ok(content.includes('navigate(n.link)'), 'Clicking notification must navigate to conversation link');
  });
});

