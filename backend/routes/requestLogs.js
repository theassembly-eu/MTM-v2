import express from 'express';
import RequestLog from '../models/RequestLog.js';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import ApprovedContent from '../models/ApprovedContent.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoleOrHigher, checkLvlAccessForProject } from '../middleware/roles.js';

const router = express.Router();

// GET /api/request-logs - Get request logs (filtered by role)
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, teamId, userId, approvalStatus, page = 1, limit = 20 } = req.query;
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
    // ADMIN sees logs for projects using their assigned LVLs
    else if (req.user.role === 'ADMIN') {
      if (req.user.lvls && req.user.lvls.length > 0) {
        // Find projects that use the ADMIN's LVLs
        const projects = await Project.find({ lvls: { $in: req.user.lvls } }).select('_id');
        const projectIds = projects.map(p => p._id);
        query.project = { $in: projectIds };
        if (projectId) {
          // Verify the project is in the accessible list
          if (projectIds.includes(projectId)) {
            query.project = projectId;
          } else {
            return res.json({ data: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } });
          }
        }
        if (userId) query.user = userId;
      } else {
        // Fallback: no LVLs assigned, return empty
        return res.json({ data: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } });
      }
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

    // Filter by approval status if provided
    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
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
      .populate('approvalMeta.taggedAsCandidate.by', 'email name')
      .populate('approvalMeta.verified.by', 'email name')
      .populate('approvalMeta.approved.by', 'email name')
      .populate('approvalMeta.rejected.by', 'email name')
      .populate('comments.user', 'email name')
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
      .populate('project', 'name lvls')
      .populate('project.lvls', 'name code')
      .populate('lvl', 'name code')
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('language', 'name code')
      .populate('referenceIds', 'title type url summary keywords geoContext')
      .populate('approvalMeta.taggedAsCandidate.by', 'email name')
      .populate('approvalMeta.verified.by', 'email name')
      .populate('approvalMeta.approved.by', 'email name')
      .populate('approvalMeta.rejected.by', 'email name')
      .populate('comments.user', 'email name');

    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can see any log
    } else if (req.user.role === 'ADMIN') {
      // ADMIN can see logs for projects using their LVLs
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, log.project.lvls || []);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view this log' });
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

// PUT /api/request-logs/:id/tag-candidate - Tag as candidate
router.put('/:id/tag-candidate', authenticate, async (req, res) => {
  try {
    const log = await RequestLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    // Check permissions - any authenticated user can tag
    if (log.approvalStatus === 'DRAFT') {
      log.approvalStatus = 'CANDIDATE';
      log.approvalMeta.taggedAsCandidate = {
        by: req.user.id,
        at: new Date(),
      };
      await log.save();
    }

    const updatedLog = await RequestLog.findById(req.params.id)
      .populate('approvalMeta.taggedAsCandidate.by', 'email name');

    res.json(updatedLog);
  } catch (error) {
    console.error('Error tagging as candidate:', error);
    res.status(500).json({ error: 'Failed to tag as candidate', code: 'TAG_ERROR' });
  }
});

// PUT /api/request-logs/:id/verify - Verify text (TEAM_LEADER or ADMIN)
router.put('/:id/verify', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { notes } = req.body;
    const log = await RequestLog.findById(req.params.id)
      .populate('project', 'lvls team');

    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    // Check permissions
    if (req.user.role === 'ADMIN') {
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, log.project.lvls);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to verify this log' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams.includes(log.project.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to verify this log' });
      }
    }

    // Can only verify if status is CANDIDATE
    if (log.approvalStatus !== 'CANDIDATE') {
      return res.status(400).json({ 
        error: `Cannot verify. Current status: ${log.approvalStatus}. Expected: CANDIDATE` 
      });
    }

    log.approvalStatus = 'VERIFIED';
    log.approvalMeta.verified = {
      by: req.user.id,
      at: new Date(),
      notes: notes || '',
    };
    await log.save();

    const updatedLog = await RequestLog.findById(req.params.id)
      .populate('approvalMeta.verified.by', 'email name');

    res.json(updatedLog);
  } catch (error) {
    console.error('Error verifying log:', error);
    res.status(500).json({ error: 'Failed to verify log', code: 'VERIFY_ERROR' });
  }
});

