import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Verifying Policy Modal Scrolling Configuration ---');

const cssPath = path.resolve(__dirname, '../frontend/src/index.css');
const jsxPath = path.resolve(__dirname, '../frontend/src/pages/PoliciesPage.jsx');

const cssContent = fs.readFileSync(cssPath, 'utf8');
const jsxContent = fs.readFileSync(jsxPath, 'utf8');

// 1. Verify CSS styles for modal-dialog-scrollable and form inside modal
const checks = [
  {
    name: 'CSS: .modal-dialog-scrollable max-height 88vh',
    pass: cssContent.includes('max-height: 88vh;')
  },
  {
    name: 'CSS: .modal-dialog-scrollable .modal-content flex column and overflow hidden',
    pass: cssContent.includes('.modal-dialog-scrollable .modal-content') &&
          cssContent.includes('overflow: hidden;')
  },
  {
    name: 'CSS: .modal-dialog-scrollable form flex chain (min-height: 0, flex-grow: 1)',
    pass: cssContent.includes('.modal-dialog-scrollable form') &&
          cssContent.includes('min-height: 0;') &&
          cssContent.includes('flex-grow: 1;')
  },
  {
    name: 'CSS: .modal-header & .modal-footer flex-shrink: 0',
    pass: cssContent.includes('.modal-dialog-scrollable .modal-header') &&
          cssContent.includes('flex-shrink: 0;')
  },
  {
    name: 'CSS: .modal-dialog-scrollable .modal-body overflow-y: auto',
    pass: cssContent.includes('.modal-dialog-scrollable .modal-body') &&
          cssContent.includes('overflow-y: auto !important;')
  },
  {
    name: 'CSS: Sleek scrollbar styling for .modal-body',
    pass: cssContent.includes('.modal-dialog-scrollable .modal-body::-webkit-scrollbar')
  },
  {
    name: 'JSX: Background scroll lock useEffect on document.body.style.overflow',
    pass: jsxContent.includes("document.body.style.overflow = 'hidden'") &&
          jsxContent.includes('isAnyModalOpen')
  },
  {
    name: 'JSX: Modal 2 dialog max-height 88vh',
    pass: jsxContent.includes("maxHeight: '88vh'")
  },
  {
    name: 'JSX: Modal 2 form has flex-column, flex-grow-1, minHeight: 0',
    pass: jsxContent.includes('className="d-flex flex-column flex-grow-1"') &&
          jsxContent.includes("minHeight: 0")
  },
  {
    name: 'JSX: Modal 2 header has flex-shrink-0',
    pass: jsxContent.includes('modal-header bg-light py-3 px-4 border-bottom flex-shrink-0')
  },
  {
    name: 'JSX: Modal 2 body has overflowY: auto and overscrollBehavior: contain',
    pass: jsxContent.includes("overflowY: 'auto'") &&
          jsxContent.includes("overscrollBehavior: 'contain'")
  },
  {
    name: 'JSX: Modal 2 footer has flex-shrink-0 and contains Cancel & Save buttons',
    pass: jsxContent.includes('modal-footer bg-light py-2 px-4 border-top flex-shrink-0') &&
          jsxContent.includes('Cancel') &&
          jsxContent.includes('Save Revision & Increment Version')
  },
  {
    name: 'JSX: All form fields preserved (title, category, effectiveDate, status, changeSummary, content)',
    pass: jsxContent.includes('policyForm.title') &&
          jsxContent.includes('policyForm.category') &&
          jsxContent.includes('policyForm.effectiveDate') &&
          jsxContent.includes('policyForm.status') &&
          jsxContent.includes('policyForm.changeSummary') &&
          jsxContent.includes('policyForm.content')
  }
];

let allPassed = true;
checks.forEach((c) => {
  if (c.pass) {
    console.log(`[PASS] ${c.name}`);
  } else {
    console.error(`[FAIL] ${c.name}`);
    allPassed = false;
  }
});

if (!allPassed) {
  process.exit(1);
}

console.log('\n--- All Policy Modal Scroll checks passed successfully! ---');

