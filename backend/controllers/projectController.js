import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { logAudit } from '../utils/audit.js';

// --- PROJECTS ---

export const getProjects = async (req, res) => {
  try {
    const { status, priority } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const projects = await Project.find(query)
      .populate('department', 'name code')
      .populate('assignedTeam', 'name')
      .populate('members', 'fullName employeeId email designation')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });

    // Calculate completion % for each project based on tasks
    const projectsWithProgress = await Promise.all(
      projects.map(async (p) => {
        const totalTasks = await Task.countDocuments({ project: p._id });
        const completedTasks = await Task.countDocuments({ project: p._id, status: 'Completed' });
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return {
          ...p.toObject(),
          totalTasks,
          completedTasks,
          progress,
        };
      })
    );

    res.status(200).json({ success: true, projects: projectsWithProgress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, clientName, description, deadline, priority, department, assignedTeam, members } = req.body;
    if (!name || !deadline) {
      return res.status(400).json({ success: false, message: 'Project name and deadline are required.' });
    }

    const project = await Project.create({
      name,
      clientName: clientName || '',
      description: description || '',
      deadline,
      priority: priority || 'Medium',
      department: department || null,
      assignedTeam: assignedTeam || null,
      members: members || [],
      createdBy: req.user._id,
    });

    await logAudit({
      req,
      action: 'CREATE_PROJECT',
      entityType: 'Project',
      entityId: project._id,
      changeSummary: `Created project "${project.name}" with deadline ${deadline}`,
    });

    res.status(201).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    await Task.deleteMany({ project: req.params.id });
    res.status(200).json({ success: true, message: 'Project and associated tasks removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- TASKS ---

export const getTasks = async (req, res) => {
  try {
    const { project, status, priority, assignedTo } = req.query;
    const query = {};

    if (req.user.role === 'Employee') {
      query.assignedTo = req.user._id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (project) query.project = project;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
      .populate('project', 'name clientName deadline')
      .populate('assignedTo', 'fullName employeeId email designation')
      .populate('createdBy', 'fullName')
      .sort({ deadline: 1 });

    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, project, assignedTo, deadline, priority } = req.body;
    if (!title || !project || !assignedTo || !deadline) {
      return res.status(400).json({ success: false, message: 'Title, project, assignee, and deadline are required.' });
    }

    const task = await Task.create({
      title,
      description: description || '',
      project,
      assignedTo,
      deadline,
      priority: priority || 'Medium',
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Allow employee to update status and progress notes if assigned
    if (req.user.role === 'Employee') {
      if (task.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
      if (req.body.status) task.status = req.body.status;
      if (req.body.progressNotes !== undefined) task.progressNotes = req.body.progressNotes;
      await task.save();
      return res.status(200).json({ success: true, task });
    }

    // Admin / Manager can update all fields
    Object.assign(task, req.body);
    await task.save();

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Task removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
