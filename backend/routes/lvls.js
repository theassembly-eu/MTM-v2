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
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const lvl = await LVL.create({
      name,
      code: code.toUpperCase(),
      description: description || '',
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

export default router;

