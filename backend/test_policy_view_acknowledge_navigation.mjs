import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Company Policy "View & Acknowledge" Navigation & Rendering Suite', () => {

  it('1. App.jsx registers both /policies/:id and /policies/:id/acknowledge routes', () => {
    const appPath = path.join(projectRoot, 'frontend', 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('import { PolicyViewAcknowledgePage }'), 'App.jsx must import PolicyViewAcknowledgePage');
    assert.ok(content.includes('path="/policies/:id"'), 'App.jsx must configure /policies/:id route');
    assert.ok(content.includes('path="/policies/:id/acknowledge"'), 'App.jsx must configure /policies/:id/acknowledge route');
    assert.ok(content.includes('<PolicyViewAcknowledgePage />'), 'App.jsx must render PolicyViewAcknowledgePage');
  });

  it('2. PoliciesPage.jsx links to /policies/:id with "View & Acknowledge" button', () => {
    const policiesPagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PoliciesPage.jsx');
    const content = fs.readFileSync(policiesPagePath, 'utf8');

    assert.ok(content.includes('/policies/${policy._id}'), 'PoliciesPage must generate navigation link to /policies/${policy._id}');
    assert.ok(content.includes('View & Acknowledge'), 'Button must display "View & Acknowledge"');
  });

  it('3. PolicyViewAcknowledgePage component exists and is properly structured', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    assert.ok(fs.existsSync(pagePath), 'PolicyViewAcknowledgePage.jsx file must exist');

    const content = fs.readFileSync(pagePath, 'utf8');
    assert.ok(content.includes('useParams'), 'Must extract policy ID using useParams');
    assert.ok(content.includes('useNavigate'), 'Must support programmatic navigation');
    assert.ok(content.includes('SignaturePad'), 'Must integrate SignaturePad component');
    assert.ok(content.includes('Back to Policies'), 'Must provide "Back to Policies" navigation');
    assert.ok(content.includes('/policies/${id}'), 'Must fetch policy by ID');
    assert.ok(content.includes('/track-open'), 'Must record document open tracking');
    assert.ok(content.includes('/pdf'), 'Must stream authenticated PDF blob');
    assert.ok(content.includes('/acknowledge'), 'Must submit electronic acknowledgement');
  });

  it('4. PolicyViewAcknowledgePage contains exhaustive error handling to NEVER display a blank page', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // Loading State
    assert.ok(content.includes('Loading Policy Document...'), 'Must render dedicated loading state');
    assert.ok(content.includes('spinner-border text-success'), 'Must display loading spinner');

    // 404 Not Found State
    assert.ok(content.includes('Policy Document Not Found'), 'Must handle 404 policy not found');
    assert.ok(content.includes('Back to Policies'), 'Must provide back button on 404');

    // 403 Forbidden State
    assert.ok(content.includes('Access Restricted'), 'Must handle 403 access restricted');

    // 500 / Network Error State
    assert.ok(content.includes('Unable to Load Policy'), 'Must handle server/network error');
    assert.ok(content.includes('Retry'), 'Must provide retry button on server error');

    // PDF Unavailable / Stream Error State
    assert.ok(content.includes('Document Stream Notice'), 'Must handle PDF streaming failures gracefully');
    assert.ok(content.includes('Retry Loading PDF'), 'Must allow retrying PDF fetch');
    assert.ok(content.includes('Policy Text Content:'), 'Must fall back to text content if PDF stream fails');
  });

  it('5. Acknowledgement workflow enforces mandatory statement checkbox and drawn digital signature', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(
      content.includes('I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.'),
      'Must contain exact mandatory acknowledgement statement'
    );
    assert.ok(content.includes('hasAgreedCheckbox'), 'Must track statement agreement checkbox');
    assert.ok(content.includes('signatureData.hasSignature'), 'Must validate drawn signature existence');
    assert.ok(content.includes('disabled={!hasAgreedCheckbox || !signatureData.hasSignature'), 'Submit button must be disabled until signed and checked');
  });

  it('6. Acknowledgement state renders persistent confirmation upon completion', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('Policy Acknowledged'), 'Must display confirmed status banner');
    assert.ok(content.includes('Electronically signed Version'), 'Must show version signed');
    assert.ok(content.includes('Recorded Drawn Digital Signature:'), 'Must show drawn signature preview');
  });

  it('7. Questions & Clarifications tab is available on PolicyViewAcknowledgePage', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    assert.ok(content.includes('Questions & Clarifications'), 'Must include questions section');
    assert.ok(content.includes('Ask a Question'), 'Must allow submitting clarification inquiries');
    assert.ok(content.includes('/questions'), 'Must call question creation API');
  });

  it('8. Backend policy controller supports getPolicyById and tracks openedAt', async () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const content = fs.readFileSync(controllerPath, 'utf8');

    assert.ok(content.includes('export const getPolicyById'), 'Controller must export getPolicyById');
    assert.ok(content.includes('export const streamPolicyPdf'), 'Controller must export streamPolicyPdf');
    assert.ok(content.includes('export const trackPolicyOpen'), 'Controller must export trackPolicyOpen');
    assert.ok(content.includes('export const acknowledgePolicy'), 'Controller must export acknowledgePolicy');
  });
});
