import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { CompanyPolicy } from '../models/CompanyPolicy.js';
import { PolicyAcknowledgement } from '../models/PolicyAcknowledgement.js';
import { PolicyQuestion } from '../models/PolicyQuestion.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { Department } from '../models/Department.js';
import { logAudit } from '../utils/audit.js';
import { embedSignatureIntoPolicyPdf } from '../utils/pdfSigner.js';

/**
 * Helper to determine targeted active users for a policy
 */
export const getTargetedUsers = async (policy) => {
  const query = { employmentStatus: 'Active' };

  if (policy.targetAudience === 'Departments' && policy.targetDepartments?.length > 0) {
    query.department = { $in: policy.targetDepartments };
  } else if (policy.targetRoles?.length > 0 && policy.targetAudience === 'Roles') {
    query.role = { $in: policy.targetRoles };
  }

  return await User.find(query)
    .select('fullName employeeId email role department designation employmentStatus')
    .populate('department', 'name')
    .sort({ fullName: 1 })
    .lean();
};

/**
 * Helper to check if a user is targeted by a policy
 */
export const isUserTargeted = (user, policy) => {
  if (user.role === 'Admin') return true;
  if (!policy.targetAudience || policy.targetAudience === 'All') return true;

  if (policy.targetAudience === 'Departments' && policy.targetDepartments?.length > 0) {
    const userDeptId = String(user.department?._id || user.department || '');
    return policy.targetDepartments.some((d) => String(d._id || d) === userDeptId);
  }

  if (policy.targetAudience === 'Roles' && policy.targetRoles?.length > 0) {
    return policy.targetRoles.includes(user.role);
  }

  return true;
};

/**
 * Creates individual policy assignments for every active employee without duplicates
 */
