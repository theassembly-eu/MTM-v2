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
      createNewVersion, // If true, save current state to history before updating
      changeNotes, // Notes about why this version was created
    } = req.body;

    // If createNewVersion is true, save current state to version history
    if (createNewVersion) {
      const versionHistoryEntry = {
        version: template.currentVersion || template.version,
        content: template.content,
        variables: template.variables ? JSON.parse(JSON.stringify(template.variables)) : [],
        conditions: template.conditions ? JSON.parse(JSON.stringify(template.conditions)) : [],
        priority: template.priority,
        metadata: template.metadata ? JSON.parse(JSON.stringify(template.metadata)) : {},
        createdAt: new Date(),
        createdBy: req.user.id,
        changeNotes: changeNotes || 'Version update',
      };

      if (!template.versionHistory) {
        template.versionHistory = [];
      }
      template.versionHistory.push(versionHistoryEntry);
    }

    // Update fields
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (type) template.type = type;
    if (content) template.content = content;
    if (variables !== undefined) template.variables = variables;
    if (conditions !== undefined) template.conditions = conditions;
    if (priority !== undefined) template.priority = priority;
    if (version !== undefined) {
      template.version = version;
      template.currentVersion = version; // Update current version
    }
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

// GET /api/system-prompt-templates/:id/versions - Get version history (SUPER_ADMIN only)
router.get('/:id/versions', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const template = await SystemPromptTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'System prompt template not found' });
    }
    res.json({
      currentVersion: template.currentVersion || template.version,
      versionHistory: template.versionHistory || [],
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({ error: 'Failed to fetch version history', code: 'FETCH_ERROR' });
  }
});

// POST /api/system-prompt-templates/:id/rollback - Rollback to a specific version (SUPER_ADMIN only)
router.post('/:id/rollback', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ error: 'Version is required' });
    }

    const template = await SystemPromptTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'System prompt template not found' });
    }

    // Find the version in history
    const versionEntry = template.versionHistory?.find(v => v.version === version);
    if (!versionEntry) {
      return res.status(404).json({ error: 'Version not found in history' });
    }

    // Save current state to history before rollback
    const currentVersionEntry = {
      version: template.currentVersion || template.version,
      content: template.content,
      variables: template.variables ? JSON.parse(JSON.stringify(template.variables)) : [],
      conditions: template.conditions ? JSON.parse(JSON.stringify(template.conditions)) : [],
      priority: template.priority,
      metadata: template.metadata ? JSON.parse(JSON.stringify(template.metadata)) : {},
      createdAt: new Date(),
      createdBy: req.user.id,
      changeNotes: `Rollback to version ${version}`,
    };

    if (!template.versionHistory) {
      template.versionHistory = [];
    }
    template.versionHistory.push(currentVersionEntry);

    // Restore from version history
    template.content = versionEntry.content;
    template.variables = versionEntry.variables ? JSON.parse(JSON.stringify(versionEntry.variables)) : [];
    template.conditions = versionEntry.conditions ? JSON.parse(JSON.stringify(versionEntry.conditions)) : [];
    template.priority = versionEntry.priority;
    template.currentVersion = versionEntry.version;
    template.version = versionEntry.version;

    await template.save();
    res.json(template);
  } catch (error) {
    console.error('Error rolling back version:', error);
    res.status(500).json({ error: 'Failed to rollback version', code: 'ROLLBACK_ERROR' });
  }
});

export default router;