// PUT /api/request-logs/:id/approve - Approve text (TEAM_LEADER or ADMIN)
router.put('/:id/approve', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { notes } = req.body;
    const log = await RequestLog.findById(req.params.id)
      .populate('project', 'lvls team')
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('lvl', 'name code');

    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    // Check permissions
    if (req.user.role === 'ADMIN') {
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, log.project.lvls);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to approve this log' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams.includes(log.project.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to approve this log' });
      }
    }

    // Can only approve if status is VERIFIED
    if (log.approvalStatus !== 'VERIFIED') {
      return res.status(400).json({ 
        error: `Cannot approve. Current status: ${log.approvalStatus}. Expected: VERIFIED` 
      });
    }

    log.approvalStatus = 'APPROVED';
    log.approvalMeta.approved = {
      by: req.user.id,
      at: new Date(),
      notes: notes || '',
    };
    await log.save();

    // Create ApprovedContent entry
    const approvedContent = await ApprovedContent.create({
      project: log.project._id,
      requestLog: log._id,
      originalText: log.originalText,
      simplifiedText: log.simplifiedText,
      targetAudience: log.targetAudience?._id,
      outputFormat: log.outputFormat?._id,
      lvl: log.lvl._id,
      approvedBy: req.user.id,
      metadata: {
        originalRequestDate: log.createdAt,
        originalUser: log.user,
        verificationNotes: log.approvalMeta.verified?.notes,
        approvalNotes: notes || '',
      },
    });

    const updatedLog = await RequestLog.findById(req.params.id)
      .populate('approvalMeta.approved.by', 'email name');

    res.json({ log: updatedLog, approvedContent });
  } catch (error) {
    console.error('Error approving log:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This log has already been approved' });
    }
    res.status(500).json({ error: 'Failed to approve log', code: 'APPROVE_ERROR' });
  }
});

// PUT /api/request-logs/:id/reject - Reject text (TEAM_LEADER or ADMIN)
router.put('/:id/reject', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const log = await RequestLog.findById(req.params.id)
      .populate('project', 'lvls team');

    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    // Check permissions
    if (req.user.role === 'ADMIN') {
      const hasAccess = await checkLvlAccessForProject(req.user.lvls, log.project.lvls);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to reject this log' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams.includes(log.project.team.toString())) {
        return res.status(403).json({ error: 'Not authorized to reject this log' });
      }
    }

    // Cannot reject if already approved
    if (log.approvalStatus === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot reject an approved log' });
    }

    log.approvalStatus = 'REJECTED';
    log.approvalMeta.rejected = {
      by: req.user.id,
      at: new Date(),
      reason: reason.trim(),
    };
    await log.save();

    const updatedLog = await RequestLog.findById(req.params.id)
      .populate('approvalMeta.rejected.by', 'email name');

    res.json(updatedLog);
  } catch (error) {
    console.error('Error rejecting log:', error);
    res.status(500).json({ error: 'Failed to reject log', code: 'REJECT_ERROR' });
  }
});

// POST /api/request-logs/:id/comments - Add comment
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { text, parentCommentId } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const log = await RequestLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    const comment = {
      user: req.user.id,
      text: text.trim(),
      parentComment: parentCommentId || null,
      createdAt: new Date(),
    };

    log.comments.push(comment);
    await log.save();

    const updatedLog = await RequestLog.findById(req.params.id)
      .populate('comments.user', 'email name');

    const newComment = updatedLog.comments[updatedLog.comments.length - 1];
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment', code: 'COMMENT_ERROR' });
  }
});

