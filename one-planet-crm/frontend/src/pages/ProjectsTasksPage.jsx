import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiFolder, FiCheckSquare, FiAlertCircle, FiEdit2, FiTrash2 } from 'react-icons/fi';

export const ProjectsTasksPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' or 'tasks'
  const [loading, setLoading] = useState(true);

  // Project Modal
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    clientName: '',
    description: '',
    deadline: '',
    priority: 'Medium',
  });

  // Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    project: '',
    assignedTo: '',
    deadline: '',
    priority: 'Medium',
  });

  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, taskRes] = await Promise.all([
        api.get('/work/projects'),
        api.get('/work/tasks'),
      ]);
      if (projRes.data?.success) setProjects(projRes.data.projects);
      if (taskRes.data?.success) setTasks(taskRes.data.tasks);

      if (isAdminOrManager) {
        const uRes = await api.get('/users');
        if (uRes.data?.success) setUsers(uRes.data.users);
      }
    } catch (err) {
      toast.error('Failed to load projects and tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/work/projects', projectForm);
      toast.success('Project created successfully.');
      setShowProjectModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project.');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/work/tasks', taskForm);
      toast.success('Task created and assigned.');
      setShowTaskModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task.');
    }
  };

  const handleUpdateTaskStatus = async (taskId, nextStatus) => {
    try {
      await api.put(`/work/tasks/${taskId}`, { status: nextStatus });
      toast.success(`Task moved to ${nextStatus}.`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update task status.');
    }
  };

  return (
    <MainLayout
      title="Projects & Work Deliverables"
      subtitle="Track ongoing deliverables, milestones, assignments & task completion"
    >
      {/* Tab Switcher & Top Actions */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div className="btn-group">
          <button
            className={`btn btn-sm ${activeTab === 'projects' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects ({projects.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'tasks' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks ({tasks.length})
          </button>
        </div>

        {isAdminOrManager && (
          <div className="d-flex gap-2">
            <button
              onClick={() => {
                setProjectForm({
                  name: '',
                  clientName: '',
                  description: '',
                  deadline: '',
                  priority: 'Medium',
                });
                setShowProjectModal(true);
              }}
              className="btn btn-sm btn-outline-primary"
            >
              <FiPlus /> New Project
            </button>
            <button
              onClick={() => {
                setTaskForm({
                  title: '',
                  description: '',
                  project: projects[0]?._id || '',
                  assignedTo: users[0]?._id || '',
                  deadline: '',
                  priority: 'Medium',
                });
                setShowTaskModal(true);
              }}
              className="btn-opt-primary btn-sm"
            >
              <FiPlus /> Assign Task
            </button>
          </div>
        )}
      </div>

      {/* Projects Tab */}
      {activeTab === 'projects' ? (
        <div className="row g-4">
          {projects.length > 0 ? (
            projects.map((p) => (
              <div key={p._id} className="col-lg-6">
                <div className="opt-card mb-0 h-100">
                  <div className="opt-card-header bg-light">
                    <div>
                      <h5 className="mb-0 text-dark">{p.name}</h5>
                      <span className="text-muted small">Client: {p.clientName || 'Internal'}</span>
                    </div>
                    <span className={`badge-status ${p.status.toLowerCase().replace(' ', '-')}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="opt-card-body">
                    <p className="text-secondary small mb-3">{p.description || 'No description provided.'}</p>

                    <div className="mb-3">
                      <div className="d-flex justify-content-between text-muted small mb-1">
                        <span>Completion ({p.completedTasks || 0}/{p.totalTasks || 0} tasks)</span>
                        <span className="fw-bold">{p.progress || 0}%</span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-primary"
                          role="progressbar"
                          style={{ width: `${p.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center text-muted small border-top pt-3">
                      <span>Priority: <strong className="text-dark">{p.priority}</strong></span>
                      <span>Due: <strong className="text-dark">{new Date(p.deadline).toLocaleDateString()}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-12 text-center py-5 bg-white rounded border text-muted">
              No projects created yet.
            </div>
          )}
        </div>
      ) : (
        /* Tasks Tab */
        <div className="opt-card mb-0">
          <div className="table-responsive">
            <table className="opt-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Project</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length > 0 ? (
                  tasks.map((t) => (
                    <tr key={t._id}>
                      <td>
                        <div className="fw-semibold text-dark">{t.title}</div>
                        <div className="text-muted small">{t.description}</div>
                      </td>
                      <td>{t.project?.name || 'General'}</td>
                      <td>
                        <span className="fw-medium text-dark">{t.assignedTo?.fullName}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{t.priority}</span>
                      </td>
                      <td>
                        <span className="small text-muted">{new Date(t.deadline).toLocaleDateString()}</span>
                      </td>
                      <td>
                        <span className={`badge-status ${t.status.toLowerCase().replace(' ', '-')}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          style={{ maxWidth: 140 }}
                          value={t.status}
                          onChange={(e) => handleUpdateTaskStatus(t._id, e.target.value)}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Blocked">Blocked</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No tasks assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showProjectModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Create New Project</h5>
                <button type="button" className="btn-close" onClick={() => setShowProjectModal(false)}></button>
              </div>
              <form onSubmit={handleCreateProject}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Project Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={projectForm.name}
                      onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Client / Account Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Acme Corp, Internal Platform"
                      value={projectForm.clientName}
                      onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Deadline *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={projectForm.deadline}
                        onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select"
                        value={projectForm.priority}
                        onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={projectForm.description}
                      onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProjectModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {showTaskModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Assign New Task</h5>
                <button type="button" className="btn-close" onClick={() => setShowTaskModal(false)}></button>
              </div>
              <form onSubmit={handleCreateTask}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Task Title *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Project *</label>
                      <select
                        className="form-select"
                        required
                        value={taskForm.project}
                        onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value })}
                      >
                        <option value="">Select Project</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Assignee *</label>
                      <select
                        className="form-select"
                        required
                        value={taskForm.assignedTo}
                        onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                      >
                        <option value="">Select Employee</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.fullName} ({u.employeeId})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Deadline *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={taskForm.deadline}
                        onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select"
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Task Specifications</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Assign Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
