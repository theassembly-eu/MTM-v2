import express from 'express';
import LVL from '../models/LVL.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = express.Router();

// GET /api/lvls - Get all LVLs (authenticated users)
router.get('/', authenticate, async (req, res) => {
  try {
    const lvls = await LVL.find().sort({ name: 1 });
    res.json(lvls);
  } catch (error) {
    console.error('Error fetching LVLs:', error);
    res.status(500).json({ error: 'Failed to fetch LVLs', code: 'FETCH_ERROR' });
  }
});

// POST /api/lvls - Create new LVL (SUPER_ADMIN only)
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, code, description, places } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const lvl = await LVL.create({
      name,
      code: code.toUpperCase(),
      description: description || '',
      places: places || [],
    });

    res.status(201).json(lvl);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'LVL with this name or code already exists' });
    }
    console.error('Error creating LVL:', error);
    res.status(500).json({ error: 'Failed to create LVL', code: 'CREATE_ERROR' });
  }
});

// PUT /api/lvls/:id - Update LVL (SUPER_ADMIN only)
router.put('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, code, description, places } = req.body;
    const lvl = await LVL.findById(req.params.id);

    if (!lvl) {
      return res.status(404).json({ error: 'LVL not found' });
    }

    if (name) lvl.name = name;
    if (code) lvl.code = code.toUpperCase();
    if (description !== undefined) lvl.description = description;
    if (places !== undefined) lvl.places = places;

    await lvl.save();
    res.json(lvl);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'LVL with this name or code already exists' });
    }
    console.error('Error updating LVL:', error);
    res.status(500).json({ error: 'Failed to update LVL', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/lvls/:id - Delete LVL (SUPER_ADMIN only)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const lvl = await LVL.findById(req.params.id);
    if (!lvl) {
      return res.status(404).json({ error: 'LVL not found' });
    }

    // Check if LVL is used in any teams or projects
    const Team = (await import('../models/Team.js')).default;
    const Project = (await import('../models/Project.js')).default;
    
    const teamsUsingLvl = await Team.countDocuments({ lvls: req.params.id });
    const projectsUsingLvl = await Project.countDocuments({ lvls: req.params.id });

    if (teamsUsingLvl > 0 || projectsUsingLvl > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete LVL that is in use',
        teamsCount: teamsUsingLvl,
        projectsCount: projectsUsingLvl,
      });
    }

    await LVL.findByIdAndDelete(req.params.id);
    res.json({ message: 'LVL deleted successfully' });
  } catch (error) {
    console.error('Error deleting LVL:', error);
    res.status(500).json({ error: 'Failed to delete LVL', code: 'DELETE_ERROR' });
  }
});

export default router;