export const assignPolicyToAllActiveEmployees = async (policy) => {
  try {
    const targetedUsers = await getTargetedUsers(policy);
    if (!targetedUsers || targetedUsers.length === 0) return 0;

    const bulkOps = targetedUsers.map((emp) => ({
      updateOne: {
        filter: {
          policy: policy._id,
          user: emp._id,
          policyVersion: policy.version,
        },
        update: {
          $setOnInsert: {
            policy: policy._id,
            user: emp._id,
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            policyVersion: policy.version,
            publishedAt: policy.publishedAt || new Date(),
            firstOpenedAt: null,
            latestOpenedAt: null,
            isAcknowledged: false,
            status: 'Not Opened',
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      const result = await PolicyAcknowledgement.bulkWrite(bulkOps);
      return result.upsertedCount || 0;
    }
    return 0;
  } catch (err) {
    console.error('[assignPolicyToAllActiveEmployees] Error:', err);
    return 0;
  }
};

/**
 * 1. GET /api/policies
 * List company policies.
 * - Admin: sees all policies (Draft, Published, Archived) with compliance stats
 * - Manager & Employee: sees only Published policies that target them
 */
export const getPolicies = async (req, res) => {
  try {
    const { status, category, search, acknowledgementStatus } = req.query;
    const isAdmin = req.user.role === 'Admin';

    const filter = {};

    if (!isAdmin) {
      filter.status = 'Published';
    } else if (status && status !== 'All') {
      filter.status = status;
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }

    let policies = await CompanyPolicy.find(filter)
      .populate('createdBy', 'fullName employeeId email role')
      .populate('updatedBy', 'fullName employeeId email role')
      .populate('targetDepartments', 'name')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (!isAdmin) {
      policies = policies.filter((p) => isUserTargeted(req.user, p));
    }

    const totalActiveEmployees = await User.countDocuments({
      employmentStatus: 'Active',
    });

    const policyIds = policies.map((p) => p._id);

    // Fetch user's own acknowledgements across returned policies
    const myAcknowledgements = await PolicyAcknowledgement.find({
      policy: { $in: policyIds },
      user: req.user._id,
    }).lean();

    const myAckMap = new Map();
    for (const ack of myAcknowledgements) {
      const key = `${ack.policy}_${ack.policyVersion}`;
      myAckMap.set(key, ack);
    }

    // Compute admin compliance stats per policy
    let policyStatsMap = new Map();
    if (isAdmin && policyIds.length > 0) {
      const statsAgg = await PolicyAcknowledgement.aggregate([
        { $match: { policy: { $in: policyIds } } },
        {
          $group: {
            _id: { policy: '$policy', version: '$policyVersion' },
            totalAssigned: { $sum: 1 },
            acknowledgedCount: {
              $sum: { $cond: [{ $eq: ['$isAcknowledged', true] }, 1, 0] },
            },
            openedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$isAcknowledged', false] },
                      { $ne: ['$firstOpenedAt', null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            notOpenedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$isAcknowledged', false] },
                      { $eq: ['$firstOpenedAt', null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      for (const item of statsAgg) {
        const key = `${item._id.policy}_${item._id.version}`;
        policyStatsMap.set(key, item);
      }
    }

    // Enhance policies with user-specific and admin-specific metrics
    let enhancedPolicies = await Promise.all(
      policies.map(async (p) => {
        const myAck = myAckMap.get(`${p._id}_${p.version}`);
        const isAcknowledged = !!myAck && myAck.isAcknowledged === true;
        const hasOpened = !!myAck && !!myAck.firstOpenedAt;
        const statusForUser = isAcknowledged
          ? 'Acknowledged'
          : hasOpened
          ? 'Opened'
          : 'Not Opened';

        const base = {
          ...p,
          hasPdf: !!(p.pdfFile && p.pdfFile.fileName),
          pdfName: p.pdfFile?.originalName || '',
          pdfSize: p.pdfFile?.fileSize || 0,
          isAcknowledged,
          firstOpenedAt: myAck?.firstOpenedAt || null,
          latestOpenedAt: myAck?.latestOpenedAt || null,
          acknowledgedAt: myAck?.acknowledgedAt || null,
          acknowledgedVersion: myAck?.policyVersion || null,
          isCurrentVersionAcknowledged: isAcknowledged,
          statusForUser,
          hasSignature: !!myAck?.signatureImage,
        };

        if (isAdmin) {
          const targetedUsers = await getTargetedUsers(p);
          const targetedCount = targetedUsers.length;
          const stats = policyStatsMap.get(`${p._id}_${p.version}`) || {
            acknowledgedCount: 0,
            openedCount: 0,
            notOpenedCount: targetedCount,
            totalAssigned: targetedCount,
          };

          const ackCount = stats.acknowledgedCount || 0;
          base.complianceStats = {
            totalAssigned: targetedCount,
            acknowledgedCount: ackCount,
            openedNotAcknowledgedCount: stats.openedCount || 0,
            notOpenedCount: stats.notOpenedCount || Math.max(0, targetedCount - ackCount),
            pendingCount: Math.max(0, targetedCount - ackCount),
            compliancePercentage:
              targetedCount > 0 ? Math.round((ackCount / targetedCount) * 100) : 0,
          };
        }

        return base;
      })
    );

    // Apply Employee acknowledgement status filter if specified
    if (!isAdmin && acknowledgementStatus && acknowledgementStatus !== 'All') {
      enhancedPolicies = enhancedPolicies.filter((p) => {
        if (acknowledgementStatus === 'Acknowledged') return p.statusForUser === 'Acknowledged';
        if (acknowledgementStatus === 'Opened') return p.statusForUser === 'Opened';
        if (acknowledgementStatus === 'Not Opened') return p.statusForUser === 'Not Opened';
        return true;
      });
    }

    return res.json({
      success: true,
      count: enhancedPolicies.length,
      policies: enhancedPolicies,
      totalActiveEmployees,
    });
  } catch (error) {
    console.error('[PolicyController.getPolicies] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve company policies.',
      error: error.message,
    });
  }
};

/**
 * 2. GET /api/policies/:id
 * Retrieve a single policy with details.
 */
export const getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'Admin';

    const policy = await CompanyPolicy.findById(id)
      .populate('createdBy', 'fullName employeeId email role designation')
      .populate('updatedBy', 'fullName employeeId email role designation')
      .populate('targetDepartments', 'name')
      .populate('versionHistory.updatedBy', 'fullName employeeId email role');

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found.',
      });
    }

    if (!isAdmin && policy.status !== 'Published') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This policy is not currently published.',
      });
    }

    if (!isUserTargeted(req.user, policy)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This policy is not designated for your department/role.',
      });
    }

    // Current user's acknowledgement / assignment record
    const myAck = await PolicyAcknowledgement.findOne({
      policy: policy._id,
      user: req.user._id,
      policyVersion: policy.version,
    }).lean();

    const policyObj = policy.toObject();
    const isAcknowledged = !!myAck && myAck.isAcknowledged === true;
    policyObj.hasPdf = !!(policy.pdfFile && policy.pdfFile.fileName);
    policyObj.isAcknowledged = isAcknowledged;
    policyObj.firstOpenedAt = myAck?.firstOpenedAt || null;
    policyObj.latestOpenedAt = myAck?.latestOpenedAt || null;
    policyObj.acknowledgedAt = myAck?.acknowledgedAt || null;
    policyObj.statusForUser = isAcknowledged
      ? 'Acknowledged'
      : myAck?.firstOpenedAt
      ? 'Opened'
      : 'Not Opened';
    policyObj.mySignature = isAcknowledged ? myAck?.signatureImage || '' : '';
    policyObj.myStatement = myAck?.statement || '';
    policyObj.signedPdf = isAcknowledged && myAck?.signedPdf?.status === 'Generated' ? {
      fileName: myAck.signedPdf.fileName,
      fileSize: myAck.signedPdf.fileSize,
      generatedAt: myAck.signedPdf.generatedAt,
      hasSignedPdf: true,
    } : null;
    policyObj.hasSignedPdf = isAcknowledged && !!(myAck?.signedPdf?.fileName || myAck?.signatureImage);

    return res.json({
      success: true,
      policy: policyObj,
    });
  } catch (error) {
    console.error('[PolicyController.getPolicyById] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve policy details.',
      error: error.message,
    });
  }
};

/**
 * 3. GET /api/policies/:id/pdf
 * Secure authenticated streaming of policy PDF.
 * Never exposes private files via unrestricted public URLs.
 */
export const streamPolicyPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await CompanyPolicy.findById(id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    // Permission check
    if (req.user.role !== 'Admin') {
      if (policy.status !== 'Published') {
        return res.status(403).json({ success: false, message: 'Policy is not published.' });
      }
      if (!isUserTargeted(req.user, policy)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    if (!policy.pdfFile || !policy.pdfFile.filePath) {
      return res.status(404).json({ success: false, message: 'No PDF file associated with this policy.' });
    }

    const filePath = path.resolve(policy.pdfFile.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'PDF document file not found on server.' });
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${policy.pdfFile.originalName || 'policy.pdf'}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('[PolicyController.streamPolicyPdf] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load policy PDF document.',
      error: error.message,
    });
  }
};

/**
 * 3b. GET /api/policies/:id/signed-pdf
 *     GET /api/policies/:id/signed-pdf/:userId
 * Secure authenticated streaming or download of an employee's individual signed policy PDF.
 * Never exposes private files via unrestricted public URLs.
 * Employees can only access their own signed PDF; Admins can access any authorized employee's signed PDF.
 */
