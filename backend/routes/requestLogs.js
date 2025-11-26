import express from 'express';
import RequestLog from '../models/RequestLog.js';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/request-logs - Get request logs (filtered by role)
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, teamId, userId, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    // SUPER_ADMIN sees all logs
    if (req.user.role === 'SUPER_ADMIN') {
      if (projectId) query.project = projectId;
      if (teamId) query.team = teamId;
      if (userId) query.user = userId;
    }
    // ADMIN sees logs for their teams
    else if (req.user.role === 'ADMIN') {
      query.team = { $in: req.user.teams };
      if (projectId) query.project = projectId;
      if (userId) query.user = userId;
    }
    // TEAM_LEADER sees logs for their team's projects
    else if (req.user.role === 'TEAM_LEADER') {
      query.team = { $in: req.user.teams };
      if (projectId) {
        // Verify project belongs to user's team
        const project = await Project.findById(projectId);
        if (project && req.user.teams.includes(project.team.toString())) {
          query.project = projectId;
        }
      }
    }
    // TEAM_MEMBER sees their own logs and project logs they belong to
    else {
      query.$or = [
        { user: req.user.id },
        { project: { $in: await Project.find({ team: { $in: req.user.teams } }).distinct('_id') } },
      ];
      if (projectId) {
        const project = await Project.findById(projectId);
        if (project && req.user.teams.includes(project.team.toString())) {
          query.$or = [{ user: req.user.id }, { project: projectId }];
        } else {
          query.$or = [{ user: req.user.id }];
        }
      }
    }

    const logs = await RequestLog.find(query)
      .populate('user', 'email name')
      .populate('team', 'name')
      .populate('project', 'name')
      .populate('lvl', 'name code')
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('language', 'name code')
      .populate('referenceIds', 'title type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await RequestLog.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching request logs:', error);
    res.status(500).json({ error: 'Failed to fetch request logs', code: 'FETCH_ERROR' });
  }
});

// GET /api/request-logs/:id - Get single request log
router.get('/:id', authenticate, async (req, res) => {
  try {
    const log = await RequestLog.findById(req.params.id)
      .populate('user', 'email name')
      .populate('team', 'name')
      .populate('project', 'name')
      .populate('lvl', 'name code')
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('language', 'name code')
      .populate('referenceIds', 'title type url summary keywords geoContext');

    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      // SUPER_ADMIN and ADMIN can see any log
      if (req.user.role === 'ADMIN') {
        if (!req.user.teams.includes(log.team._id.toString())) {
          return res.status(403).json({ error: 'Not authorized to view this log' });
        }
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams.includes(log.team._id.toString())) {
        return res.status(403).json({ error: 'Not authorized to view this log' });
      }
    } else {
      // TEAM_MEMBER can only see their own logs or logs from projects they belong to
      if (log.user._id.toString() !== req.user.id) {
        const project = await Project.findById(log.project._id);
        if (!project || !req.user.teams.includes(project.team.toString())) {
          return res.status(403).json({ error: 'Not authorized to view this log' });
        }
      }
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching request log:', error);
    res.status(500).json({ error: 'Failed to fetch request log', code: 'FETCH_ERROR' });
  }
});

export default router;

