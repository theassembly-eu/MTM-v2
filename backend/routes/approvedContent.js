import express from 'express';
import ApprovedContent from '../models/ApprovedContent.js';
import Project from '../models/Project.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoleOrHigher, checkLvlAccessForProject } from '../middleware/roles.js';

const router = express.Router();

// GET /api/projects/:projectId/approved-content - Get approved content for a project
router.get('/projects/:projectId/approved-content', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20, search, lvl, outputFormat, dateFrom, dateTo } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const project = await Project.findById(projectId).populate('lvls', 'name code');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can see all
    } else if (req.user.role === 'ADMIN') {
      // ADMIN: Check LVL-based access
      if (!req.user.lvls || req.user.lvls.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view approved content for this project' });
      }
      // Extract LVL IDs from project (handle both populated objects and IDs)
      const projectLvlIds = (project.lvls || []).map(lvl => lvl._id || lvl);
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, projectLvlIds);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view approved content for this project' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      // Check if user's teams include the project's team
      const projectTeamId = project.team?._id || project.team;
      if (!req.user.teams.includes(projectTeamId.toString())) {
        return res.status(403).json({ error: 'Not authorized to view approved content for this project' });
      }
    } else {
      // TEAM_MEMBER can see approved content for projects in their teams
      const projectTeamId = project.team?._id || project.team;
      if (!req.user.teams.includes(projectTeamId.toString())) {
        return res.status(403).json({ error: 'Not authorized to view approved content for this project' });
      }
    }

    let query = {
      project: projectId,
      deleted: false,
    };

    // Search functionality
    if (search && search.trim()) {
      query.$or = [
        { originalText: { $regex: search.trim(), $options: 'i' } },
        { simplifiedText: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Filter by LVL
    if (lvl) {
      query.lvl = lvl;
    }

    // Filter by output format
    if (outputFormat) {
      query.outputFormat = outputFormat;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.approvedAt = {};
      if (dateFrom) {
        query.approvedAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const dateToObj = new Date(dateTo);
        dateToObj.setHours(23, 59, 59, 999); // Include entire end date
        query.approvedAt.$lte = dateToObj;
      }
    }

    // Filter by tag
    if (req.query.tag) {
      query.tags = { $in: [req.query.tag.trim().toLowerCase()] };
    }

    const approvedContent = await ApprovedContent.find(query)
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('lvl', 'name code')
      .populate('approvedBy', 'email name')
      .populate('metadata.originalUser', 'email name')
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await ApprovedContent.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: approvedContent,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching approved content:', error);
    res.status(500).json({ error: 'Failed to fetch approved content', code: 'FETCH_ERROR' });
  }
});

// GET /api/projects/:projectId/approved-content/:contentId - Get single approved content
router.get('/projects/:projectId/approved-content/:contentId', authenticate, async (req, res) => {
  try {
    const { projectId, contentId } = req.params;

    const project = await Project.findById(projectId).populate('lvls', 'name code');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions (same as list endpoint)
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can see all
    } else if (req.user.role === 'ADMIN') {
      // ADMIN: Check LVL-based access
      if (!req.user.lvls || req.user.lvls.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view this approved content' });
      }
      // Extract LVL IDs from project (handle both populated objects and IDs)
      const projectLvlIds = (project.lvls || []).map(lvl => lvl._id || lvl);
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, projectLvlIds);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view this approved content' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      const projectTeamId = project.team?._id || project.team;
      if (!req.user.teams.includes(projectTeamId.toString())) {
        return res.status(403).json({ error: 'Not authorized to view this approved content' });
      }
    } else {
      const projectTeamId = project.team?._id || project.team;
      if (!req.user.teams.includes(projectTeamId.toString())) {
        return res.status(403).json({ error: 'Not authorized to view this approved content' });
      }
    }

    const content = await ApprovedContent.findOne({
      _id: contentId,
      project: projectId,
      deleted: false,
    })
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('lvl', 'name code')
      .populate('approvedBy', 'email name')
      .populate('metadata.originalUser', 'email name');

    if (!content) {
      return res.status(404).json({ error: 'Approved content not found' });
    }

    res.json(content);
  } catch (error) {
    console.error('Error fetching approved content:', error);
    res.status(500).json({ error: 'Failed to fetch approved content', code: 'FETCH_ERROR' });
  }
});