export const streamSignedPolicyPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const isDownload = req.query.download === 'true' || req.path.endsWith('/download');
    const targetUserId = req.params.userId || req.user._id;

    // Security check: Non-admin users can ONLY access their own signed PDF
    if (req.user.role !== 'Admin' && String(targetUserId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own signed policy document.',
      });
    }

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    // Find the acknowledgement record
    const ack = await PolicyAcknowledgement.findOne({
      policy: policy._id,
      user: targetUserId,
      policyVersion: policy.version,
      isAcknowledged: true,
    });

    if (!ack) {
      return res.status(404).json({
        success: false,
        message: 'No acknowledgement record found for this employee and policy version.',
      });
    }

    // If signed PDF file does not exist on disk, attempt to generate it on-the-fly from signatureImage
    let filePath = ack.signedPdf?.filePath ? path.resolve(ack.signedPdf.filePath) : null;
    let fileExists = filePath && fs.existsSync(filePath);

    if (!fileExists && ack.signatureImage) {
      try {
        const signatoryUser = await User.findById(targetUserId).populate('department');
        const pdfMeta = await embedSignatureIntoPolicyPdf({
          originalPdfPath: policy.pdfFile?.filePath,
          policy,
          employee: {
            fullName: signatoryUser?.fullName || ack.employeeName || 'Employee',
            employeeId: signatoryUser?.employeeId || ack.employeeId || 'ID',
            email: signatoryUser?.email || '',
            department: signatoryUser?.department?.name || 'Operations',
          },
          signatureDataUrl: ack.signatureImage,
          statement: ack.statement,
          acknowledgedAt: ack.acknowledgedAt || new Date(),
          ipAddress: ack.ipAddress || '',
          userAgent: ack.userAgent || '',
        });

        ack.signedPdf = {
          fileName: pdfMeta.fileName,
          filePath: pdfMeta.filePath,
          fileSize: pdfMeta.fileSize,
          pageCount: pdfMeta.pageCount,
          generatedAt: ack.acknowledgedAt || new Date(),
          status: 'Generated',
        };
        ack.originalPdf = {
          fileName: policy.pdfFile?.originalName || policy.pdfFile?.fileName || '',
          filePath: policy.pdfFile?.filePath || '',
        };
        await ack.save();

        filePath = path.resolve(pdfMeta.filePath);
        fileExists = fs.existsSync(filePath);
      } catch (genErr) {
        console.error('[PolicyController.streamSignedPolicyPdf] On-the-fly generation error:', genErr);
      }
    }

    if (!fileExists || !filePath) {
      return res.status(404).json({
        success: false,
        message: 'The individual signed PDF document has not yet been generated for this acknowledgement.',
      });
    }

    const stat = fs.statSync(filePath);
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const downloadFileName = ack.signedPdf?.fileName || `Policy_${policy.version}_Signed.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(downloadFileName)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('[PolicyController.streamSignedPolicyPdf] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to stream signed policy PDF.',
      error: error.message,
    });
  }
};

/**
 * 4. POST /api/policies/:id/track-open
 * Records first-opened and latest-opened timestamps when employee views the policy PDF.
 * Opening or scrolling does NOT mark the policy as read or acknowledged.
 */
export const trackPolicyOpen = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    if (policy.status !== 'Published' && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Policy is not published.' });
    }

    const now = new Date();

    let ackRecord = await PolicyAcknowledgement.findOne({
      policy: policy._id,
      user: req.user._id,
      policyVersion: policy.version,
    });

    if (!ackRecord) {
      ackRecord = new PolicyAcknowledgement({
        policy: policy._id,
        user: req.user._id,
        employeeId: req.user.employeeId,
        employeeName: req.user.fullName,
        policyVersion: policy.version,
        publishedAt: policy.publishedAt || policy.createdAt,
        firstOpenedAt: now,
        latestOpenedAt: now,
        isAcknowledged: false,
        status: 'Opened',
      });
      await ackRecord.save();
    } else {
      if (!ackRecord.firstOpenedAt) {
        ackRecord.firstOpenedAt = now;
      }
      ackRecord.latestOpenedAt = now;
      if (!ackRecord.isAcknowledged && ackRecord.status === 'Not Opened') {
        ackRecord.status = 'Opened';
      }
      await ackRecord.save();
    }

    return res.json({
      success: true,
      firstOpenedAt: ackRecord.firstOpenedAt,
      latestOpenedAt: ackRecord.latestOpenedAt,
      isAcknowledged: ackRecord.isAcknowledged,
      status: ackRecord.status,
      message: 'Document open recorded.',
    });
  } catch (error) {
    console.error('[PolicyController.trackPolicyOpen] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record policy view.',
      error: error.message,
    });
  }
};

/**
 * 5. POST /api/policies/:id/acknowledge
 * Employee signs and acknowledges policy with a drawn digital signature.
 * Prevents duplicate acknowledgements for the same version.
 */
export const acknowledgePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { statement, signatureImage } = req.body;

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    if (policy.status !== 'Published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot acknowledge an unpublished or archived policy.',
      });
    }

    if (!isUserTargeted(req.user, policy)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a designated recipient of this policy.',
      });
    }

    // Role security: Admin cannot submit an acknowledgement on behalf of an employee
    if (req.body.targetUserId && String(req.body.targetUserId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Admins cannot submit an acknowledgement on behalf of an employee.',
      });
    }

    // Validation: Drawn signature is strictly required
    if (!signatureImage || typeof signatureImage !== 'string' || !signatureImage.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: 'A drawn digital signature is required to acknowledge this policy. Please draw your signature in the provided pad.',
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Check if already acknowledged for this exact version
    let existing = await PolicyAcknowledgement.findOne({
      policy: policy._id,
      user: req.user._id,
      policyVersion: policy.version,
    });

    if (existing && existing.isAcknowledged) {
      return res.json({
        success: true,
        message: `You have already signed and acknowledged version ${policy.version} of this policy on ${new Date(
          existing.acknowledgedAt
        ).toLocaleDateString()}.`,
        acknowledgement: existing,
      });
    }

    const mandatoryStatement =
      'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.';
    const finalStatement = statement && statement.trim() ? statement.trim() : mandatoryStatement;
    const now = new Date();

    if (existing) {
      existing.isAcknowledged = true;
      existing.status = 'Acknowledged';
      existing.acknowledgedAt = now;
      existing.statement = finalStatement;
      existing.signatureImage = signatureImage;
      existing.employeeName = req.user.fullName;
      existing.employeeId = req.user.employeeId;
      existing.ipAddress = String(ipAddress);
      existing.userAgent = String(userAgent);
      existing.confirmationRecord = {
        confirmed: true,
        confirmedBy: `${req.user.fullName} (${req.user.employeeId})`,
        confirmedAt: now,
        ipAddress: String(ipAddress),
        userAgent: String(userAgent),
        acknowledgementType: 'Internal Drawn Electronic Signature',
      };
      if (!existing.firstOpenedAt) {
        existing.firstOpenedAt = now;
      }
      existing.latestOpenedAt = now;
      await existing.save();
    } else {
      existing = new PolicyAcknowledgement({
        policy: policy._id,
        user: req.user._id,
        employeeId: req.user.employeeId,
        employeeName: req.user.fullName,
        policyVersion: policy.version,
        publishedAt: policy.publishedAt || policy.createdAt,
        firstOpenedAt: now,
        latestOpenedAt: now,
        acknowledgedAt: now,
        isAcknowledged: true,
        status: 'Acknowledged',
        statement: finalStatement,
        signatureImage: signatureImage,
        ipAddress: String(ipAddress),
        userAgent: String(userAgent),
        confirmationRecord: {
          confirmed: true,
          confirmedBy: `${req.user.fullName} (${req.user.employeeId})`,
          confirmedAt: now,
          ipAddress: String(ipAddress),
          userAgent: String(userAgent),
          acknowledgementType: 'Internal Drawn Electronic Signature',
        },
      });
      await existing.save();
    }

    await logAudit({
      req,
      action: 'ACKNOWLEDGE_POLICY_WITH_SIGNATURE',
      entityType: 'CompanyPolicy',
      entityId: policy._id,
      changeSummary: `User ${req.user.fullName} (${req.user.employeeId}) electronically signed and acknowledged policy "${policy.title}" (v${policy.version}).`,
    });

    // Notify Admin users
    const admins = await User.find({ role: 'Admin', employmentStatus: 'Active' }).select('_id');
    const adminNotifs = admins.map((admin) => ({
      recipient: admin._id,
      title: 'Policy Acknowledged',
      message: `${req.user.fullName} (${req.user.employeeId}) has electronically signed and acknowledged policy "${policy.title}" (v${policy.version}).`,
      type: 'Policy',
      link: '/policies',
    }));
    if (adminNotifs.length > 0) {
      await Notification.insertMany(adminNotifs);
    }

    // Generate the individual signed PDF with embedded drawn signature
    let signedPdfMeta = null;
    try {
      const signatoryUser = await User.findById(req.user._id).populate('department');
      const signatoryDept = signatoryUser?.department?.name || req.user.department || 'Operations';

      signedPdfMeta = await embedSignatureIntoPolicyPdf({
        originalPdfPath: policy.pdfFile?.filePath,
        policy,
        employee: {
          fullName: req.user.fullName,
          employeeId: req.user.employeeId,
          email: req.user.email,
          department: signatoryDept,
        },
        signatureDataUrl: signatureImage,
        statement: finalStatement,
        acknowledgedAt: now,
        ipAddress: String(ipAddress),
        userAgent: String(userAgent),
      });

      existing.signedPdf = {
        fileName: signedPdfMeta.fileName,
        filePath: signedPdfMeta.filePath,
        fileSize: signedPdfMeta.fileSize,
        pageCount: signedPdfMeta.pageCount,
        generatedAt: now,
        status: 'Generated',
      };
      existing.originalPdf = {
        fileName: policy.pdfFile?.originalName || policy.pdfFile?.fileName || '',
        filePath: policy.pdfFile?.filePath || '',
      };
      await existing.save();
    } catch (pdfError) {
      console.error('[PolicyController.acknowledgePolicy] PDF embedding error:', pdfError);
      existing.signedPdf = {
        status: 'Failed',
      };
      await existing.save();
    }

    return res.status(201).json({
      success: true,
      message: `Policy successfully signed and acknowledged! Your individual signed PDF document has been generated.`,
      acknowledgement: existing,
      signedPdf: existing.signedPdf,
    });
  } catch (error) {
    console.error('[PolicyController.acknowledgePolicy] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record policy signature and acknowledgement.',
      error: error.message,
    });
  }
};

/**
 * 6. POST /api/policies
 * Admin creates a new company policy with PDF upload and audience targeting.
 */
export const createPolicy = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      content,
      effectiveDate,
      status,
      targetAudience,
      targetDepartments,
      targetRoles,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Policy title is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Policy category is required.' });
    }

    const finalStatus = ['Draft', 'Published', 'Archived'].includes(status) ? status : 'Draft';
    const isPublished = finalStatus === 'Published';

    // Parse target arrays if passed as JSON string from FormData
    let parsedDepartments = [];
    if (targetDepartments) {
      try {
        parsedDepartments = Array.isArray(targetDepartments)
          ? targetDepartments
          : JSON.parse(targetDepartments);
      } catch (e) {
        parsedDepartments = [];
      }
    }

    let parsedRoles = [];
    if (targetRoles) {
      try {
        parsedRoles = Array.isArray(targetRoles) ? targetRoles : JSON.parse(targetRoles);
      } catch (e) {
        parsedRoles = [];
      }
    }

    let pdfFileInfo = null;
    if (req.file) {
      pdfFileInfo = {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date(),
      };
    }

    const policy = new CompanyPolicy({
      title: title.trim(),
      category: category.trim(),
      description: description ? description.trim() : '',
      content: content ? content.trim() : (description ? description.trim() : 'Please refer to the attached official PDF document.'),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: finalStatus,
      targetAudience: ['All', 'Departments', 'Roles'].includes(targetAudience)
        ? targetAudience
        : 'All',
      targetDepartments: parsedDepartments,
      targetRoles: parsedRoles,
      pdfFile: pdfFileInfo,
      publishedAt: isPublished ? new Date() : null,
      version: 1,
      versionHistory: [],
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await policy.save();

    await logAudit({
      req,
      action: 'CREATE_POLICY',
      entityType: 'CompanyPolicy',
      entityId: policy._id,
      changeSummary: `Created policy "${policy.title}" (PDF: ${pdfFileInfo?.originalName || 'None'}). Status: ${policy.status}.`,
    });

    // When published, assign to all active targeted employees & notify them
    if (isPublished) {
      await assignPolicyToAllActiveEmployees(policy);

      const targetedUsers = await getTargetedUsers(policy);
      const notifications = targetedUsers.map((u) => ({
        recipient: u._id,
        title: 'New Company Policy Published',
        message: `Policy "${policy.title}" (${policy.category}) v1 has been published. Please review the PDF and submit your signature.`,
        type: 'Policy',
        link: '/policies',
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Company policy "${policy.title}" created successfully.`,
      policy,
    });
  } catch (error) {
    console.error('[PolicyController.createPolicy] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create company policy.',
      error: error.message,
    });
  }
};

