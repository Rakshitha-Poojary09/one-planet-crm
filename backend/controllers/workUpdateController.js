import { DailyWorkUpdate } from '../models/DailyWorkUpdate.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { Project } from '../models/Project.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Holiday } from '../models/Holiday.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { logAudit } from '../utils/audit.js';

// Helper to determine allowed employee IDs for a Manager
const getManagerAllowedUserIds = async (managerId) => {
  const managedTeams = await Team.find({ leader: managerId }).select('members');
  const teamMemberIds = managedTeams.flatMap((t) => t.members || []);
  const directReports = await User.find({ reportingManager: managerId }).select('_id');
  return Array.from(
    new Set([
      ...teamMemberIds.map((id) => id.toString()),
      ...directReports.map((u) => u._id.toString()),
      managerId.toString(),
    ])
  );
};

// @desc Submit or revise daily work update (simplified compact form)
// @route POST /api/work-updates
export const submitWorkUpdate = async (req, res) => {
  try {
    const {
      date: customDate,
      project,
      completedWork,
      workInProgress,
      pendingWork,
      blockers,
      timeSpentHours,
      status,
      nextDayPlan,
      editReason,
    } = req.body;

    const date = customDate || new Date().toISOString().split('T')[0];

    const parsedHours = Number(timeSpentHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid hours spent is required.',
      });
    }

    const validStatuses = ['Completed', 'In Progress', 'Blocked'];
    const deliverableStatus = validStatuses.includes(status) ? status : 'Completed';

    const existing = await DailyWorkUpdate.findOne({ user: req.user._id, date });

    if (existing) {
      // Record revision in edit history
      existing.editHistory.push({
        editedAt: new Date(),
        editedBy: req.user._id,
        previousCompletedWork: existing.completedWork || '',
        previousWorkInProgress: existing.workInProgress || '',
        previousPendingWork: existing.pendingWork || '',
        previousBlockers: existing.blockers || '',
        previousTimeSpentHours: existing.timeSpentHours,
        previousStatus: existing.status,
        previousNextDayPlan: existing.nextDayPlan || '',
        reason: editReason || 'Revised daily work report',
      });

      existing.project = project || null;
      if (completedWork !== undefined) existing.completedWork = completedWork || '';
      if (workInProgress !== undefined) existing.workInProgress = workInProgress || '';
      if (pendingWork !== undefined) existing.pendingWork = pendingWork || '';
      if (blockers !== undefined) existing.blockers = blockers || '';
      existing.timeSpentHours = parsedHours;
      existing.status = deliverableStatus;
      if (nextDayPlan !== undefined) existing.nextDayPlan = nextDayPlan || '';

      if (existing.needsClarification) {
        existing.clarificationStatus = 'Resolved';
        existing.needsClarification = false;
      }

      await existing.save();

      await logAudit({
        req,
        action: 'UPDATE_WORK_LOG',
        entityType: 'DailyWorkUpdate',
        entityId: existing._id,
        changeSummary: `Revised daily work update for ${date} (Edit version #${existing.editHistory.length})`,
      });

      return res.status(200).json({
        success: true,
        isRevision: true,
        message: 'Daily work update revised successfully with revision history recorded.',
        update: existing,
      });
    }

    const update = await DailyWorkUpdate.create({
      user: req.user._id,
      date,
      project: project || null,
      completedWork: completedWork || '',
      workInProgress: workInProgress || '',
      pendingWork: pendingWork || '',
      blockers: blockers || '',
      timeSpentHours: parsedHours,
      status: deliverableStatus,
      nextDayPlan: nextDayPlan || '',
      needsClarification: false,
      clarificationStatus: 'None',
      comments: [],
      editHistory: [],
    });

    await logAudit({
      req,
      action: 'SUBMIT_WORK_LOG',
      entityType: 'DailyWorkUpdate',
      entityId: update._id,
      changeSummary: `Submitted daily work update for ${date}`,
    });

    res.status(201).json({
      success: true,
      message: 'Daily work update logged successfully.',
      update,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get daily work updates with filters & role scoping
// @route GET /api/work-updates
export const getWorkUpdates = async (req, res) => {
  try {
    const { date, startDate, endDate, user, team, project, status, needsClarification } = req.query;
    const query = {};

    // 1. Role-based scoping
    if (req.user.role === 'Employee') {
      query.user = req.user._id;
    } else if (req.user.role === 'Manager') {
      const allowedUserIds = await getManagerAllowedUserIds(req.user._id);
      if (user) {
        if (!allowedUserIds.includes(String(user))) {
          return res.status(200).json({ success: true, updates: [] });
        }
        query.user = user;
      } else {
        query.user = { $in: allowedUserIds };
      }
    } else if (user) {
      query.user = user;
    }

    // 2. Team filter
    if (team) {
      const teamDoc = await Team.findById(team);
      if (teamDoc) {
        const teamMemberIds = (teamDoc.members || []).map((m) => m.toString());
        if (query.user && query.user.$in) {
          query.user = { $in: query.user.$in.filter((id) => teamMemberIds.includes(id)) };
        } else if (!query.user) {
          query.user = { $in: teamMemberIds };
        }
      }
    }

    // 3. Date filters
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (date) {
      query.date = date;
    }

    // 4. Project, status & clarification filters
    if (project) query.project = project;
    if (status) query.status = status;
    if (needsClarification === 'true') {
      query.needsClarification = true;
    }

    const updates = await DailyWorkUpdate.find(query)
      .populate({
        path: 'user',
        select: 'fullName employeeId email designation department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('project', 'name clientName status')
      .populate('feedbackBy', 'fullName employeeId')
      .populate('comments.author', 'fullName employeeId designation role')
      .populate('editHistory.editedBy', 'fullName employeeId')
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({ success: true, updates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single work update by ID
// @route GET /api/work-updates/:id
export const getWorkUpdateById = async (req, res) => {
  try {
    const update = await DailyWorkUpdate.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'fullName employeeId email designation department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('project', 'name clientName status')
      .populate('feedbackBy', 'fullName employeeId')
      .populate('comments.author', 'fullName employeeId designation role')
      .populate('editHistory.editedBy', 'fullName employeeId');

    if (!update) {
      return res.status(404).json({ success: false, message: 'Work update not found.' });
    }

    // Permission check
    if (req.user.role === 'Employee' && update.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access.' });
    }

    if (req.user.role === 'Manager') {
      const allowedUserIds = await getManagerAllowedUserIds(req.user._id);
      if (!allowedUserIds.includes(update.user._id.toString())) {
        return res.status(403).json({ success: false, message: 'Unauthorized access.' });
      }
    }

    res.status(200).json({ success: true, update });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Add comment or request clarification on work update (Manager/Admin or Employee reply)
// @route POST /api/work-updates/:id/comments
export const addCommentOrClarification = async (req, res) => {
  try {
    const { text, type } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const update = await DailyWorkUpdate.findById(req.params.id);
    if (!update) {
      return res.status(404).json({ success: false, message: 'Work update not found.' });
    }

    const isOwner = update.user.toString() === req.user._id.toString();
    const isManager = req.user.role === 'Manager';
    const isAdmin = req.user.role === 'Admin';

    if (!isAdmin && !isOwner && isManager) {
      const allowedUserIds = await getManagerAllowedUserIds(req.user._id);
      if (!allowedUserIds.includes(update.user.toString())) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }
    } else if (!isAdmin && !isOwner && !isManager) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const commentType = type === 'Clarification' ? 'Clarification' : 'Feedback';

    update.comments.push({
      author: req.user._id,
      text: text.trim(),
      type: commentType,
      createdAt: new Date(),
    });

    if (commentType === 'Clarification' && (isManager || isAdmin)) {
      update.needsClarification = true;
      update.clarificationStatus = 'Requested';
    } else if (isOwner && update.needsClarification) {
      // Employee replied to clarification
      update.clarificationStatus = 'Resolved';
      update.needsClarification = false;
    }

    // Maintain backwards compatibility with legacy feedback fields
    if (isManager || isAdmin) {
      update.managerFeedback = text.trim();
      update.feedbackBy = req.user._id;
      update.feedbackAt = new Date();
    }

    await update.save();

    const populatedUpdate = await DailyWorkUpdate.findById(update._id)
      .populate('comments.author', 'fullName employeeId designation role')
      .populate('feedbackBy', 'fullName employeeId');

    await logAudit({
      req,
      action: commentType === 'Clarification' ? 'REQUEST_CLARIFICATION' : 'COMMENT_WORK_LOG',
      entityType: 'DailyWorkUpdate',
      entityId: update._id,
      changeSummary: `${commentType} posted on work update for user ${update.user} on ${update.date}`,
    });

    res.status(200).json({
      success: true,
      message: commentType === 'Clarification' ? 'Clarification requested from employee.' : 'Feedback recorded.',
      update: populatedUpdate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get missing / overdue daily updates for a specific date
// @route GET /api/work-updates/missing
export const getMissingUpdates = async (req, res) => {
  try {
    const { date: queryDate } = req.query;
    const date = queryDate || new Date().toISOString().split('T')[0];

    // 1. Active employees in scope
    let activeUsers = [];
    if (req.user.role === 'Employee') {
      activeUsers = await User.find({ _id: req.user._id, employmentStatus: 'Active' })
        .populate('department', 'name code');
    } else if (req.user.role === 'Manager') {
      const allowedUserIds = await getManagerAllowedUserIds(req.user._id);
      activeUsers = await User.find({ _id: { $in: allowedUserIds }, employmentStatus: 'Active' })
        .populate('department', 'name code');
    } else {
      activeUsers = await User.find({ employmentStatus: 'Active' })
        .populate('department', 'name code');
    }

    // 2. Identify employees who submitted for this date
    const userIds = activeUsers.map((u) => u._id);
    const submittedUserIds = await DailyWorkUpdate.find({
      date,
      user: { $in: userIds },
    }).distinct('user');

    const submittedSet = new Set(submittedUserIds.map((id) => id.toString()));

    // 3. Exclude employees on approved leave on that date
    const dateObj = new Date(date);
    const approvedLeaves = await LeaveRequest.find({
      user: { $in: userIds },
      status: 'Approved',
      startDate: { $lte: dateObj },
      endDate: { $gte: dateObj },
    }).select('user');

    const onLeaveSet = new Set(approvedLeaves.map((l) => l.user.toString()));

    // 4. Missing list
    const missingEmployees = activeUsers
      .filter((u) => !submittedSet.has(u._id.toString()) && !onLeaveSet.has(u._id.toString()))
      .map((u) => ({
        _id: u._id,
        fullName: u.fullName,
        employeeId: u.employeeId,
        email: u.email,
        designation: u.designation,
        department: u.department?.name || 'General',
      }));

    res.status(200).json({
      success: true,
      date,
      totalExpected: activeUsers.length,
      totalSubmitted: submittedSet.size,
      totalMissing: missingEmployees.length,
      missingEmployees,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
