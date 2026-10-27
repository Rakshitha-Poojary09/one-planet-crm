import { Department } from '../models/Department.js';
import { logAudit } from '../utils/audit.js';

export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('headOfDepartment', 'fullName employeeId email')
      .sort({ name: 1 });
    res.status(200).json({ success: true, departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, code, description, headOfDepartment } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Department name and code are required.' });
    }

    const dept = await Department.create({
      name,
      code: code.toUpperCase().trim(),
      description,
      headOfDepartment: headOfDepartment || null,
    });

    await logAudit({
      req,
      action: 'CREATE_DEPARTMENT',
      entityType: 'Department',
      entityId: dept._id,
      changeSummary: `Created department ${dept.name} (${dept.code})`,
    });

    res.status(201).json({ success: true, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.status(200).json({ success: true, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Department deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