/**
 * 7. PUT /api/policies/:id
 * Admin updates a policy. Preserves previous PDF and records in versionHistory.
 * Assigns new policy version to active employees without deleting old records.
 */
export const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      description,
      content,
      effectiveDate,
      changeSummary,
      targetAudience,
      targetDepartments,
      targetRoles,
    } = req.body;

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    // Preserve the current state before applying updates
    const previousSnapshot = {
      version: policy.version,
      title: policy.title,
      category: policy.category,
      description: policy.description,
      content: policy.content,
      effectiveDate: policy.effectiveDate,
      changeSummary: changeSummary || `Revision from version ${policy.version}`,
      targetAudience: policy.targetAudience || 'All',
      targetDepartments: policy.targetDepartments || [],
      targetRoles: policy.targetRoles || [],
      pdfFile: policy.pdfFile,
      publishedAt: policy.publishedAt,
      updatedBy: req.user._id,
      savedAt: new Date(),
    };

    policy.versionHistory.push(previousSnapshot);

    // Apply updates and increment version
    if (title && title.trim()) policy.title = title.trim();
    if (category && category.trim()) policy.category = category.trim();
    if (description !== undefined) policy.description = description.trim();
    if (content && content.trim()) policy.content = content.trim();
    if (effectiveDate) policy.effectiveDate = new Date(effectiveDate);
    if (targetAudience && ['All', 'Departments', 'Roles'].includes(targetAudience)) {
      policy.targetAudience = targetAudience;
    }

    if (targetDepartments) {
      try {
        policy.targetDepartments = Array.isArray(targetDepartments)
          ? targetDepartments
          : JSON.parse(targetDepartments);
      } catch (e) {}
    }

    if (targetRoles) {
      try {
        policy.targetRoles = Array.isArray(targetRoles) ? targetRoles : JSON.parse(targetRoles);
      } catch (e) {}
    }

    // If new PDF uploaded, update pdfFile
    if (req.file) {
      policy.pdfFile = {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date(),
      };
    }

    policy.version += 1;
    policy.publishedAt = new Date();
    policy.updatedBy = req.user._id;

    await policy.save();

    await logAudit({
      req,
      action: 'UPDATE_POLICY_VERSION',
      entityType: 'CompanyPolicy',
      entityId: policy._id,
      changeSummary: `Updated policy "${policy.title}" to version ${policy.version}. Revision reason: "${
        changeSummary || 'General update'
      }".`,
    });

    // If policy is Published, create new version assignments for all active employees
    if (policy.status === 'Published') {
      await assignPolicyToAllActiveEmployees(policy);

      const targetedUsers = await getTargetedUsers(policy);
      const notifications = targetedUsers.map((u) => ({
        recipient: u._id,
        title: 'Policy Revised - Re-acknowledgement Required',
        message: `Policy "${policy.title}" has been updated to v${policy.version}. Please review the updated PDF and provide your signature.`,
        type: 'Policy',
        link: '/policies',
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    return res.json({
      success: true,
      message: `Policy "${policy.title}" updated to version ${policy.version}. Previous PDF and records preserved in history.`,
      policy,
    });
  } catch (error) {
    console.error('[PolicyController.updatePolicy] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update company policy.',
      error: error.message,
    });
  }
};

/**
 * 8. PATCH /api/policies/:id/status
 * Admin changes policy status: Draft, Published, or Archived.
 */
export const updatePolicyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Draft', 'Published', 'Archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Permitted values: Draft, Published, Archived.',
      });
    }

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const prevStatus = policy.status;
    policy.status = status;
    policy.updatedBy = req.user._id;

    if (status === 'Published' && prevStatus !== 'Published') {
      policy.publishedAt = new Date();
    }

    await policy.save();

    await logAudit({
      req,
      action: 'UPDATE_POLICY_STATUS',
      entityType: 'CompanyPolicy',
      entityId: policy._id,
      changeSummary: `Changed status of "${policy.title}" from ${prevStatus} to ${status}.`,
    });

    // When publishing, create assignments and notify employees
    if (status === 'Published' && prevStatus !== 'Published') {
      await assignPolicyToAllActiveEmployees(policy);

      const targetedUsers = await getTargetedUsers(policy);
      const notifications = targetedUsers.map((u) => ({
        recipient: u._id,
        title: 'Company Policy Published',
        message: `Policy "${policy.title}" (${policy.category}) v${policy.version} is now published. Please review and sign.`,
        type: 'Policy',
        link: '/policies',
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    return res.json({
      success: true,
      message: `Policy status updated to ${status}.`,
      policy,
    });
  } catch (error) {
    console.error('[PolicyController.updatePolicyStatus] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update policy status.',
      error: error.message,
    });
  }
};

/**
 * 9. DELETE /api/policies/:id
 * Admin permanently removes a policy or its records.
 */
export const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const title = policy.title;

    // Delete PDF from disk if exists
    if (policy.pdfFile?.filePath && fs.existsSync(policy.pdfFile.filePath)) {
      try {
        fs.unlinkSync(policy.pdfFile.filePath);
      } catch (e) {
        console.warn('Could not delete policy PDF from disk:', e);
      }
    }

    await PolicyAcknowledgement.deleteMany({ policy: policy._id });
    await PolicyQuestion.deleteMany({ policy: policy._id });
    await CompanyPolicy.findByIdAndDelete(id);

    await logAudit({
      req,
      action: 'DELETE_POLICY',
      entityType: 'CompanyPolicy',
      entityId: id,
      changeSummary: `Deleted company policy "${title}".`,
    });

    return res.json({
      success: true,
      message: `Policy "${title}" deleted successfully.`,
    });
  } catch (error) {
    console.error('[PolicyController.deletePolicy] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete policy.',
      error: error.message,
    });
  }
};

