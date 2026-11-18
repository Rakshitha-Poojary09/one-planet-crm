import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory where individual signed PDFs are securely stored
export const SIGNED_POLICIES_DIR = path.resolve(__dirname, '../uploads/policies/signed');

// Ensure directory exists securely
if (!fs.existsSync(SIGNED_POLICIES_DIR)) {
  fs.mkdirSync(SIGNED_POLICIES_DIR, { recursive: true });
}

/**
 * Sanitize strings for safe, clean filenames.
 */
export const sanitizeForFilename = (str) =>
  String(str || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Generate standardized employee signed filename according to specification:
 * e.g., Company_Leave_Policy_Rakshitha_OPT1011_Signed.pdf
 */
export const generateSignedPdfFilename = (policyTitle, originalPdfName, employeeName, employeeId, version = 1) => {
  const baseTitle = sanitizeForFilename(
    originalPdfName ? originalPdfName.replace(/\.pdf$/i, '') : policyTitle
  );
  const cleanEmpName = sanitizeForFilename(employeeName || 'Employee');
  const cleanEmpId = sanitizeForFilename(employeeId || 'ID');
  
  return `${baseTitle}_${cleanEmpName}_${cleanEmpId}_Signed.pdf`;
};

/**
 * Helper to wrap text into lines that fit within a specified max width.
 */
function wrapText(text, maxWidth, font, fontSize) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Core function to embed an employee's drawn signature into their individual PDF copy.
 *
 * @param {Object} options
 * @param {string} options.originalPdfPath - Path to the original policy PDF file on disk.
 * @param {Object} options.policy - Policy document object { title, version, category, effectiveDate, content }.
 * @param {Object} options.employee - Employee object { fullName, employeeId, email, department }.
 * @param {string} options.signatureDataUrl - Base64 data URL of the drawn signature (data:image/png;base64,...).
 * @param {string} options.statement - Acknowledgement statement confirmed by employee.
 * @param {Date}   options.acknowledgedAt - Timestamp of acknowledgement.
 * @param {string} options.ipAddress - Client IP address.
 * @param {string} options.userAgent - Client User Agent string.
 * @returns {Promise<{ fileName: string, filePath: string, fileSize: number, pageCount: number }>}
 */
export async function embedSignatureIntoPolicyPdf({
  originalPdfPath,
  policy,
  employee,
  signatureDataUrl,
  statement,
  acknowledgedAt = new Date(),
  ipAddress = '',
  userAgent = '',
}) {
  let pdfDoc;

  // 1. Load the original PDF if present, or create a new document
  if (originalPdfPath && fs.existsSync(originalPdfPath)) {
    const originalBytes = fs.readFileSync(originalPdfPath);
    pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  } else {
    // Fallback: Create a clean document from policy text
    pdfDoc = await PDFDocument.create();
    const fallbackPage = pdfDoc.addPage([595.28, 841.89]);
    const fFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    fallbackPage.drawText(policy.title || 'Company Policy', {
      x: 50,
      y: 780,
      size: 20,
      font: fBold,
      color: rgb(0.06, 0.32, 0.2),
    });
    fallbackPage.drawText(`Category: ${policy.category || 'General'}  •  Version: ${policy.version || 1}`, {
      x: 50,
      y: 755,
      size: 10,
      font: fFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Draw policy description / content if present
    const contentText = policy.description || policy.content || 'Company policy guidelines document.';
    const bodyLines = wrapText(contentText, 495, fFont, 10);
    let curY = 720;
    for (const line of bodyLines.slice(0, 35)) {
      fallbackPage.drawText(line, { x: 50, y: curY, size: 10, font: fFont, color: rgb(0.1, 0.1, 0.1) });
      curY -= 15;
    }
  }

  // 2. Embed the drawn signature image (PNG / JPEG)
  let signatureImage;
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/')) {
    const base64Content = signatureDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const imageBytes = Buffer.from(base64Content, 'base64');
    
    if (signatureDataUrl.startsWith('data:image/jpeg') || signatureDataUrl.startsWith('data:image/jpg')) {
      signatureImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      signatureImage = await pdfDoc.embedPng(imageBytes);
    }
  }

  // 3. Embed standard fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // 4. Create the dedicated, executive-formatted Acknowledgement & Signature Certificate Page
  // Standard A4: 595.28 x 841.89
  const certPage = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 523.28

  // Palette tokens
  const colorForest = rgb(15 / 255, 81 / 255, 50 / 255);       // #0F5132 - One Planet Brand Green
  const colorForestLight = rgb(232 / 255, 245 / 255, 233 / 255); // #E8F5E9
  const colorDark = rgb(15 / 255, 23 / 255, 42 / 255);          // #0F172A
  const colorMuted = rgb(100 / 255, 116 / 255, 139 / 255);      // #64748B
  const colorBorder = rgb(226 / 255, 232 / 255, 240 / 255);     // #E2E8F0
  const colorBgLight = rgb(248 / 255, 250 / 255, 252 / 255);    // #F8FAFC
  const colorWhite = rgb(1, 1, 1);

  // --- A. PAGE OUTER BORDER ---
  certPage.drawRectangle({
    x: margin - 6,
    y: margin - 6,
    width: contentWidth + 12,
    height: pageHeight - (margin - 6) * 2,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  // --- B. HEADER BRAND BAR ---
  const headerY = pageHeight - margin - 44;
  certPage.drawRectangle({
    x: margin,
    y: headerY,
    width: contentWidth,
    height: 44,
    color: colorForest,
  });

  certPage.drawText('ONE PLANET TECHNOLOGIES', {
    x: margin + 14,
    y: headerY + 25,
    size: 11,
    font: fontHelveticaBold,
    color: colorWhite,
  });
  certPage.drawText('POLICY ACKNOWLEDGEMENT & ELECTRONIC SIGNATURE RECORD', {
    x: margin + 14,
    y: headerY + 11,
    size: 8.5,
    font: fontHelveticaBold,
    color: rgb(220 / 255, 252 / 255, 231 / 255), // light mint
  });
  certPage.drawText('OFFICIAL COPY', {
    x: margin + contentWidth - 85,
    y: headerY + 18,
    size: 9,
    font: fontHelveticaBold,
    color: colorWhite,
  });

  let curY = headerY - 18;

  // --- C. SECTION 1: POLICY DETAILS ---
  certPage.drawText('1. Policy Document Overview', {
    x: margin,
    y: curY,
    size: 10,
    font: fontHelveticaBold,
    color: colorForest,
  });
  curY -= 6;

  // Policy Details Container
  const policyCardHeight = 56;
  const policyCardY = curY - policyCardHeight;
  certPage.drawRectangle({
    x: margin,
    y: policyCardY,
    width: contentWidth,
    height: policyCardHeight,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  // Row 1: Title & Version
  certPage.drawText('Policy Title:', {
    x: margin + 12,
    y: policyCardY + 36,
    size: 8.5,
    font: fontHelveticaBold,
    color: colorMuted,
  });
  certPage.drawText(String(policy.title || 'Untitled Policy').substring(0, 50), {
    x: margin + 75,
    y: policyCardY + 36,
    size: 9,
    font: fontHelveticaBold,
    color: colorDark,
  });

  certPage.drawText('Version:', {
    x: margin + contentWidth - 140,
    y: policyCardY + 36,
    size: 8.5,
    font: fontHelveticaBold,
    color: colorMuted,
  });
  certPage.drawText(`v${policy.version || 1}.0 (Official Published)`, {
    x: margin + contentWidth - 95,
    y: policyCardY + 36,
    size: 8.5,
    font: fontHelvetica,
    color: colorDark,
  });

  // Row 2: Category & Effective Date
  certPage.drawText('Category:', {
    x: margin + 12,
    y: policyCardY + 16,
    size: 8.5,
    font: fontHelveticaBold,
    color: colorMuted,
  });
  certPage.drawText(String(policy.category || 'General Corporate'), {
    x: margin + 75,
    y: policyCardY + 16,
    size: 8.5,
    font: fontHelvetica,
    color: colorDark,
  });

  certPage.drawText('Effective:', {
    x: margin + contentWidth - 140,
    y: policyCardY + 16,
    size: 8.5,
    font: fontHelveticaBold,
    color: colorMuted,
  });
  const effDateStr = policy.effectiveDate
    ? new Date(policy.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Immediate';
  certPage.drawText(effDateStr, {
    x: margin + contentWidth - 95,
    y: policyCardY + 16,
    size: 8.5,
    font: fontHelvetica,
    color: colorDark,
  });

  curY = policyCardY - 16;

  // --- D. SECTION 2: SIGNATORY EMPLOYEE DETAILS ---
  certPage.drawText('2. Signatory Employee Information', {
    x: margin,
    y: curY,
    size: 10,
    font: fontHelveticaBold,
    color: colorForest,
  });
  curY -= 6;

  const empCardHeight = 62;
  const empCardY = curY - empCardHeight;
  certPage.drawRectangle({
    x: margin,
    y: empCardY,
    width: contentWidth,
    height: empCardHeight,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  // Employee details in two columns
  const col1X = margin + 12;
  const col2X = margin + contentWidth / 2 + 10;

  certPage.drawText('Employee Name:', { x: col1X, y: empCardY + 44, size: 8.5, font: fontHelveticaBold, color: colorMuted });
  certPage.drawText(String(employee.fullName || 'Employee').substring(0, 32), { x: col1X + 85, y: empCardY + 44, size: 9, font: fontHelveticaBold, color: colorDark });

  certPage.drawText('Employee ID:', { x: col2X, y: empCardY + 44, size: 8.5, font: fontHelveticaBold, color: colorMuted });
  certPage.drawText(String(employee.employeeId || 'N/A'), { x: col2X + 75, y: empCardY + 44, size: 9, font: fontHelveticaBold, color: colorForest });

  certPage.drawText('Department:', { x: col1X, y: empCardY + 26, size: 8.5, font: fontHelveticaBold, color: colorMuted });
  certPage.drawText(String(employee.department || 'Operations').substring(0, 28), { x: col1X + 85, y: empCardY + 26, size: 8.5, font: fontHelvetica, color: colorDark });

  certPage.drawText('Work Email:', { x: col2X, y: empCardY + 26, size: 8.5, font: fontHelveticaBold, color: colorMuted });
  certPage.drawText(String(employee.email || 'N/A').substring(0, 30), { x: col2X + 75, y: empCardY + 26, size: 8.5, font: fontHelvetica, color: colorDark });

  const ackDateObj = new Date(acknowledgedAt);
  const ackDateFullStr = ackDateObj.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  certPage.drawText('Signed Date/Time:', { x: col1X, y: empCardY + 8, size: 8.5, font: fontHelveticaBold, color: colorMuted });
  certPage.drawText(ackDateFullStr, { x: col1X + 85, y: empCardY + 8, size: 8.5, font: fontHelveticaBold, color: colorDark });

  curY = empCardY - 16;

  // --- E. SECTION 3: MANDATORY ACKNOWLEDGEMENT STATEMENT ---
  certPage.drawText('3. Mandatory Acknowledgement Statement', {
    x: margin,
    y: curY,
    size: 10,
    font: fontHelveticaBold,
    color: colorForest,
  });
  curY -= 6;

  const defaultStatement =
    'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.';
  const finalStatementText = statement && statement.trim() ? statement.trim() : defaultStatement;
  const statementLines = wrapText(`"${finalStatementText}"`, contentWidth - 28, fontHelveticaOblique, 9);
  
  const statementHeight = Math.max(38, statementLines.length * 13 + 18);
  const statementY = curY - statementHeight;

  certPage.drawRectangle({
    x: margin,
    y: statementY,
    width: contentWidth,
    height: statementHeight,
    color: colorForestLight,
    borderColor: rgb(167 / 255, 243 / 255, 208 / 255), // light green border
    borderWidth: 1,
  });

  let stY = statementY + statementHeight - 14;
  for (const line of statementLines) {
    certPage.drawText(line, {
      x: margin + 14,
      y: stY,
      size: 9,
      font: fontHelveticaOblique,
      color: colorForest,
    });
    stY -= 13;
  }

  curY = statementY - 16;

  // --- F. SECTION 4: EMBEDDED DRAWN SIGNATURE FRAME ---
  certPage.drawText('4. Employee Drawn Digital Signature', {
    x: margin,
    y: curY,
    size: 10,
    font: fontHelveticaBold,
    color: colorForest,
  });
  curY -= 6;

  const sigBoxHeight = 110;
  const sigBoxY = curY - sigBoxHeight;

  certPage.drawRectangle({
    x: margin,
    y: sigBoxY,
    width: contentWidth,
    height: sigBoxHeight,
    color: colorWhite,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  // Signature display zone
  const sigInnerWidth = 260;
  const sigInnerHeight = 65;
  const sigInnerX = margin + 16;
  const sigInnerY = sigBoxY + 32;

  // Light dashed border / background for signature pad area
  certPage.drawRectangle({
    x: sigInnerX,
    y: sigInnerY,
    width: sigInnerWidth,
    height: sigInnerHeight,
    color: rgb(250 / 255, 250 / 255, 250 / 255),
    borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
    borderWidth: 1,
  });

  if (signatureImage) {
    // Preserve aspect ratio and fit inside the signature box
    const imgDims = signatureImage.scaleToFit(sigInnerWidth - 16, sigInnerHeight - 10);
    const imgX = sigInnerX + (sigInnerWidth - imgDims.width) / 2;
    const imgY = sigInnerY + (sigInnerHeight - imgDims.height) / 2;
    certPage.drawImage(signatureImage, {
      x: imgX,
      y: imgY,
      width: imgDims.width,
      height: imgDims.height,
    });
  } else {
    certPage.drawText('[Electronic Signature Recorded on File]', {
      x: sigInnerX + 25,
      y: sigInnerY + 28,
      size: 9,
      font: fontHelveticaOblique,
      color: colorMuted,
    });
  }

  // Under-signature metadata
  certPage.drawText(`Digitally Drawn by: ${employee.fullName || 'Employee'} (${employee.employeeId || 'ID'})`, {
    x: sigInnerX,
    y: sigBoxY + 16,
    size: 8,
    font: fontHelveticaBold,
    color: colorDark,
  });
  certPage.drawText(`Signature Recorded: ${ackDateFullStr}`, {
    x: sigInnerX,
    y: sigBoxY + 6,
    size: 7.5,
    font: fontHelvetica,
    color: colorMuted,
  });

  // Right-hand status stamp inside signature box
  const stampX = margin + contentWidth - 195;
  const stampY = sigBoxY + 28;
  certPage.drawRectangle({
    x: stampX,
    y: stampY,
    width: 180,
    height: 70,
    color: colorForestLight,
    borderColor: colorForest,
    borderWidth: 1,
  });

  certPage.drawText('ELECTRONICALLY VERIFIED', {
    x: stampX + 16,
    y: stampY + 52,
    size: 9,
    font: fontHelveticaBold,
    color: colorForest,
  });
  certPage.drawText('Status: Policy Acknowledged', {
    x: stampX + 16,
    y: stampY + 38,
    size: 8,
    font: fontHelveticaBold,
    color: colorDark,
  });
  certPage.drawText(`Version: v${policy.version}.0`, {
    x: stampX + 16,
    y: stampY + 26,
    size: 7.5,
    font: fontHelvetica,
    color: colorMuted,
  });
  certPage.drawText(`ID: ${employee.employeeId}`, {
    x: stampX + 16,
    y: stampY + 14,
    size: 7.5,
    font: fontHelvetica,
    color: colorMuted,
  });

  curY = sigBoxY - 16;

  // --- G. SECTION 5: SYSTEM AUDIT & SECURITY METADATA ---
  certPage.drawText('5. Compliance Audit & Security Metadata', {
    x: margin,
    y: curY,
    size: 9.5,
    font: fontHelveticaBold,
    color: colorForest,
  });
  curY -= 6;

  const auditBoxHeight = 48;
  const auditBoxY = curY - auditBoxHeight;
  certPage.drawRectangle({
    x: margin,
    y: auditBoxY,
    width: contentWidth,
    height: auditBoxHeight,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const ipStr = ipAddress && String(ipAddress).trim() ? String(ipAddress) : '127.0.0.1 (Internal CRM Client)';
  certPage.drawText(`Recorded IP Address: ${ipStr}`, {
    x: margin + 12,
    y: auditBoxY + 32,
    size: 7.5,
    font: fontHelvetica,
    color: colorDark,
  });

  const uaShort = userAgent ? String(userAgent).substring(0, 85) : 'One Planet CRM Web Client';
  certPage.drawText(`User Agent: ${uaShort}`, {
    x: margin + 12,
    y: auditBoxY + 20,
    size: 7,
    font: fontHelvetica,
    color: colorMuted,
  });

  certPage.drawText('Internal Compliance Record: This document is an official electronic acknowledgement stored in One Planet CRM.', {
    x: margin + 12,
    y: auditBoxY + 8,
    size: 7,
    font: fontHelveticaOblique,
    color: colorForest,
  });

  // --- H. FOOTER NOTICE ---
  certPage.drawText('One Planet Technologies Enterprise CRM • Internal Compliance System • Document Generated & Signed Automatically', {
    x: margin,
    y: margin + 2,
    size: 7,
    font: fontHelvetica,
    color: colorMuted,
  });

  // 5. Save the signed PDF
  const signedPdfBytes = await pdfDoc.save();

  // 6. Generate filename & persist
  const signedFileName = generateSignedPdfFilename(
    policy.title,
    policy.pdfFile?.originalName,
    employee.fullName,
    employee.employeeId,
    policy.version
  );

  const destinationPath = path.join(SIGNED_POLICIES_DIR, signedFileName);
  fs.writeFileSync(destinationPath, signedPdfBytes);

  return {
    fileName: signedFileName,
    filePath: destinationPath,
    fileSize: signedPdfBytes.length,
    pageCount: pdfDoc.getPageCount(),
  };
}