// PUT /api/request-logs/:id/comments/:commentId - Edit comment
router.put('/:id/comments/:commentId', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const log = await RequestLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    const comment = log.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only the comment author can edit
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    comment.text = text.trim();
    comment.edited = true;
    comment.editedAt = new Date();
    await log.save();

    const updatedLog = await RequestLog.findById(req.params.id)
      .populate('comments.user', 'email name');

    res.json(updatedLog.comments.id(req.params.commentId));
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ error: 'Failed to edit comment', code: 'COMMENT_EDIT_ERROR' });
  }
});

// DELETE /api/request-logs/:id/comments/:commentId - Delete comment
router.delete('/:id/comments/:commentId', authenticate, async (req, res) => {
  try {
    const log = await RequestLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Request log not found' });
    }

    const comment = log.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only the comment author can delete
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    log.comments.pull(req.params.commentId);
    await log.save();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment', code: 'COMMENT_DELETE_ERROR' });
  }
});

// GET /api/request-logs/approval-queue - Get texts pending approval (TEAM_LEADER or ADMIN)
router.get('/approval-queue', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {
      approvalStatus: { $in: ['CANDIDATE', 'VERIFIED'] }, // Pending verification or approval
    };

    // SUPER_ADMIN sees all
    if (req.user.role === 'SUPER_ADMIN') {
      // No additional filters
    }
    // ADMIN sees queue for their LVLs
    else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      const projects = await Project.find({ lvls: { $in: req.user.lvls } }).select('_id');
      const projectIds = projects.map(p => p._id);
      if (projectIds.length === 0) {
        // No projects match, return empty result
        return res.json({
          data: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        });
      }
      query.project = { $in: projectIds };
    }
    // TEAM_LEADER sees queue for their teams
    else if (req.user.role === 'TEAM_LEADER') {
      if (!req.user.teams || req.user.teams.length === 0) {
        // No teams, return empty result
        return res.json({
          data: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        });
      }
      query.team = { $in: req.user.teams };
    }

    const logs = await RequestLog.find(query)
      .populate('user', 'email name')
      .populate('team', 'name')
      .populate('project', 'name lvls')
      .populate('lvl', 'name code')
      .populate('targetAudience', 'name')
      .populate('outputFormat', 'name')
      .populate('comments.user', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Manually populate nested approvalMeta user references
    const User = (await import('../models/User.js')).default;
    for (const log of logs) {
      if (log.approvalMeta?.taggedAsCandidate?.by) {
        try {
          const user = await User.findById(log.approvalMeta.taggedAsCandidate.by).select('email name');
          if (user) {
            log.approvalMeta.taggedAsCandidate.by = user;
          }
        } catch (err) {
          console.error('Error populating taggedAsCandidate.by:', err);
        }
      }
      if (log.approvalMeta?.verified?.by) {
        try {
          const user = await User.findById(log.approvalMeta.verified.by).select('email name');
          if (user) {
            log.approvalMeta.verified.by = user;
          }
        } catch (err) {
          console.error('Error populating verified.by:', err);
        }
      }
      if (log.approvalMeta?.approved?.by) {
        try {
          const user = await User.findById(log.approvalMeta.approved.by).select('email name');
          if (user) {
            log.approvalMeta.approved.by = user;
          }
        } catch (err) {
          console.error('Error populating approved.by:', err);
        }
      }
    }

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
    console.error('Error fetching approval queue:', error);
    res.status(500).json({ error: 'Failed to fetch approval queue', code: 'QUEUE_ERROR', details: error.message });
  }
});