/**
 * 10. GET /api/policies/:id/acknowledgements (and /api/policies/:id/report)
 * Admin Policy Acknowledgement Report.
 * Displays: Total assigned employees, Not Opened count, Opened but Not Acknowledged count,
 * Acknowledged count, Pending count, Completion percentage.
 * Employee-wise table: Employee name, ID, Department, Policy status, First opened date,
 * Latest opened date, Acknowledgement date, View Signature action.
 */
export const getPolicyAcknowledgements = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, department, status } = req.query;

    const policy = await CompanyPolicy.findById(id).populate('targetDepartments', 'name');
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    // 1. Get all targeted active employees
    const targetedUsers = await getTargetedUsers(policy);

    // 2. Fetch all acknowledgement / assignment records for this policy version
    const ackRecords = await PolicyAcknowledgement.find({
      policy: policy._id,
      policyVersion: policy.version,
    })
      .populate('user', 'fullName employeeId email role department designation')
      .sort({ acknowledgedAt: -1, firstOpenedAt: -1 })
      .lean();

    const userAckMap = new Map();
    for (const ack of ackRecords) {
      const uId = String(ack.user?._id || ack.user);
      userAckMap.set(uId, ack);
    }

    // 3. Build comprehensive list for every assigned active employee
    let reportList = targetedUsers.map((emp) => {
      const uId = String(emp._id);
      const ack = userAckMap.get(uId);

      let recordStatus = 'Not Opened';
      let firstOpenedAt = ack?.firstOpenedAt || null;
      let latestOpenedAt = ack?.latestOpenedAt || null;
      let acknowledgedAt = null;
      let statement = '';
      let hasSignature = false;
      let signatureImage = '';

      if (ack && ack.isAcknowledged) {
        recordStatus = 'Acknowledged';
        acknowledgedAt = ack.acknowledgedAt;
        statement = ack.statement || '';
        hasSignature = !!ack.signatureImage;
        signatureImage = ack.signatureImage || '';
      } else if (ack && ack.firstOpenedAt) {
        recordStatus = 'Opened';
      }

      return {
        _id: uId,
        user: {
          _id: emp._id,
          fullName: emp.fullName,
          employeeId: emp.employeeId,
          email: emp.email,
          role: emp.role,
          department: emp.department?.name || 'General',
          designation: emp.designation || 'Team Member',
        },
        policyVersion: policy.version,
        firstOpenedAt,
        latestOpenedAt,
        acknowledgedAt,
        status: recordStatus,
        statement,
        hasSignature,
        signatureImage,
        hasSignedPdf: !!(ack?.signedPdf?.fileName || ack?.signatureImage),
        signedPdf: ack?.signedPdf?.status === 'Generated' || ack?.signatureImage ? {
          fileName: ack?.signedPdf?.fileName || '',
          fileSize: ack?.signedPdf?.fileSize || 0,
          generatedAt: ack?.signedPdf?.generatedAt || ack?.acknowledgedAt,
          hasSignedPdf: true,
        } : null,
        ipAddress: ack?.ipAddress || '',
        userAgent: ack?.userAgent || '',
        confirmationRecord: ack?.confirmationRecord || null,
      };
    });

    // 4. Compute statistics
    const totalAssigned = reportList.length;
    const acknowledgedCount = reportList.filter((r) => r.status === 'Acknowledged').length;
    const openedNotAcknowledgedCount = reportList.filter((r) => r.status === 'Opened').length;
    const notOpenedCount = reportList.filter((r) => r.status === 'Not Opened').length;
    const pendingCount = totalAssigned - acknowledgedCount;
    const completionPercentage =
      totalAssigned > 0 ? Math.round((acknowledgedCount / totalAssigned) * 100) : 0;

    // 5. Apply filters for report table
    if (department && department !== 'All') {
      reportList = reportList.filter((r) => r.user.department === department);
    }

    if (status && status !== 'All') {
      if (status === 'Pending') {
        reportList = reportList.filter((r) => r.status !== 'Acknowledged');
      } else {
        reportList = reportList.filter((r) => r.status === status);
      }
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      reportList = reportList.filter(
        (r) =>
          r.user.fullName?.toLowerCase().includes(q) ||
          r.user.employeeId?.toLowerCase().includes(q) ||
          r.user.email?.toLowerCase().includes(q) ||
          r.user.department?.toLowerCase().includes(q)
      );
    }

    return res.json({
      success: true,
      policyTitle: policy.title,
      policyVersion: policy.version,
      publishedAt: policy.publishedAt,
      effectiveDate: policy.effectiveDate,
      category: policy.category,
      pdfOriginalName: policy.pdfFile?.originalName || '',
      stats: {
        totalAssigned,
        acknowledgedCount,
        openedNotAcknowledgedCount,
        notOpenedCount,
        pendingCount,
        completionPercentage,
      },
      report: reportList,
    });
  } catch (error) {
    console.error('[PolicyController.getPolicyAcknowledgements] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch policy acknowledgement report.',
      error: error.message,
    });
  }
};

