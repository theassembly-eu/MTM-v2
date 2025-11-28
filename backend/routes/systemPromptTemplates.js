import express from 'express';
import SystemPromptTemplate from '../models/SystemPromptTemplate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateTemplate } from '../utils/promptTemplateEngine.js';

const router = express.Router();

// GET /api/system-prompt-templates - Get all system prompt templates (SUPER_ADMIN only)
router.get('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = {};
    
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const templates = await SystemPromptTemplate.find(filter).sort({ priority: 1, name: 1 });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching system prompt templates:', error);
    res.status(500).json({ error: 'Failed to fetch system prompt templates', code: 'FETCH_ERROR' });
  }
});

// GET /api/system-prompt-templates/:id - Get a specific template
router.get('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await SystemPromptTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'System prompt template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching system prompt template:', error);
    res.status(500).json({ error: 'Failed to fetch system prompt template', code: 'FETCH_ERROR' });
  }
});

// POST /api/system-prompt-templates - Create a new system prompt template (SUPER_ADMIN only)
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      content,
      variables,
      conditions,
      priority,
      version,
      isActive,
      metadata,
    } = req.body;

    if (!name || !type || !content) {
      return res.status(400).json({ error: 'Name, type, and content are required' });
    }

    // Validate template
    const validation = validateTemplate({ name, type, content, variables: variables || [] });
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Template validation failed', 
        details: validation.errors 
      });
    }

    const template = await SystemPromptTemplate.create({
      name,
      description: description || '',
      type,
      content,
      variables: variables || [],
      conditions: conditions || [],
      priority: priority || 0,
      version: version || '1.0.0',
      isActive: isActive !== undefined ? isActive : true,
      metadata: metadata || { author: 'system' },
    });

    res.status(201).json(template);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'System prompt template with this name already exists' });
    }
    console.error('Error creating system prompt template:', error);
    res.status(500).json({ error: 'Failed to create system prompt template', code: 'CREATE_ERROR' });
  }
});

// PUT /api/system-prompt-templates/:id - Update a system prompt template (SUPER_ADMIN only)
router.put('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await SystemPromptTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'System prompt template not found' });
    }

    const {
      name,
      description,
      type,
      content,
      variables,
      conditions,
      priority,
      version,
      isActive,
      metadata,
    } = req.body;

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (type) template.type = type;
    if (content) template.content = content;
    if (variables !== undefined) template.variables = variables;
    if (conditions !== undefined) template.conditions = conditions;
    if (priority !== undefined) template.priority = priority;
    if (version !== undefined) template.version = version;
    if (isActive !== undefined) template.isActive = isActive;
    if (metadata !== undefined) template.metadata = { ...template.metadata, ...metadata };

    // Validate template before saving
    const validation = validateTemplate({
      name: template.name,
      type: template.type,
      content: template.content,
      variables: template.variables || [],
    });
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Template validation failed', 
        details: validation.errors 
      });
    }

    await template.save();
    res.json(template);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'System prompt template with this name already exists' });
    }
    console.error('Error updating system prompt template:', error);
    res.status(500).json({ error: 'Failed to update system prompt template', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/system-prompt-templates/:id - Delete a system prompt template (SUPER_ADMIN only)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await SystemPromptTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'System prompt template not found' });
    }
    res.json({ message: 'System prompt template deleted successfully' });
  } catch (error) {
    console.error('Error deleting system prompt template:', error);
    res.status(500).json({ error: 'Failed to delete system prompt template', code: 'DELETE_ERROR' });
  }
});

export default router;