// POST /api/request-logs/bulk-verify - Bulk verify texts (TEAM_LEADER or ADMIN)
router.post('/bulk-verify', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { logIds, notes } = req.body;
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ error: 'logIds array is required' });
    }

    const results = [];
    const errors = [];

    for (const logId of logIds) {
      try {
        const log = await RequestLog.findById(logId).populate('project', 'lvls team');
        
        if (!log) {
          errors.push({ logId, error: 'Request log not found' });
          continue;
        }

        // Check permissions
        if (req.user.role === 'ADMIN') {
          const hasAccess = await checkLvlAccessForProject(req.user.lvls, log.project.lvls || []);
          if (!hasAccess) {
            errors.push({ logId, error: 'Not authorized to verify this log' });
            continue;
          }
        } else if (req.user.role === 'TEAM_LEADER') {
          const projectTeamId = log.project.team?._id || log.project.team;
          if (!req.user.teams.includes(projectTeamId.toString())) {
            errors.push({ logId, error: 'Not authorized to verify this log' });
            continue;
          }
        }

        // Can only verify if status is CANDIDATE
        if (log.approvalStatus !== 'CANDIDATE') {
          errors.push({ logId, error: `Cannot verify. Current status: ${log.approvalStatus}` });
          continue;
        }

        log.approvalStatus = 'VERIFIED';
        log.approvalMeta.verified = {
          by: req.user.id,
          at: new Date(),
          notes: notes || '',
        };
        await log.save();

        results.push({ logId, status: 'verified' });
      } catch (err) {
        console.error(`Error verifying log ${logId}:`, err);
        errors.push({ logId, error: err.message });
      }
    }

    res.json({
      success: true,
      verified: results.length,
      errors: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error bulk verifying:', error);
    res.status(500).json({ error: 'Failed to bulk verify', code: 'BULK_VERIFY_ERROR' });
  }
});

// POST /api/request-logs/bulk-approve - Bulk approve texts (TEAM_LEADER or ADMIN)
router.post('/bulk-approve', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { logIds, notes } = req.body;
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ error: 'logIds array is required' });
    }

    const results = [];
    const errors = [];
    const ApprovedContent = (await import('../models/ApprovedContent.js')).default;

    for (const logId of logIds) {
      try {
        const log = await RequestLog.findById(logId)
          .populate('project', 'lvls team')
          .populate('targetAudience', 'name')
          .populate('outputFormat', 'name')
          .populate('lvl', 'name code');
        
        if (!log) {
          errors.push({ logId, error: 'Request log not found' });
          continue;
        }

        // Check permissions
        if (req.user.role === 'ADMIN') {
          const hasAccess = await checkLvlAccessForProject(req.user.lvls, log.project.lvls || []);
          if (!hasAccess) {
            errors.push({ logId, error: 'Not authorized to approve this log' });
            continue;
          }
        } else if (req.user.role === 'TEAM_LEADER') {
          const projectTeamId = log.project.team?._id || log.project.team;
          if (!req.user.teams.includes(projectTeamId.toString())) {
            errors.push({ logId, error: 'Not authorized to approve this log' });
            continue;
          }
        }

        // Can only approve if status is VERIFIED
        if (log.approvalStatus !== 'VERIFIED') {
          errors.push({ logId, error: `Cannot approve. Current status: ${log.approvalStatus}` });
          continue;
        }

        log.approvalStatus = 'APPROVED';
        log.approvalMeta.approved = {
          by: req.user.id,
          at: new Date(),
          notes: notes || '',
        };
        await log.save();

        // Create ApprovedContent entry
        try {
          await ApprovedContent.create({
            project: log.project._id,
            requestLog: log._id,
            originalText: log.originalText,
            simplifiedText: log.simplifiedText,
            targetAudience: log.targetAudience?._id,
            outputFormat: log.outputFormat?._id,
            lvl: log.lvl._id,
            approvedBy: req.user.id,
            metadata: {
              originalRequestDate: log.createdAt,
              originalUser: log.user,
              verificationNotes: log.approvalMeta.verified?.notes,
              approvalNotes: notes || '',
            },
          });
        } catch (contentErr) {
          if (contentErr.code !== 11000) { // Ignore duplicate key errors
            throw contentErr;
          }
        }

        results.push({ logId, status: 'approved' });
      } catch (err) {
        console.error(`Error approving log ${logId}:`, err);
        errors.push({ logId, error: err.message });
      }
    }

    res.json({
      success: true,
      approved: results.length,
      errors: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error bulk approving:', error);
    res.status(500).json({ error: 'Failed to bulk approve', code: 'BULK_APPROVE_ERROR' });
  }
});

export default router;