/**
 * 11. GET /api/policies/:id/signature/:userId
 * Secure view of an employee's drawn digital signature.
 * Admin can view any signature. Employee can only view their own signature.
 */
export const getEmployeeSignature = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const isAdmin = req.user.role === 'Admin';

    if (!isAdmin && String(req.user._id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const ack = await PolicyAcknowledgement.findOne({
      policy: policy._id,
      user: userId,
      policyVersion: policy.version,
    }).populate('user', 'fullName employeeId email role department');

    if (!ack || !ack.isAcknowledged || !ack.signatureImage) {
      return res.status(404).json({
        success: false,
        message: 'No digital signature record found for this employee.',
      });
    }

    return res.json({
      success: true,
      signatureImage: ack.signatureImage,
      employeeName: ack.employeeName || ack.user?.fullName,
      employeeId: ack.employeeId || ack.user?.employeeId,
      policyTitle: policy.title,
      policyVersion: policy.version,
      acknowledgedAt: ack.acknowledgedAt,
      statement: ack.statement,
      confirmationRecord: ack.confirmationRecord,
    });
  } catch (error) {
    console.error('[PolicyController.getEmployeeSignature] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve signature.',
      error: error.message,
    });
  }
};

/**
 * 12. POST /api/policies/:id/send-reminder
 * Admin sends reminder notifications to all employees who have not yet acknowledged this policy.
 */
