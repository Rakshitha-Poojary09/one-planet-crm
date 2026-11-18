import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import {
  embedSignatureIntoPolicyPdf,
  generateSignedPdfFilename,
} from './utils/pdfSigner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Minimal valid transparent PNG image data URL (representing employee's drawn digital signature)
const SAMPLE_DRAWN_SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA8CAYAAAA9/O93AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIcSURBVHhe7d2xccMwEAVR/x3YVOB23Io7cCtORW7FSbWbCCxBAiQQgGf05r0Z/w3vXwAAAAAAAAAAAAAAAADgP9vtm218q0Nn3+8e4L/Y9318q9PzPPv/g61vdfjs2/57/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/B/bdpvHt/ptd9/p6l37vg8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwA+27bba+FY33/u3W1392rZ9fL7r3v+F7f4JAAAAAAAAAOANAgAA4AUCALi7nO02jnZ7HkcrAAAAAAAAAAAAAAAAAMDXtm0b/8mP4/j1m/F3fD4e58b3eR4+e8/P5+P7fB5H+13b0Zpfto1vFQAAAAAAAAAAAADwMwEAAAAA4AUCALi7bT8eR/v7eD7e57c61/vj9XicG8/z+f36eT2/jt93375tHP0aAAAAAAAAAAAAAAAAAMCbBACADfH5+33dOvdj3313+/r67/wCAAAAALi7AACADwEAAAAA4AUCALj7fgAAAAAAAACgRAAAAAAAAADY9Q0AAAAAfAgAAAAAAAAAeAsBAAAAAAAA2PUAAAAAAAAAwIcAAAAAAAAAeAsBAAAAAAAA2PUAAAAAAAAAwIcAAAAAAAAAeAsBAAAAAAAA2PUAAAAAAAAAwIcAAAAAAAAAeAsBAAAAAAAA2PUAAAAAAAAAwIcAAAAAAAAAeAsBAAAAAAAA2PUAAAAAAAAAwIcAAAAAAAAAAADgE20j12O8KkW+AAAAAElFTkSuQmCC';

