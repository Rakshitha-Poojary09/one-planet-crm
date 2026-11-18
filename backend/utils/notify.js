import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

/**
 * Dispatch a notification to one or multiple recipients with duplicate prevention.
 * @param {Object} params
 * @param {string|Object} [params.recipient] - Single recipient user ID
 * @param {Array<string|Object>} [params.recipients] - Array of recipient user IDs
 * @param {string} params.title - Notification title
 * @param {string} params.message - Short message body
 * @param {string} [params.type='System'] - 'Announcement' | 'Leave' | 'Attendance' | 'Task' | 'System' | 'Alert' | 'Policy'
 * @param {string} [params.link=''] - Frontend route link
 * @param {string|Object} [params.excludeUser] - User ID to exclude (e.g. the actor)
 */
export const sendNotification = async ({
  recipient,
  recipients,
  title,
  message,
  type = 'System',
  link = '',
  excludeUser = null,
}) => {
  try {
    let targetIds = [];
    if (recipients && Array.isArray(recipients)) {
      targetIds = recipients.map((id) => (id?._id ? id._id.toString() : id?.toString ? id.toString() : String(id)));
    } else if (recipient) {
      const id = recipient?._id ? recipient._id.toString() : recipient?.toString ? recipient.toString() : String(recipient);
      targetIds = [id];
    }

    if (excludeUser) {
      const excludeStr = excludeUser?._id
        ? excludeUser._id.toString()
        : excludeUser?.toString
        ? excludeUser.toString()
        : String(excludeUser);
      targetIds = targetIds.filter((id) => id !== excludeStr);
    }

    // Deduplicate target IDs
    targetIds = Array.from(new Set(targetIds.filter(Boolean)));
    if (targetIds.length === 0) return [];

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    const createdNotifications = [];
    for (const userId of targetIds) {
      // Duplicate prevention: check if an identical unread notification was created within the last 60 seconds
      const exists = await Notification.findOne({
        recipient: userId,
        title,
        isRead: false,
        createdAt: { $gte: oneMinuteAgo },
      });

      if (!exists) {
        createdNotifications.push({
          recipient: userId,
          title,
          message,
          type,
          link,
          isRead: false,
        });
      }
    }

    if (createdNotifications.length > 0) {
      return await Notification.insertMany(createdNotifications);
    }
    return [];
  } catch (err) {
    console.error('Failed to dispatch notification:', err.message);
    return [];
  }
};

/**
 * Get all active Admin user IDs
 */
export const getAdminUserIds = async () => {
  try {
    const admins = await User.find({ role: 'Admin', employmentStatus: 'Active' }).select('_id');
    return admins.map((u) => u._id.toString());
  } catch (err) {
    console.error('Failed to get admin user IDs:', err.message);
    return [];
  }
};

/**
 * Get the reporting manager user ID for a given user
 */
export const getReportingManagerId = async (userId) => {
  try {
    const user = await User.findById(userId).select('reportingManager');
    return user?.reportingManager ? user.reportingManager.toString() : null;
  } catch (err) {
    console.error('Failed to get reporting manager:', err.message);
    return null;
  }
};
