import { AuditLog } from '../models/AuditLog.js';

export const logAudit = async ({ req, action, entityType, entityId = '', changeSummary = '' }) => {
  try {
    const actingUser = req?.user?._id || null;
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '';

    await AuditLog.create({
      actingUser,
      action,
      entityType,
      entityId: String(entityId),
      changeSummary,
      ipAddress,
    });
  } catch (err) {
    console.error('[AuditLog] Error saving audit log:', err.message);
  }
};
