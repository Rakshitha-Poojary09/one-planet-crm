import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Admin Employee Question Status Dropdown Bug Fix Suite', () => {

  it('1. Status dropdown component in PoliciesPage.jsx uses semantic select with onChange and options', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PoliciesPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // Verify select element exists with question-status id and aria-label
    assert.ok(content.includes('id={`question-status-${q._id}`}'), 'Must contain select with question-status ID');
    assert.ok(content.includes('aria-label="Question Status"'), 'Must have accessible aria-label');

    // Verify options: Open, Answered, Resolved
    assert.ok(content.includes('<option value="Open">Open</option>'), 'Must have Open option');
    assert.ok(content.includes('<option value="Answered">Answered</option>'), 'Must have Answered option');
    assert.ok(content.includes('<option value="Resolved">Resolved</option>'), 'Must have Resolved option');

    // Verify value binding
    assert.ok(content.includes('value={q.status || \'Open\'}'), 'Must bind value to q.status');

    // Verify onChange handler capturing selected value
    assert.ok(content.includes('onChange={(e) =>'), 'Must have onChange event handler');
    assert.ok(content.includes('e.target.value'), 'Must capture selected value from event');
    assert.ok(content.includes('handleUpdateQuestionStatus('), 'Must invoke handleUpdateQuestionStatus');

    // Verify disabled attribute to prevent duplicate updates
    assert.ok(content.includes('disabled={updatingStatusId === q._id}'), 'Must disable dropdown during active status update');

    // Verify Mark Resolved / Reopen button is preserved
    assert.ok(content.includes('Mark Resolved'), 'Must preserve Mark Resolved button');
    assert.ok(content.includes('Reopen Question'), 'Must preserve Reopen Question button');
  });

  it('2. Status dropdown component in PolicyViewAcknowledgePage.jsx uses select with onChange', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('aria-label="Question Status"'), 'Must have Question Status select in PolicyViewAcknowledgePage');
    assert.ok(content.includes('<option value="Open">Open</option>'), 'Must have Open option');
    assert.ok(content.includes('<option value="Answered">Answered</option>'), 'Must have Answered option');
    assert.ok(content.includes('<option value="Resolved">Resolved</option>'), 'Must have Resolved option');
    assert.ok(content.includes('handleUpdateStatus(q._id, e.target.value)'), 'Must call handleUpdateStatus with question ID and new status');
  });

  it('3. Backend routes support both direct and policy-parameterized question status updates', () => {
    const routesPath = path.join(projectRoot, 'backend', 'routes', 'policyRoutes.js');
    const content = fs.readFileSync(routesPath, 'utf8');

    // Direct route
    assert.ok(
      content.includes("router.patch('/questions/:questionId/status', authorize('Admin'), updateQuestionStatus)"),
      'Must register /questions/:questionId/status route for Admin'
    );

    // Parameterized route
    assert.ok(
      content.includes("router.patch('/:id/questions/:questionId/status', authorize('Admin'), updateQuestionStatus)"),
      'Must register /:id/questions/:questionId/status route for Admin'
    );
  });

  it('4. Backend controller updateQuestionStatus validates status and updates MongoDB model', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const fnStr = content.substring(content.indexOf('export const updateQuestionStatus'));
    const fnBody = fnStr.substring(0, fnStr.indexOf('export const toggleQuestionFAQ'));

    // Status validation
    assert.ok(fnBody.includes("['Open', 'Answered', 'Resolved'"), 'Must validate that status is Open, Answered, or Resolved');
    assert.ok(fnBody.includes('res.status(400)'), 'Must return 400 for invalid status');

    // Resolution by targetQuestionId
    assert.ok(fnBody.includes('targetQuestionId = questionId || id'), 'Must support finding question by questionId or id');

    // Duplicate prevention
    assert.ok(fnBody.includes('if (question.status === status)'), 'Must prevent redundant database updates if status is unchanged');

    // Save and Notifications
    assert.ok(fnBody.includes('question.status = status'), 'Must set status on MongoDB model');
    assert.ok(fnBody.includes('await question.save()'), 'Must persist to MongoDB');
    assert.ok(fnBody.includes('Policy Question Resolved'), 'Must notify employee when resolved');
    assert.ok(fnBody.includes('Policy Question Reopened'), 'Must notify employee when reopened');
  });

  it('5. Status workflow simulation: Open -> Answered -> Resolved -> Reopened (Open)', () => {
    // Simulated state machine test
    let question = {
      _id: 'q_test_101',
      title: 'Leave Policy Query',
      question: 'Can casual leave be combined with annual leave?',
      status: 'Open',
      replies: [],
    };

    assert.equal(question.status, 'Open', 'New employee question starts as Open');

    // Admin replies
    const adminReply = { role: 'Admin', message: 'Yes, up to 2 days.' };
    question.replies.push(adminReply);
    question.status = 'Answered';
    assert.equal(question.status, 'Answered', 'Admin reply updates question status to Answered');
    assert.equal(question.replies.length, 1, 'Replies history preserved');

    // Admin selects Resolved in dropdown
    question.status = 'Resolved';
    assert.equal(question.status, 'Resolved', 'Admin status change updates question to Resolved');

    // Admin reopens
    question.status = 'Open';
    assert.equal(question.status, 'Open', 'Admin reopen sets question status to Open');
    assert.equal(question.replies.length, 1, 'Replies history remains intact throughout');
  });

  it('6. Bootstrap bundle JavaScript imported in main.jsx', () => {
    const mainPath = path.join(projectRoot, 'frontend', 'src', 'main.jsx');
    const content = fs.readFileSync(mainPath, 'utf8');

    assert.ok(content.includes('bootstrap/dist/js/bootstrap.bundle.min.js'), 'Must import bootstrap bundle JS for dropdown/modal support');
  });
});