export const sendPolicyReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    if (policy.status !== 'Published') {
      return res.status(400).json({
        success: false,
        message: 'Reminders can only be sent for published policies.',
      });
    }

    const targetedUsers = await getTargetedUsers(policy);

    const acks = await PolicyAcknowledgement.find({
      policy: policy._id,
      policyVersion: policy.version,
      isAcknowledged: true,
    }).select('user');

    const ackUserIds = new Set(acks.map((a) => String(a.user)));
    const pendingUsers = targetedUsers.filter((u) => !ackUserIds.has(String(u._id)));

    if (pendingUsers.length === 0) {
      return res.json({
        success: true,
        message: 'All assigned employees have already acknowledged this policy. No reminders needed!',
        remindedCount: 0,
      });
    }

    const notifications = pendingUsers.map((u) => ({
      recipient: u._id,
      title: 'Policy Acknowledgement Pending',
      message: `Reminder: Please review and sign company policy "${policy.title}" (v${policy.version}).`,
      type: 'Policy',
      link: '/policies',
    }));

    await Notification.insertMany(notifications);

    await logAudit({
      req,
      action: 'SEND_POLICY_REMINDER',
      entityType: 'CompanyPolicy',
      entityId: policy._id,
      changeSummary: `Sent policy acknowledgement reminder to ${pendingUsers.length} employees for "${policy.title}".`,
    });

    return res.json({
      success: true,
      message: `Sent reminders to ${pendingUsers.length} pending employee(s).`,
      remindedCount: pendingUsers.length,
    });
  } catch (error) {
    console.error('[PolicyController.sendPolicyReminder] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reminders.',
      error: error.message,
    });
  }
};

/**
 * 13. GET /api/policies/:id/versions
 * Admin retrieves full version history snapshots.
 */
export const getPolicyVersions = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await CompanyPolicy.findById(id)
      .populate('versionHistory.updatedBy', 'fullName employeeId email role')
      .populate('createdBy', 'fullName employeeId email role')
      .populate('updatedBy', 'fullName employeeId email role')
      .lean();

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    return res.json({
      success: true,
      currentVersion: policy.version,
      currentPolicy: {
        title: policy.title,
        category: policy.category,
        description: policy.description,
        content: policy.content,
        effectiveDate: policy.effectiveDate,
        publishedAt: policy.publishedAt,
        targetAudience: policy.targetAudience,
        pdfFile: policy.pdfFile,
        updatedAt: policy.updatedAt,
        updatedBy: policy.updatedBy,
      },
      versionHistory: policy.versionHistory || [],
    });
  } catch (error) {
    console.error('[PolicyController.getPolicyVersions] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch policy version history.',
      error: error.message,
    });
  }
};

/**
 * 14. GET /api/policies/:id/questions
 * List questions for a policy.
 * - Admin: sees all questions for this policy.
 * - Employee: sees their own questions + any questions marked as public FAQ.
 */
export const getPolicyQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const isAdmin = req.user.role === 'Admin';

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    let filter = { policy: policy._id };
    if (!isAdmin) {
      filter.$or = [{ user: req.user._id }, { isFAQ: true }];
    }
    if (status && status !== 'All') {
      filter.status = status;
    }

    const questions = await PolicyQuestion.find(filter)
      .populate({
        path: 'user',
        select: 'fullName employeeId email role department designation',
        populate: { path: 'department', select: 'name' },
      })
      .populate('replies.user', 'fullName employeeId email role')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error('[PolicyController.getPolicyQuestions] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch policy questions.',
      error: error.message,
    });
  }
};

/**
 * 15. POST /api/policies/:id/questions
 * Employee asks a question / requests clarification on a policy.
 * Generates notification to Admin users.
 */
export const askPolicyQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, question } = req.body;

    const questionContent = (message || question || '').trim();
    if (!questionContent) {
      return res.status(400).json({ success: false, message: 'Question message is required.' });
    }

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const newQuestion = new PolicyQuestion({
      policy: policy._id,
      policyVersion: policy.version,
      user: req.user._id,
      employeeId: req.user.employeeId,
      title: title ? title.trim() : 'Clarification Request',
      question: questionContent,
      status: 'Open',
      isPrivate: true,
      isFAQ: false,
      replies: [],
    });

    await newQuestion.save();

    await logAudit({
      req,
      action: 'ASK_POLICY_QUESTION',
      entityType: 'PolicyQuestion',
      entityId: newQuestion._id,
      changeSummary: `User ${req.user.fullName} (${req.user.employeeId}) asked a question on policy "${policy.title}".`,
    });

    // Notify Admin users
    const admins = await User.find({ role: 'Admin', employmentStatus: 'Active' }).select('_id');
    const adminNotifs = admins.map((admin) => ({
      recipient: admin._id,
      title: 'New Policy Question',
      message: `${req.user.fullName} (${req.user.employeeId || 'Employee'}) asked a question regarding policy "${policy.title}".`,
      type: 'Policy',
      link: `/policies?tab=questions&questionId=${newQuestion._id}`,
    }));
    if (adminNotifs.length > 0) {
      await Notification.insertMany(adminNotifs);
    }

    const populated = await PolicyQuestion.findById(newQuestion._id)
      .populate('user', 'fullName employeeId email role designation')
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Your question has been submitted to Admin/HR.',
      question: populated,
    });
  } catch (error) {
    console.error('[PolicyController.askPolicyQuestion] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit question.',
      error: error.message,
    });
  }
};

/**
 * 16. POST /api/policies/:id/questions/:questionId/reply
 * Admin replies to employee question OR Employee asks follow-up.
 * Generates notification to the counterpart.
 */
