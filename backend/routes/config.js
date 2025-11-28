import express from 'express';
import TargetAudience from '../models/TargetAudience.js';
import OutputFormat from '../models/OutputFormat.js';
import Language from '../models/Language.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = express.Router();

// ========== Target Audiences ==========

// GET /api/target-audiences
router.get('/target-audiences', authenticate, async (req, res) => {
  try {
    const audiences = await TargetAudience.find().sort({ name: 1 });
    res.json(audiences);
  } catch (error) {
    console.error('Error fetching target audiences:', error);
    res.status(500).json({ error: 'Failed to fetch target audiences', code: 'FETCH_ERROR' });
  }
});

// POST /api/target-audiences
router.post('/target-audiences', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const audience = await TargetAudience.create({ name, description: description || '' });
    res.status(201).json(audience);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Target audience with this name already exists' });
    }
    console.error('Error creating target audience:', error);
    res.status(500).json({ error: 'Failed to create target audience', code: 'CREATE_ERROR' });
  }
});

// PUT /api/target-audiences/:id
router.put('/target-audiences/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const audience = await TargetAudience.findById(req.params.id);
    if (!audience) {
      return res.status(404).json({ error: 'Target audience not found' });
    }

    if (name) audience.name = name;
    if (description !== undefined) audience.description = description;
    await audience.save();

    res.json(audience);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Target audience with this name already exists' });
    }
    console.error('Error updating target audience:', error);
    res.status(500).json({ error: 'Failed to update target audience', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/target-audiences/:id
router.delete('/target-audiences/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const audience = await TargetAudience.findByIdAndDelete(req.params.id);
    if (!audience) {
      return res.status(404).json({ error: 'Target audience not found' });
    }
    res.json({ message: 'Target audience deleted successfully' });
  } catch (error) {
    console.error('Error deleting target audience:', error);
    res.status(500).json({ error: 'Failed to delete target audience', code: 'DELETE_ERROR' });
  }
});

// ========== Output Formats ==========

// GET /api/output-formats
router.get('/output-formats', authenticate, async (req, res) => {
  try {
    const formats = await OutputFormat.find().sort({ name: 1 });
    res.json(formats);
  } catch (error) {
    console.error('Error fetching output formats:', error);
    res.status(500).json({ error: 'Failed to fetch output formats', code: 'FETCH_ERROR' });
  }
});

// POST /api/output-formats
router.post('/output-formats', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { 
      name, 
      description,
      requiresImageSuggestion,
      requiresStructuredOutput,
      outputStructure,
      behavioralRules
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const formatData = {
      name,
      description: description || '',
      requiresImageSuggestion: requiresImageSuggestion || false,
      requiresStructuredOutput: requiresStructuredOutput !== undefined ? requiresStructuredOutput : true,
    };
    
    if (outputStructure) {
      formatData.outputStructure = outputStructure;
    }
    
    if (behavioralRules) {
      formatData.behavioralRules = behavioralRules;
    }

    const format = await OutputFormat.create(formatData);
    res.status(201).json(format);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Output format with this name already exists' });
    }
    console.error('Error creating output format:', error);
    res.status(500).json({ error: 'Failed to create output format', code: 'CREATE_ERROR' });
  }
});

// PUT /api/output-formats/:id
router.put('/output-formats/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { 
      name, 
      description,
      requiresImageSuggestion,
      requiresStructuredOutput,
      outputStructure,
      behavioralRules
    } = req.body;
    
    const format = await OutputFormat.findById(req.params.id);
    if (!format) {
      return res.status(404).json({ error: 'Output format not found' });
    }

    if (name) format.name = name;
    if (description !== undefined) format.description = description;
    if (requiresImageSuggestion !== undefined) format.requiresImageSuggestion = requiresImageSuggestion;
    if (requiresStructuredOutput !== undefined) format.requiresStructuredOutput = requiresStructuredOutput;
    if (outputStructure !== undefined) format.outputStructure = outputStructure;
    if (behavioralRules !== undefined) format.behavioralRules = behavioralRules;
    
    await format.save();

    res.json(format);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Output format with this name already exists' });
    }
    console.error('Error updating output format:', error);
    res.status(500).json({ error: 'Failed to update output format', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/output-formats/:id
router.delete('/output-formats/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const format = await OutputFormat.findByIdAndDelete(req.params.id);
    if (!format) {
      return res.status(404).json({ error: 'Output format not found' });
    }
    res.json({ message: 'Output format deleted successfully' });
  } catch (error) {
    console.error('Error deleting output format:', error);
    res.status(500).json({ error: 'Failed to delete output format', code: 'DELETE_ERROR' });
  }
});

// ========== Languages ==========

// GET /api/languages
router.get('/languages', authenticate, async (req, res) => {
  try {
    const languages = await Language.find().sort({ name: 1 });
    res.json(languages);
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ error: 'Failed to fetch languages', code: 'FETCH_ERROR' });
  }
});

// POST /api/languages
router.post('/languages', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const language = await Language.create({ 
      name, 
      code: code.toUpperCase(), 
      description: description || '' 
    });
    res.status(201).json(language);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Language with this name or code already exists' });
    }
    console.error('Error creating language:', error);
    res.status(500).json({ error: 'Failed to create language', code: 'CREATE_ERROR' });
  }
});

// PUT /api/languages/:id
router.put('/languages/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const language = await Language.findById(req.params.id);
    if (!language) {
      return res.status(404).json({ error: 'Language not found' });
    }

    if (name) language.name = name;
    if (code) language.code = code.toUpperCase();
    if (description !== undefined) language.description = description;
    await language.save();

    res.json(language);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Language with this name or code already exists' });
    }
    console.error('Error updating language:', error);
    res.status(500).json({ error: 'Failed to update language', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/languages/:id
router.delete('/languages/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const language = await Language.findByIdAndDelete(req.params.id);
    if (!language) {
      return res.status(404).json({ error: 'Language not found' });
    }
    res.json({ message: 'Language deleted successfully' });
  } catch (error) {
    console.error('Error deleting language:', error);
    res.status(500).json({ error: 'Failed to delete language', code: 'DELETE_ERROR' });
  }
});

export default router;

