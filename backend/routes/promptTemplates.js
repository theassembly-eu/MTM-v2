import express from 'express';
import PromptTemplate from '../models/PromptTemplate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requireRoleOrHigher } from '../middleware/roles.js';

const router = express.Router();

// GET /api/prompt-templates - Get prompt templates (filtered by permissions)
router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, projectId, scope } = req.query;
    let query = {};

    // SUPER_ADMIN can see all templates
    if (req.user.role === 'SUPER_ADMIN') {
      if (scope) query.scope = scope;
      if (teamId) query.team = teamId;
      if (projectId) query.project = projectId;
    }
    // ADMIN can see global and their team templates
    else if (req.user.role === 'ADMIN') {
      query.$or = [
        { scope: 'GLOBAL' },
        { team: { $in: req.user.teams } },
      ];
      if (teamId && req.user.teams.includes(teamId)) {
        query.team = teamId;
      }
      if (projectId) {
        query.project = projectId;
      }
    }
    // TEAM_LEADER can see global, their team, and their team's project templates
    else if (req.user.role === 'TEAM_LEADER') {
      query.$or = [
        { scope: 'GLOBAL' },
        { team: { $in: req.user.teams } },
      ];
      if (teamId && req.user.teams.includes(teamId)) {
        query.team = teamId;
      }
      if (projectId) {
        query.project = projectId;
      }
    }
    // TEAM_MEMBER can see global and their team templates
    else {
      query.$or = [
        { scope: 'GLOBAL' },
        { team: { $in: req.user.teams } },
      ];
    }

    const templates = await PromptTemplate.find(query)
      .populate('createdBy', 'name email')
      .populate('team', 'name')
      .populate('project', 'name')
      .sort({ updatedAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    res.status(500).json({ error: 'Failed to fetch prompt templates', code: 'FETCH_ERROR' });
  }
});

// GET /api/prompt-templates/:id - Get single template
router.get('/:id', authenticate, async (req, res) => {
  try {
    const template = await PromptTemplate.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('team', 'name')
      .populate('project', 'name');

    if (!template) {
      return res.status(404).json({ error: 'Prompt template not found' });
    }

    // Check permissions
    if (template.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized to view global templates' });
    }

    if (template.scope === 'TEAM' && template.team) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
        if (!req.user.teams.includes(template.team.toString())) {
          return res.status(403).json({ error: 'Not authorized to view this template' });
        }
      }
    }

    if (template.scope === 'PROJECT' && template.project) {
      // Additional project permission checks can be added here
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching prompt template:', error);
    res.status(500).json({ error: 'Failed to fetch prompt template', code: 'FETCH_ERROR' });
  }
});

// POST /api/prompt-templates - Create new template
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, prompt, teamId, projectId, scope, context } = req.body;

    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required' });
    }

    // Determine scope
    let finalScope = scope || 'TEAM';
    let finalTeamId = null;
    let finalProjectId = null;

    if (req.user.role === 'SUPER_ADMIN') {
      if (scope === 'GLOBAL') {
        finalScope = 'GLOBAL';
        finalTeamId = null;
        finalProjectId = null;
      } else if (teamId) {
        finalScope = projectId ? 'PROJECT' : 'TEAM';
        finalTeamId = teamId;
        finalProjectId = projectId || null;
      }
    } else if (req.user.role === 'ADMIN' || req.user.role === 'TEAM_LEADER') {
      // Can only create team or project templates
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required for your role' });
      }
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to create templates for this team' });
      }
      finalScope = projectId ? 'PROJECT' : 'TEAM';
      finalTeamId = teamId;
      finalProjectId = projectId || null;
    } else {
      // TEAM_MEMBER can only create team templates
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' });
      }
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to create templates for this team' });
      }
      finalScope = 'TEAM';
      finalTeamId = teamId;
      finalProjectId = null;
    }

    const template = await PromptTemplate.create({
      name,
      description: description || '',
      prompt,
      createdBy: req.user.id,
      team: finalTeamId,
      project: finalProjectId,
      scope: finalScope,
      context: context || {},
    });

    const populatedTemplate = await PromptTemplate.findById(template._id)
      .populate('createdBy', 'name email')
      .populate('team', 'name')
      .populate('project', 'name');

    res.status(201).json(populatedTemplate);
  } catch (error) {
    console.error('Error creating prompt template:', error);
    res.status(500).json({ error: 'Failed to create prompt template', code: 'CREATE_ERROR' });
  }
});

// PUT /api/prompt-templates/:id - Update template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, prompt } = req.body;
    const template = await PromptTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Prompt template not found' });
    }

    // Check permissions
    if (template.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can edit global templates' });
    }

    if (template.scope === 'TEAM' && template.team) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
        if (template.createdBy.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to edit this template' });
        }
      }
      if (req.user.role !== 'SUPER_ADMIN' && !req.user.teams.includes(template.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to edit this template' });
      }
    }

    if (template.scope === 'PROJECT' && template.project) {
      // Additional project permission checks
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
        if (template.createdBy.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to edit this template' });
        }
      }
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (prompt) template.prompt = prompt;

    await template.save();

    const populatedTemplate = await PromptTemplate.findById(template._id)
      .populate('createdBy', 'name email')
      .populate('team', 'name')
      .populate('project', 'name');

    res.json(populatedTemplate);
  } catch (error) {
    console.error('Error updating prompt template:', error);
    res.status(500).json({ error: 'Failed to update prompt template', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/prompt-templates/:id - Delete template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const template = await PromptTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Prompt template not found' });
    }

    // Check permissions
    if (template.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can delete global templates' });
    }

    if (template.scope === 'TEAM' && template.team) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
        if (template.createdBy.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to delete this template' });
        }
      }
      if (req.user.role !== 'SUPER_ADMIN' && !req.user.teams.includes(template.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to delete this template' });
      }
    }

    if (template.scope === 'PROJECT' && template.project) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
        if (template.createdBy.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to delete this template' });
        }
      }
    }

    await PromptTemplate.findByIdAndDelete(req.params.id);

    res.json({ message: 'Prompt template deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt template:', error);
    res.status(500).json({ error: 'Failed to delete prompt template', code: 'DELETE_ERROR' });
  }
});

// POST /api/prompt-templates/:id/use - Increment usage counter
router.post('/:id/use', authenticate, async (req, res) => {
  try {
    const template = await PromptTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Prompt template not found' });
    }

    template.usageCount = (template.usageCount || 0) + 1;
    template.lastUsed = new Date();
    await template.save();

    res.json({ message: 'Usage recorded', usageCount: template.usageCount });
  } catch (error) {
    console.error('Error recording template usage:', error);
    res.status(500).json({ error: 'Failed to record usage', code: 'USAGE_ERROR' });
  }
});

export default router;

