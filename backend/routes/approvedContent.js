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
    const { page = 1, limit = 20, search } = req.query;
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
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, project.lvls || []);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view approved content for this project' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      // Check if user's teams include the project's team
      if (!req.user.teams.includes(project.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to view approved content for this project' });
      }
    } else {
      // TEAM_MEMBER can see approved content for projects in their teams
      if (!req.user.teams.includes(project.team.toString())) {
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
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, project.lvls || []);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view this approved content' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams.includes(project.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to view this approved content' });
      }
    } else {
      if (!req.user.teams.includes(project.team.toString())) {
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
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, project.lvls || []);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to delete approved content from this project' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams.includes(project.team.toString())) {
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

export default router;

