import { Holiday } from '../models/Holiday.js';
import { CompanyEvent } from '../models/CompanyEvent.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { logAudit } from '../utils/audit.js';

export const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    const query = {};
    if (year) {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year}-12-31`);
      query.date = { $gte: start, $lte: end };
    }
    const holidays = await Holiday.find(query)
      .populate('applicableDepartment', 'name code')
      .sort({ date: 1 });
    res.status(200).json({ success: true, holidays });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createHoliday = async (req, res) => {
  try {
    const { name, date, description, type, applicableDepartment } = req.body;
    if (!name || !date) {
      return res.status(400).json({ success: false, message: 'Holiday name and date are required.' });
    }
    const holiday = await Holiday.create({
      name,
      date,
      description: description || '',
      type: type || 'Festival',
      applicableDepartment: applicableDepartment || null,
    });

    // Notify all active employees
    try {
      const activeUsers = await User.find({ status: 'Active' }).select('_id');
      if (activeUsers.length > 0) {
        const notifs = activeUsers.map((u) => ({
          recipient: u._id,
          title: 'New Company Holiday Scheduled',
          message: `Holiday "${holiday.name}" has been scheduled for ${new Date(holiday.date).toLocaleDateString()}.`,
          type: 'Announcement',
          link: '/calendar',
        }));
        await Notification.insertMany(notifs);
      }
    } catch (e) {
      console.error('Failed to dispatch holiday notifications:', e);
    }

    await logAudit({
      req,
      action: 'CREATE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      changeSummary: `Created holiday "${holiday.name}" for ${holiday.date}`,
    });

    res.status(201).json({ success: true, message: 'Holiday created successfully.', holiday });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHoliday = async (req, res) => {
  try {
    const { name, date, description, type, applicableDepartment } = req.body;
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found.' });
    }

    if (name) holiday.name = name;
    if (date) holiday.date = date;
    if (description !== undefined) holiday.description = description;
    if (type) holiday.type = type;
    if (applicableDepartment !== undefined) holiday.applicableDepartment = applicableDepartment || null;

    await holiday.save();

    // Notify all active employees
    try {
      const activeUsers = await User.find({ status: 'Active' }).select('_id');
      if (activeUsers.length > 0) {
        const notifs = activeUsers.map((u) => ({
          recipient: u._id,
          title: 'Company Holiday Updated',
          message: `Holiday "${holiday.name}" details were updated for ${new Date(holiday.date).toLocaleDateString()}.`,
          type: 'Announcement',
          link: '/calendar',
        }));
        await Notification.insertMany(notifs);
      }
    } catch (e) {
      console.error('Failed to dispatch holiday update notifications:', e);
    }

    await logAudit({
      req,
      action: 'UPDATE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      changeSummary: `Updated holiday "${holiday.name}" (${holiday.date})`,
    });

    res.status(200).json({ success: true, message: 'Holiday updated successfully.', holiday });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found.' });
    }

    await Holiday.findByIdAndDelete(req.params.id);

    // Notify all active employees
    try {
      const activeUsers = await User.find({ status: 'Active' }).select('_id');
      if (activeUsers.length > 0) {
        const notifs = activeUsers.map((u) => ({
          recipient: u._id,
          title: 'Company Holiday Removed',
          message: `Holiday "${holiday.name}" on ${new Date(holiday.date).toLocaleDateString()} has been removed from the schedule.`,
          type: 'Announcement',
          link: '/calendar',
        }));
        await Notification.insertMany(notifs);
      }
    } catch (e) {
      console.error('Failed to dispatch holiday deletion notifications:', e);
    }

    await logAudit({
      req,
      action: 'DELETE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      changeSummary: `Removed holiday "${holiday.name}" (${holiday.date})`,
    });

    res.status(200).json({ success: true, message: 'Holiday removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get approved company/team leaves for the shared calendar
// @route GET /api/calendar/leaves
export const getCalendarLeaves = async (req, res) => {
  try {
    const { year, month } = req.query;
    const query = { status: 'Approved' };

    if (year) {
      const y = parseInt(year, 10);
      let start, end;
      if (month) {
        const m = parseInt(month, 10);
        start = new Date(y, m - 1, 1);
        end = new Date(y, m, 0, 23, 59, 59);
      } else {
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31, 23, 59, 59);
      }
      query.$or = [{ startDate: { $lte: end }, endDate: { $gte: start } }];
    }

    const leaves = await LeaveRequest.find(query)
      .populate('user', 'fullName employeeId department designation')
      .populate('leaveType', 'name code')
      .sort({ startDate: 1 });

    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const events = await CompanyEvent.find().populate('organizer', 'fullName employeeId').sort({ startDate: 1 });
    res.status(200).json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, location } = req.body;
    const event = await CompanyEvent.create({
      title,
      description,
      startDate,
      endDate: endDate || null,
      location: location || 'Headquarters / Online',
      organizer: req.user._id,
    });
    res.status(201).json({ success: true, event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    await CompanyEvent.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Event deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