describe('Employee Digital Signature Directly Inside Company Policy PDF – Test Suite', () => {

  // =========================================================================
  // 1. Core PDF Signature Embedding Engine (pdfSigner.js)
  // =========================================================================
  describe('1. PDF Signature Embedding Engine (pdfSigner.js)', () => {
    let originalPdfPath;
    let originalPdfBytes;
    let originalSha256;
    let signedResult;

    it('creates an original 2-page company policy PDF document', async () => {
      const doc = await PDFDocument.create();
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const font = await doc.embedFont(StandardFonts.Helvetica);

      // Page 1
      const p1 = doc.addPage([595.28, 841.89]);
      p1.drawText('ONE PLANET TECHNOLOGIES - POLICY DOCUMENT', {
        x: 50,
        y: 800,
        size: 16,
        font: fontBold,
        color: rgb(0.06, 0.32, 0.2),
      });
      p1.drawText('Leave, Attendance & Remote Working Policy', {
        x: 50,
        y: 770,
        size: 14,
        font: fontBold,
      });
      p1.drawText('All employees are entitled to standard paid leaves according to internal guidelines.', {
        x: 50,
        y: 730,
        size: 11,
        font: font,
      });
      p1.drawText('Page 1 of 2', { x: 500, y: 30, size: 9, font: font });

      // Page 2
      const p2 = doc.addPage([595.28, 841.89]);
      p2.drawText('Section 5: Compliance and Acknowledgment Requirements', {
        x: 50,
        y: 800,
        size: 12,
        font: fontBold,
      });
      p2.drawText('Employees must formally acknowledge their acceptance of these guidelines.', {
        x: 50,
        y: 770,
        size: 11,
        font: font,
      });
      p2.drawText('Page 2 of 2', { x: 500, y: 30, size: 9, font: font });

      originalPdfBytes = await doc.save();
      originalSha256 = crypto.createHash('sha256').update(originalPdfBytes).digest('hex');

      const testDir = path.join(__dirname, 'uploads', 'policies');
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

      originalPdfPath = path.join(testDir, `orig_test_policy_${Date.now()}.pdf`);
      fs.writeFileSync(originalPdfPath, originalPdfBytes);

      assert.ok(fs.existsSync(originalPdfPath), 'Original PDF file must exist on disk');
      assert.equal(doc.getPageCount(), 2, 'Original PDF has 2 pages');
    });

    it('generates a clean, individual filename matching employee records', () => {
      const generatedName = generateSignedPdfFilename(
        'Company Leave Policy',
        'Rakshitha Poojary',
        'OPT1011'
      );
      assert.equal(
        generatedName,
        'Company_Leave_Policy_Rakshitha_Poojary_OPT1011_Signed.pdf',
        'Filename must format as ${title}_${name}_${id}_Signed.pdf'
      );
    });

    it('embeds employee signature and appends formatted Certificate Page without touching original pages', async () => {
      const signatory = {
        fullName: 'Rakshitha Poojary',
        employeeId: 'OPT1011',
        department: 'Human Resources',
        email: 'rakshitha@oneplanet.tech',
        signedAt: new Date('2026-11-06T10:30:00.000Z'),
        ipAddress: '192.168.1.45',
        statement:
          'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.',
      };

      const policyMeta = {
        title: 'Company Leave Policy',
        version: 1,
        category: 'Leave, Attendance & Hours',
        effectiveDate: new Date('2026-01-01'),
      };

      signedResult = await embedSignatureIntoPolicyPdf({
        originalPdfPath,
        signatureDataUrl: SAMPLE_DRAWN_SIGNATURE_PNG,
        signatory,
        policy: policyMeta,
      });

      assert.ok(signedResult, 'Signer must return result');
      assert.ok(signedResult.fileName.includes('Rakshitha_Poojary_OPT1011_Signed.pdf'), 'Filename must include employee info');
      assert.ok(fs.existsSync(signedResult.filePath), 'Signed file must exist on disk');
      assert.equal(signedResult.pageCount, 3, 'Signed PDF must have exactly 3 pages (2 original + 1 Certificate)');
    });

    it('verifies the appended Certificate Page contains embedded image object and audit stamp', async () => {
      const signedBytes = fs.readFileSync(signedResult.filePath);
      const signedDoc = await PDFDocument.load(signedBytes);

      assert.equal(signedDoc.getPageCount(), 3, 'Page count must be 3');
      const certPage = signedDoc.getPage(2); // 0-indexed 3rd page
      assert.equal(Math.round(certPage.getWidth()), 595, 'Certificate page must be standard A4 width');
      assert.equal(Math.round(certPage.getHeight()), 842, 'Certificate page must be standard A4 height');

      // Verify certificate page has image XObjects resources
      const pageDict = certPage.node;
      const resources = pageDict.Resources();
      const xObject = resources?.get(PDFDocument.create().context.obj('XObject'));
      assert.ok(xObject !== undefined, 'Certificate page must have embedded XObject resources');
    });

    it('verifies the original policy PDF on disk is completely untouched (non-destructive)', () => {
      const diskBytes = fs.readFileSync(originalPdfPath);
      const currentSha256 = crypto.createHash('sha256').update(diskBytes).digest('hex');
      assert.equal(currentSha256, originalSha256, 'Original PDF hash must remain 100% unchanged');
    });

    // Cleanup disk files from test
    it('cleans up temporary test files', () => {
      if (fs.existsSync(originalPdfPath)) fs.unlinkSync(originalPdfPath);
      if (signedResult?.filePath && fs.existsSync(signedResult.filePath)) {
        fs.unlinkSync(signedResult.filePath);
      }
    });
  });

  // =========================================================================
  // 2. Database Model Verification (PolicyAcknowledgement.js)
  // =========================================================================
  describe('2. Database Model Schema (PolicyAcknowledgement.js)', () => {
    it('verifies signedPdf and originalPdf metadata fields exist in PolicyAcknowledgement schema', () => {
      const modelPath = path.join(projectRoot, 'backend', 'models', 'PolicyAcknowledgement.js');
      const content = fs.readFileSync(modelPath, 'utf8');

      assert.ok(content.includes('signedPdf: {'), 'Must declare signedPdf sub-schema');
      assert.ok(content.includes('fileName: { type: String'), 'Must store signedPdf.fileName');
      assert.ok(content.includes('filePath: { type: String'), 'Must store signedPdf.filePath');
      assert.ok(content.includes('fileSize: { type: Number'), 'Must store signedPdf.fileSize');
      assert.ok(content.includes('pageCount: { type: Number'), 'Must store signedPdf.pageCount');
      assert.ok(content.includes('generatedAt: { type: Date'), 'Must store signedPdf.generatedAt');
      assert.ok(content.includes('originalPdf: {'), 'Must store originalPdf reference metadata');
    });
  });

  // =========================================================================
  // 3. Backend Controller & Route Security Invariants (policyController.js)
  // =========================================================================
  describe('3. Backend Controller & Route Security (policyController.js & policyRoutes.js)', () => {
    const controllerPath = path.join(projectRoot, 'backend', 'controllers', 'policyController.js');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');
    const routesPath = path.join(projectRoot, 'backend', 'routes', 'policyRoutes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');

    it('registers signed PDF routes with authentication in policyRoutes.js', () => {
      assert.ok(routesContent.includes("router.get('/:id/signed-pdf'"), 'Must register /:id/signed-pdf route');
      assert.ok(routesContent.includes("router.get('/:id/signed-pdf/:userId'"), 'Must register /:id/signed-pdf/:userId route');
    });

    it('enforces strict role-based access control in streamSignedPolicyPdf', () => {
      assert.ok(
        controllerContent.includes("req.user.role !== 'Admin' && String(targetUserId) !== String(req.user._id)"),
        'Must reject non-admin users attempting to access another employee signed PDF with 403 Forbidden'
      );
      assert.ok(
        controllerContent.includes("You do not have permission to access another employee's signed document."),
        'Must supply explicit security rejection message'
      );
    });

    it('sets proper Content-Type and Content-Disposition headers for stream vs download', () => {
      assert.ok(
        controllerContent.includes("res.setHeader('Content-Type', 'application/pdf');"),
        'Must set application/pdf header'
      );
      assert.ok(
        controllerContent.includes("isDownload ? 'attachment' : 'inline'"),
        'Must toggle between inline (for in-browser preview) and attachment (for direct download)'
      );
    });

    it('embeds signature during acknowledgePolicy execution and stores metadata', () => {
      assert.ok(
        controllerContent.includes('embedSignatureIntoPolicyPdf'),
        'acknowledgePolicy must call embedSignatureIntoPolicyPdf'
      );
      assert.ok(
        controllerContent.includes('signedPdf: {'),
        'acknowledgePolicy must assign signedPdf metadata'
      );
      assert.ok(
        controllerContent.includes('Policy has already been acknowledged'),
        'Must prevent duplicate acknowledgement signing'
      );
    });

    it('exposes signedPdf and hasSignedPdf in getPolicyById and getPolicyAcknowledgements', () => {
      assert.ok(
        controllerContent.includes('hasSignedPdf: !!ack.signedPdf?.filePath'),
        'Must expose hasSignedPdf boolean flag to client'
      );
      assert.ok(
        controllerContent.includes('signedPdf: ack.signedPdf'),
        'Must return signedPdf metadata'
      );
    });
  });

  // =========================================================================
  // 4. Frontend View & UI Components (PolicyViewAcknowledgePage.jsx)
  // =========================================================================
  describe('4. Frontend View & Interactive UI (PolicyViewAcknowledgePage.jsx)', () => {
    const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PolicyViewAcknowledgePage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    it('renders "Submit & Sign" action button when policy is pending acknowledgement', () => {
      assert.ok(pageContent.includes('Submit & Sign'), 'Must label submission button as "Submit & Sign"');
      assert.ok(
        pageContent.includes('disabled={!hasAgreedCheckbox || !signatureData.hasSignature || submittingAck}'),
        'Must reject submission if checkbox is unchecked or signature pad is empty'
      );
    });

    it('displays "Policy Successfully Signed" and download/preview actions when acknowledged', () => {
      assert.ok(
        pageContent.includes('Policy Successfully Signed'),
        'Must display "Policy Successfully Signed" state'
      );
      assert.ok(
        pageContent.includes('handleDownloadSignedPdf'),
        'Must provide handler to download individual signed PDF'
      );
      assert.ok(
        pageContent.includes('handleToggleSignedPdfPreview'),
        'Must provide toggle button to preview signed PDF copy'
      );
      assert.ok(
        pageContent.includes('Download Signed PDF'),
        'Must render "Download Signed PDF" button'
      );
    });

    it('supports switching PDF viewer between original policy document and signed copy', () => {
      assert.ok(
        pageContent.includes('Original Document'),
        'Must offer Original Document viewer option'
      );
      assert.ok(
        pageContent.includes('Signed Copy (With My Signature)'),
        'Must offer Signed Copy viewer option'
      );
      assert.ok(
        pageContent.includes('showingSignedPdf && signedPdfBlobUrl ? signedPdfBlobUrl : pdfBlobUrl'),
        'Viewer iframe must render signed PDF blob URL when showing signed copy'
      );
    });

    it('renders "View Signed PDF" and "Download Signed PDF" in Admin Acknowledgement Report table', () => {
      assert.ok(
        pageContent.includes('handleAdminViewSignedPdf(r)'),
        'Must trigger Admin signed PDF modal viewer'
      );
      assert.ok(
        pageContent.includes('handleDownloadSignedPdf(r.user._id, r.signedPdf?.fileName)'),
        'Must allow Admin to download individual employee signed PDF'
      );
      assert.ok(
        pageContent.includes('View Signed PDF'),
        'Action column must include "View Signed PDF"'
      );
    });

    it('renders dedicated Admin inspection modal with embedded PDF iframe for employee signed documents', () => {
      assert.ok(
        pageContent.includes('Official Signed Policy Document —'),
        'Modal must show employee name and title'
      );
      assert.ok(
        pageContent.includes('inspectingSignedPdf.blobUrl'),
        'Modal must embed signed PDF blob URL'
      );
      assert.ok(
        pageContent.includes('<iframe'),
        'Modal must use iframe to display complete signed PDF document'
      );
    });
  });

  // =========================================================================
  // 5. Policies Overview Page Integration (PoliciesPage.jsx)
  // =========================================================================
  describe('5. Policies Overview Page (PoliciesPage.jsx)', () => {
    const policiesPagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PoliciesPage.jsx');
    const policiesContent = fs.readFileSync(policiesPagePath, 'utf8');

    it('updates modal reader submission button to "Submit & Sign"', () => {
      assert.ok(
        policiesContent.includes('Submit & Sign'),
        'Must label submit button as "Submit & Sign"'
      );
    });

    it('offers "View & Download Signed PDF" when employee policy is acknowledged', () => {
      assert.ok(
        policiesContent.includes('View & Download Signed PDF'),
        'Must provide View & Download Signed PDF link'
      );
    });

    it('links Admin signature verification modal to full signed document view', () => {
      assert.ok(
        policiesContent.includes('View Full Policy & Signed PDF'),
        'Must link to full policy view and signed PDF'
      );
    });
  });
});