// DELETE /api/projects/:projectId/approved-content/:contentId - Soft delete approved content (TEAM_LEADER or ADMIN)
router.delete('/projects/:projectId/approved-content/:contentId', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { projectId, contentId } = req.params;

    const project = await Project.findById(projectId).populate('lvls', 'name code');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    if (req.user.role === 'ADMIN') {
      // ADMIN: Check LVL-based access
      if (!req.user.lvls || req.user.lvls.length === 0) {
        return res.status(403).json({ error: 'Not authorized to delete approved content from this project' });
      }
      // Extract LVL IDs from project (handle both populated objects and IDs)
      const projectLvlIds = (project.lvls || []).map(lvl => lvl._id || lvl);
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, projectLvlIds);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to delete approved content from this project' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      const projectTeamId = project.team?._id || project.team;
      if (!req.user.teams.includes(projectTeamId.toString())) {
        return res.status(403).json({ error: 'Not authorized to delete approved content from this project' });
      }
    }

    const content = await ApprovedContent.findOne({
      _id: contentId,
      project: projectId,
      deleted: false,
    });

    if (!content) {
      return res.status(404).json({ error: 'Approved content not found' });
    }

    // Soft delete
    content.deleted = true;
    content.deletedAt = new Date();
    content.deletedBy = req.user.id;
    await content.save();

    res.json({ message: 'Approved content deleted successfully' });
  } catch (error) {
    console.error('Error deleting approved content:', error);
    res.status(500).json({ error: 'Failed to delete approved content', code: 'DELETE_ERROR' });
  }
});

// PUT /api/approved-content/:id/tags - Add or remove tags
router.put('/approved-content/:id/tags', authenticate, requireRoleOrHigher('TEAM_MEMBER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, tag } = req.body;

    if (!action || !tag) {
      return res.status(400).json({ error: 'action and tag are required' });
    }

    if (action !== 'add' && action !== 'remove') {
      return res.status(400).json({ error: 'action must be "add" or "remove"' });
    }

    const content = await ApprovedContent.findById(id).populate('project', 'team lvls');
    if (!content || content.deleted) {
      return res.status(404).json({ error: 'Approved content not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can edit all
    } else if (req.user.role === 'ADMIN') {
      const hasAccess = checkLvlAccessForProject(req.user.lvls, (content.project.lvls || []).map(lvl => lvl._id || lvl));
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to edit tags for this content' });
      }
    } else { // TEAM_LEADER, TEAM_MEMBER
      const projectTeamId = content.project.team?._id || content.project.team;
      if (!req.user.teams.includes(projectTeamId.toString())) {
        return res.status(403).json({ error: 'Not authorized to edit tags for this content' });
      }
    }

    const normalizedTag = tag.trim().toLowerCase();
    
    if (action === 'add') {
      if (!content.tags) {
        content.tags = [];
      }
      if (content.tags.includes(normalizedTag)) {
        return res.status(400).json({ error: 'Tag already exists' });
      }
      content.tags.push(normalizedTag);
    } else if (action === 'remove') {
      if (!content.tags || !content.tags.includes(normalizedTag)) {
        return res.status(400).json({ error: 'Tag does not exist' });
      }
      content.tags = content.tags.filter(t => t !== normalizedTag);
    }

    await content.save();

    const updatedContent = await ApprovedContent.findById(id)
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('lvl', 'name code')
      .populate('approvedBy', 'email name')
      .populate('metadata.originalUser', 'email name');

    res.json(updatedContent);
  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).json({ error: 'Failed to update tags', code: 'TAG_UPDATE_ERROR' });
  }
});

export default router;

