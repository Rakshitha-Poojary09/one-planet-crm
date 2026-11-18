import { Announcement } from '../models/Announcement.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

// @desc Get announcements
// @route GET /api/announcements
export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('targetDepartment', 'name code')
      .populate('targetTeam', 'name')
      .populate('createdBy', 'fullName role')
      .sort({ publishDate: -1 });

    res.status(200).json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create announcement
// @route POST /api/announcements
export const createAnnouncement = async (req, res) => {
  try {
    const { title, description, priority, targetAudience, targetDepartment, targetTeam, expiryDate } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const announcement = await Announcement.create({
      title,
      description,
      priority: priority || 'Normal',
      targetAudience: targetAudience || 'All',
      targetDepartment: targetDepartment || null,
      targetTeam: targetTeam || null,
      expiryDate: expiryDate || null,
      createdBy: req.user._id,
    });

    // Create notifications for targeted users
    let targetUsers = [];
    if (targetAudience === 'Department' && targetDepartment) {
      targetUsers = await User.find({ department: targetDepartment, employmentStatus: 'Active' });
    } else {
      targetUsers = await User.find({ employmentStatus: 'Active' });
    }

    const notifications = targetUsers.map((u) => ({
      recipient: u._id,
      title: `Announcement: ${title}`,
      message: description.substring(0, 100) + '...',
      type: 'Announcement',
      link: '/announcements',
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ success: true, announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Delete announcement
// @route DELETE /api/announcements/:id
export const deleteAnnouncement = async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get user notifications
// @route GET /api/notifications
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.status(200).json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Mark notifications as read
// @route PUT /api/notifications/mark-read
export const markNotificationsAsRead = async (req, res) => {
  try {
    const id = req.body?.id || req.params?.id;
    if (id) {
      await Notification.findOneAndUpdate(
        { _id: id, recipient: req.user._id },
        { isRead: true }
      );
    } else {
      await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    }

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.status(200).json({
      success: true,
      message: id ? 'Notification marked as read.' : 'All notifications marked as read.',
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
