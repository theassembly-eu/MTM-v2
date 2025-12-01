import express from 'express';
import PromptTemplate from '../models/PromptTemplate.js';
import SystemPromptTemplate from '../models/SystemPromptTemplate.js';
import { assemblePromptTemplate } from '../utils/assemblePromptTemplate.js';
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
    // ADMIN can see global and templates for teams with their LVLs
    else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // Find teams that have at least one of the ADMIN's LVLs
      const Team = (await import('../models/Team.js')).default;
      const teams = await Team.find({ lvls: { $in: req.user.lvls } }).select('_id');
      const teamIds = teams.map(t => t._id);
      
      query.$or = [
        { scope: 'GLOBAL' },
        { team: { $in: teamIds } },
      ];
      if (teamId && teamIds.some(id => id.toString() === teamId)) {
        query.team = teamId;
      }
      if (projectId) {
        // Find projects using ADMIN's LVLs
        const Project = (await import('../models/Project.js')).default;
        const projects = await Project.find({ lvls: { $in: req.user.lvls } }).select('_id');
        const projectIds = projects.map(p => p._id);
        if (projectIds.some(id => id.toString() === projectId)) {
          query.project = projectId;
        }
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can see global and their team templates (if no LVLs assigned yet)
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
    const { 
      name, 
      description, 
      prompt, 
      teamId, 
      projectId, 
      scope, 
      context,
      useComponents,
      componentReferences,
    } = req.body;

    // Validate: either prompt or componentReferences must be provided
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!useComponents && !prompt) {
      return res.status(400).json({ error: 'Either prompt or componentReferences is required' });
    }

    if (useComponents && (!componentReferences || componentReferences.length === 0)) {
      return res.status(400).json({ error: 'componentReferences is required when useComponents is true' });
    }

    // Validate component references if using components
    if (useComponents && componentReferences) {
      const systemTemplateIds = componentReferences.map(ref => ref.systemTemplateId);
      const systemTemplates = await SystemPromptTemplate.find({
        _id: { $in: systemTemplateIds },
      });

      if (systemTemplates.length !== systemTemplateIds.length) {
        return res.status(400).json({ error: 'One or more system template IDs are invalid' });
      }

      // Validate that component references have required fields
      for (const ref of componentReferences) {
        if (!ref.systemTemplateId || ref.order === undefined) {
          return res.status(400).json({ error: 'Each component reference must have systemTemplateId and order' });
        }
      }
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
    } else if (req.user.role === 'ADMIN') {
      // ADMIN can create TEAM templates for teams with their LVLs
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required for your role' });
      }
      // Check if ADMIN has access to this team based on LVLs
      if (req.user.lvls && req.user.lvls.length > 0) {
        const Team = (await import('../models/Team.js')).default;
        const team = await Team.findById(teamId).select('lvls');
        if (team) {
          const teamLvlIds = team.lvls.map(id => id.toString());
          const adminLvlIds = req.user.lvls.map(id => id.toString());
          const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
          if (!hasMatchingLvl) {
            return res.status(403).json({ error: 'Not authorized to create templates for this team' });
          }
        }
      } else {
        // Fallback: ADMIN can create templates for their teams (if no LVLs assigned yet)
        if (!req.user.teams.includes(teamId)) {
          return res.status(403).json({ error: 'Not authorized to create templates for this team' });
        }
      }
      // ADMIN can only create TEAM templates (not PROJECT)
      finalScope = 'TEAM';
      finalTeamId = teamId;
      finalProjectId = null;
    } else if (req.user.role === 'TEAM_LEADER') {
      // TEAM_LEADER can create TEAM or PROJECT templates for their teams
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
      // TEAM_MEMBER cannot create templates
      return res.status(403).json({ error: 'TEAM_MEMBER cannot create templates' });
    }

    // Prepare component references with denormalized names
    let processedComponentReferences = null;
    if (useComponents && componentReferences) {
      const systemTemplateIds = componentReferences.map(ref => ref.systemTemplateId);
      const systemTemplates = await SystemPromptTemplate.find({
        _id: { $in: systemTemplateIds },
      });
      
      const templateMap = new Map();
      systemTemplates.forEach(t => templateMap.set(t._id.toString(), t));

      processedComponentReferences = componentReferences.map(ref => ({
        systemTemplateId: ref.systemTemplateId,
        systemTemplateName: templateMap.get(ref.systemTemplateId.toString())?.name || 'Unknown',
        order: ref.order,
        enabled: ref.enabled !== false, // Default to true
      }));
    }

    const template = await PromptTemplate.create({
      name,
      description: description || '',
      prompt: prompt || '', // Can be empty if using components
      useComponents: useComponents || false,
      componentReferences: processedComponentReferences || [],
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
    const { name, description, prompt, useComponents, componentReferences } = req.body;
    const template = await PromptTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Prompt template not found' });
    }

    // Check permissions
    if (template.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can edit global templates' });
    }

    if (template.scope === 'TEAM' && template.team) {
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN can edit any template
      } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
        // ADMIN can edit TEAM templates for teams with their LVLs
        const Team = (await import('../models/Team.js')).default;
        const team = await Team.findById(template.team).select('lvls');
        if (team) {
          const teamLvlIds = team.lvls.map(id => id.toString());
          const adminLvlIds = req.user.lvls.map(id => id.toString());
          const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
          if (!hasMatchingLvl) {
            return res.status(403).json({ error: 'Not authorized to edit this template' });
          }
        }
      } else if (req.user.role === 'ADMIN') {
        // Fallback: ADMIN can edit templates for their teams (if no LVLs assigned yet)
        if (!req.user.teams.includes(template.team.toString())) {
          return res.status(403).json({ error: 'Not authorized to edit this template' });
        }
      } else if (req.user.role === 'TEAM_LEADER') {
        // TEAM_LEADER can edit templates for their teams
        if (!req.user.teams.includes(template.team.toString())) {
          return res.status(403).json({ error: 'Not authorized to edit this template' });
        }
      } else {
        // Others can only edit their own templates
        if (template.createdBy.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to edit this template' });
        }
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
    
    // Handle component-based vs full-text updates
    if (useComponents !== undefined) {
      template.useComponents = useComponents;
      
      if (useComponents && componentReferences) {
        // Validate component references
        const systemTemplateIds = componentReferences.map(ref => ref.systemTemplateId);
        const systemTemplates = await SystemPromptTemplate.find({
          _id: { $in: systemTemplateIds },
        });

        if (systemTemplates.length !== systemTemplateIds.length) {
          return res.status(400).json({ error: 'One or more system template IDs are invalid' });
        }

        // Process component references
        const templateMap = new Map();
        systemTemplates.forEach(t => templateMap.set(t._id.toString(), t));

        template.componentReferences = componentReferences.map(ref => ({
          systemTemplateId: ref.systemTemplateId,
          systemTemplateName: templateMap.get(ref.systemTemplateId.toString())?.name || 'Unknown',
          order: ref.order,
          enabled: ref.enabled !== false,
        }));
      } else if (!useComponents) {
        // Clear component references when switching to full-text
        template.componentReferences = [];
      }
    }
    
    if (prompt !== undefined) {
      // Only update prompt if not using components, or if explicitly provided
      if (!template.useComponents || prompt) {
        template.prompt = prompt;
      }
    }

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
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN can delete any template
      } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
        // ADMIN can delete TEAM templates for teams with their LVLs
        const Team = (await import('../models/Team.js')).default;
        const team = await Team.findById(template.team).select('lvls');
        if (team) {
          const teamLvlIds = team.lvls.map(id => id.toString());
          const adminLvlIds = req.user.lvls.map(id => id.toString());
          const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
          if (!hasMatchingLvl) {
            return res.status(403).json({ error: 'Not authorized to delete this template' });
          }
        }
      } else if (req.user.role === 'ADMIN') {
        // Fallback: ADMIN can delete templates for their teams (if no LVLs assigned yet)
        if (!req.user.teams.includes(template.team.toString())) {
          return res.status(403).json({ error: 'Not authorized to delete this template' });
        }
      } else if (req.user.role === 'TEAM_LEADER') {
        // TEAM_LEADER can delete templates for their teams
        if (!req.user.teams.includes(template.team.toString())) {
          return res.status(403).json({ error: 'Not authorized to delete this template' });
        }
      } else {
        // Others can only delete their own templates
        if (template.createdBy.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to delete this template' });
        }
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

// POST /api/prompt-templates/:id/preview - Preview assembled prompt
router.post('/:id/preview', authenticate, async (req, res) => {
  try {
    const template = await PromptTemplate.findById(req.params.id)
      .populate('componentReferences.systemTemplateId');
    
    if (!template) {
      return res.status(404).json({ error: 'Prompt template not found' });
    }

    // Check permissions (same as GET)
    if (template.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized to view global templates' });
    }

    // Get context from request body (for variable resolution)
    const context = req.body.context || {};

    // Assemble the prompt
    const result = await assemblePromptTemplate(template, context);

    res.json({
      prompt: result.prompt,
      source: result.source,
      componentsUsed: result.componentsUsed,
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template', code: 'PREVIEW_ERROR' });
  }
});

export default router;

