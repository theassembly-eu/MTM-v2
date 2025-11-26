import express from 'express';
import DictionaryEntry from '../models/DictionaryEntry.js';
import Project from '../models/Project.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoleOrHigher } from '../middleware/roles.js';

const router = express.Router();

// GET /api/projects/:projectId/dictionary - Get dictionary entries for a project
router.get('/projects/:projectId/dictionary', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const teamId = project.team._id.toString();
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to view dictionary for this project' });
      }
    }

    const entries = await DictionaryEntry.find({ project: req.params.projectId })
      .sort({ originalTerm: 1 });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching dictionary entries:', error);
    res.status(500).json({ error: 'Failed to fetch dictionary entries', code: 'FETCH_ERROR' });
  }
});

// POST /api/projects/:projectId/dictionary - Create dictionary entry
router.post('/projects/:projectId/dictionary', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { originalTerm, simplifiedTerm } = req.body;

    if (!originalTerm || !simplifiedTerm) {
      return res.status(400).json({ error: 'Original term and simplified term are required' });
    }

    const project = await Project.findById(req.params.projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const teamId = project.team._id.toString();
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to create dictionary entries for this project' });
      }
    }

    const entry = await DictionaryEntry.create({
      project: req.params.projectId,
      originalTerm,
      simplifiedTerm,
    });

    res.status(201).json(entry);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Dictionary entry with this original term already exists for this project' });
    }
    console.error('Error creating dictionary entry:', error);
    res.status(500).json({ error: 'Failed to create dictionary entry', code: 'CREATE_ERROR' });
  }
});

// PUT /api/dictionary/:id - Update dictionary entry
router.put('/:id', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { originalTerm, simplifiedTerm } = req.body;

    const entry = await DictionaryEntry.findById(req.params.id).populate('project');
    if (!entry) {
      return res.status(404).json({ error: 'Dictionary entry not found' });
    }

    const project = await Project.findById(entry.project._id).populate('team');
    const teamId = project.team._id.toString();

    // Check permissions
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to update this dictionary entry' });
      }
    }

    if (originalTerm) entry.originalTerm = originalTerm;
    if (simplifiedTerm) entry.simplifiedTerm = simplifiedTerm;

    await entry.save();
    res.json(entry);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Dictionary entry with this original term already exists for this project' });
    }
    console.error('Error updating dictionary entry:', error);
    res.status(500).json({ error: 'Failed to update dictionary entry', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/dictionary/:id - Delete dictionary entry
router.delete('/:id', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const entry = await DictionaryEntry.findById(req.params.id).populate('project');
    if (!entry) {
      return res.status(404).json({ error: 'Dictionary entry not found' });
    }

    const project = await Project.findById(entry.project._id).populate('team');
    const teamId = project.team._id.toString();

    // Check permissions
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to delete this dictionary entry' });
      }
    }

    await DictionaryEntry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Dictionary entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting dictionary entry:', error);
    res.status(500).json({ error: 'Failed to delete dictionary entry', code: 'DELETE_ERROR' });
  }
});

export default router;