export const replyPolicyQuestion = async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const { message } = req.body;
    const isAdmin = req.user.role === 'Admin';

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
    }

    const policy = await CompanyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const question = await PolicyQuestion.findOne({ _id: questionId, policy: policy._id });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    if (!isAdmin && String(question.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only reply to your own questions.',
      });
    }

    question.replies.push({
      user: req.user._id,
      role: req.user.role,
      message: message.trim(),
      createdAt: new Date(),
    });

    if (isAdmin) {
      question.status = 'Answered';
      // Notify the asking employee
      await Notification.create({
        recipient: question.user,
        title: 'Policy Question Answered',
        message: `Admin replied to your question regarding policy "${policy.title}".`,
        type: 'Policy',
        link: `/policies/${policy._id}?tab=questions&questionId=${question._id}`,
      });
    } else {
      question.status = 'Open';
      // Notify Admin
      const admins = await User.find({ role: 'Admin', employmentStatus: 'Active' }).select('_id');
      const adminNotifs = admins.map((admin) => ({
        recipient: admin._id,
        title: 'Policy Question Follow-up',
        message: `${req.user.fullName} sent a follow-up on their question for "${policy.title}".`,
        type: 'Policy',
        link: `/policies?tab=questions&questionId=${question._id}`,
      }));
      if (adminNotifs.length > 0) {
        await Notification.insertMany(adminNotifs);
      }
    }

    await question.save();

    const populated = await PolicyQuestion.findById(question._id)
      .populate('user', 'fullName employeeId email role designation')
      .populate('replies.user', 'fullName employeeId email role')
      .lean();

    return res.json({
      success: true,
      message: 'Reply posted successfully.',
      question: populated,
    });
  } catch (error) {
    console.error('[PolicyController.replyPolicyQuestion] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to post reply.',
      error: error.message,
    });
  }
};

/**
 * 17. PATCH /api/policies/:id/questions/:questionId/status
 *     PATCH /api/policies/questions/:questionId/status
 * Admin changes status of a question ('Open', 'Answered', 'Resolved').
 */
export const updateQuestionStatus = async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const { status } = req.body;
    const targetQuestionId = questionId || id;

    if (!status || !['Open', 'Answered', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be Open, Answered, or Resolved.',
      });
    }

    let question = null;
    if (id && questionId && mongoose.Types.ObjectId.isValid(id) && mongoose.Types.ObjectId.isValid(questionId)) {
      question = await PolicyQuestion.findOne({ _id: questionId, policy: id });
    }
    if (!question && targetQuestionId && mongoose.Types.ObjectId.isValid(targetQuestionId)) {
      question = await PolicyQuestion.findById(targetQuestionId);
    }

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    // Prevent duplicate updates
    if (question.status === status) {
      const existingPopulated = await PolicyQuestion.findById(question._id)
        .populate('policy', 'title category version status')
        .populate({
          path: 'user',
          select: 'fullName employeeId email role department designation',
          populate: { path: 'department', select: 'name' },
        })
        .populate('replies.user', 'fullName employeeId email role')
        .lean();

      return res.json({
        success: true,
        message: `Question is already marked as ${status}.`,
        question: existingPopulated || question,
      });
    }

    const previousStatus = question.status;
    question.status = status;
    await question.save();

    const policy = await CompanyPolicy.findById(question.policy);

    // Notify asking employee when Admin updates question status
    if (status === 'Resolved' && previousStatus !== 'Resolved') {
      await Notification.create({
        recipient: question.user,
        title: 'Policy Question Resolved',
        message: `Your question regarding policy "${policy?.title || 'Company Policy'}" has been marked as Resolved.`,
        type: 'Policy',
        link: `/policies/${question.policy}?tab=questions&questionId=${question._id}`,
      });
    } else if (status === 'Open' && previousStatus === 'Resolved') {
      await Notification.create({
        recipient: question.user,
        title: 'Policy Question Reopened',
        message: `Your question regarding policy "${policy?.title || 'Company Policy'}" has been reopened.`,
        type: 'Policy',
        link: `/policies/${question.policy}?tab=questions&questionId=${question._id}`,
      });
    }

    const populated = await PolicyQuestion.findById(question._id)
      .populate('policy', 'title category version status')
      .populate({
        path: 'user',
        select: 'fullName employeeId email role department designation',
        populate: { path: 'department', select: 'name' },
      })
      .populate('replies.user', 'fullName employeeId email role')
      .lean();

    return res.json({
      success: true,
      message: `Question status updated to ${status}.`,
      question: populated,
    });
  } catch (error) {
    console.error('[PolicyController.updateQuestionStatus] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update question status.',
      error: error.message,
    });
  }
};

/**
 * 18. PATCH /api/policies/:id/questions/:questionId/faq
 *     PATCH /api/policies/questions/:questionId/faq
 * Admin toggles question visibility as a public FAQ for all employees.
 */
export const toggleQuestionFAQ = async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const { isFAQ } = req.body;
    const targetQuestionId = questionId || id;

    let question = null;
    if (id && questionId && mongoose.Types.ObjectId.isValid(id) && mongoose.Types.ObjectId.isValid(questionId)) {
      question = await PolicyQuestion.findOne({ _id: questionId, policy: id });
    }
    if (!question && targetQuestionId && mongoose.Types.ObjectId.isValid(targetQuestionId)) {
      question = await PolicyQuestion.findById(targetQuestionId);
    }

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    question.isFAQ = typeof isFAQ === 'boolean' ? isFAQ : !question.isFAQ;
    await question.save();

    return res.json({
      success: true,
      message: question.isFAQ ? 'Question published as shared FAQ.' : 'Question removed from shared FAQ.',
      isFAQ: question.isFAQ,
    });
  } catch (error) {
    console.error('[PolicyController.toggleQuestionFAQ] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle FAQ status.',
      error: error.message,
    });
  }
};

/**
 * 19. GET /api/policies/questions/all
 * Central list of questions across all policies.
 * - Admin: all questions across all policies
 * - Employee: questions asked by current user + public FAQs
 */
export const getAllPolicyQuestions = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const { status, policyId } = req.query;

    const filter = {};
    if (!isAdmin) {
      filter.$or = [{ user: req.user._id }, { isFAQ: true }];
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (policyId && policyId !== 'All') {
      filter.policy = policyId;
    }

    const questions = await PolicyQuestion.find(filter)
      .populate('policy', 'title category version status')
      .populate({
        path: 'user',
        select: 'fullName employeeId email role department designation',
        populate: { path: 'department', select: 'name' },
      })
      .populate('replies.user', 'fullName employeeId email role')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error('[PolicyController.getAllPolicyQuestions] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch questions.',
      error: error.message,
    });
  }
};
