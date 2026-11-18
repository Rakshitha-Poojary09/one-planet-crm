import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Admin and Employee Policy PDF View Separation Test Suite', () => {

  it('1. Admin policy view renders complete management info and NO employee signature form', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('isAdmin'), 'Component must track isAdmin role');
    assert.ok(content.includes('Official Policy Document'), 'Must render PDF document viewer');
    assert.ok(content.includes('Open PDF in New Window'), 'Must provide open PDF in new window button');
    assert.ok(content.includes('policy.category'), 'Must display policy category');
    assert.ok(content.includes('policy.version'), 'Must display policy version');
    assert.ok(content.includes('policy.effectiveDate'), 'Must display effective date');
    assert.ok(content.includes('Distribution Information'), 'Must display policy distribution information');
    assert.ok(content.includes('Acknowledgement Statistics'), 'Must display acknowledgement statistics');
    assert.ok(content.includes('Employee Acknowledgement Report'), 'Must display employee-wise report table');
    assert.ok(content.includes('View Signature'), 'Must provide View Signature action for signed employees');
    assert.ok(content.includes('Authenticated Electronic Signature Verification'), 'Must provide signature inspection modal');

    // Verify Admin view conditionally excludes employee signature pad
    assert.ok(content.includes('{isAdmin ? ('), 'Must conditionally branch based on isAdmin');
    assert.ok(content.includes('!isAdmin && ('), 'Must guard employee signature/question submission');
  });

  it('2. Employee policy view renders acknowledgement checkbox, SignaturePad and Ask a Question', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.'), 'Must have acknowledgement checkbox statement');
    assert.ok(content.includes('<SignaturePad'), 'Must render SignaturePad canvas');
    assert.ok(content.includes('Submit Acknowledgement'), 'Must render Submit Acknowledgement button');
    assert.ok(content.includes('Ask a Question'), 'Must render Ask a Question section for employees');
    assert.ok(content.includes('My Questions & Admin Replies'), 'Must display conversation history');
  });

  it('3. Backend authorization prevents Admin from acknowledging on behalf of another employee', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const ackFn = content.substring(content.indexOf('export const acknowledgePolicy'));
    assert.ok(ackFn.includes('req.body.targetUserId'), 'Must check targetUserId in acknowledgePolicy');
    assert.ok(ackFn.includes('Admins cannot submit an acknowledgement on behalf of an employee'), 'Must reject unauthorized admin proxy acknowledgements');
    assert.ok(ackFn.includes('user: req.user._id'), 'Acknowledgement must always be saved for authenticated user session');
  });

  it('4. Backend report and signature access enforce strict role authorization', () => {
    const routesPath = path.join(projectRoot, 'backend', 'routes', 'policyRoutes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');

    assert.ok(routesContent.includes("router.get('/:id/report', authorize('Admin')"), 'Report endpoint is Admin-only');
    assert.ok(routesContent.includes("router.get('/:id/acknowledgements', authorize('Admin')"), 'Acknowledgements endpoint is Admin-only');

    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');

    const sigFn = controllerContent.substring(controllerContent.indexOf('export const getEmployeeSignature'));
    assert.ok(sigFn.includes('!isAdmin && String(req.user._id) !== String(userId)'), 'Employee can only view their own signature');
  });

  it('5. Questions section on policy view enables Admin replies and resolution without signature pad', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('Mark Resolved'), 'Admin can mark questions resolved');
    assert.ok(content.includes('Reopen'), 'Admin can reopen resolved questions');
    assert.ok(content.includes('handleSubmitReply'), 'Admin can reply directly from policy view');
  });
});

