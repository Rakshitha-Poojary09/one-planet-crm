import { Team } from '../models/Team.js';

export const getTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('department', 'name code')
      .populate('leader', 'fullName employeeId email')
      .populate('members', 'fullName employeeId email designation');
    res.status(200).json({ success: true, teams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeam = async (req, res) => {
  try {
    const { name, department, leader, members, description } = req.body;
    if (!name || !department || !leader) {
      return res.status(400).json({ success: false, message: 'Name, department, and team leader are required.' });
    }
    const team = await Team.create({
      name,
      department,
      leader,
      members: members || [],
      description,
    });
    res.status(201).json({ success: true, team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.status(200).json({ success: true, team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Team deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
