import express from 'express';
import RequestLog from '../models/RequestLog.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import LVL from '../models/LVL.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = express.Router();

// GET /api/analytics - Get analytics data (SUPER_ADMIN only)
router.get('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get total requests
    const totalRequests = await RequestLog.countDocuments(dateFilter);

    // Requests per user
    const requestsPerUser = await RequestLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData',
        },
      },
      {
        $unwind: {
          path: '$userData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          userId: '$_id',
          userName: { $ifNull: ['$userData.name', 'Unknown'] },
          userEmail: { $ifNull: ['$userData.email', 'Unknown'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Requests per team
    const requestsPerTeam = await RequestLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$team',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'teams',
          localField: '_id',
          foreignField: '_id',
          as: 'teamData',
        },
      },
      {
        $unwind: {
          path: '$teamData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          teamId: '$_id',
          teamName: { $ifNull: ['$teamData.name', 'Unknown'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Requests per project
    const requestsPerProject = await RequestLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$project',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'projectData',
        },
      },
      {
        $unwind: {
          path: '$projectData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          projectId: '$_id',
          projectName: { $ifNull: ['$projectData.name', 'Unknown'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // LVL usage
    const lvlUsage = await RequestLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$lvl',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'lvls',
          localField: '_id',
          foreignField: '_id',
          as: 'lvlData',
        },
      },
      {
        $unwind: {
          path: '$lvlData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          lvlId: '$_id',
          lvlName: { $ifNull: ['$lvlData.name', 'Unknown'] },
          lvlCode: { $ifNull: ['$lvlData.code', 'Unknown'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Popular keywords (from includeKeywords)
    const popularKeywords = await RequestLog.aggregate([
      { $match: { ...dateFilter, includeKeywords: { $exists: true, $ne: [] } } },
      { $unwind: '$includeKeywords' },
      {
        $group: {
          _id: '$includeKeywords',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Requests over time (last 30 days by default)
    const daysToShow = 30;
    const requestsOverTime = await RequestLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Total tokens used (if available)
    const tokenStats = await RequestLog.aggregate([
      { $match: { ...dateFilter, 'modelMeta.totalTokens': { $exists: true } } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$modelMeta.totalTokens' },
          avgTokens: { $avg: '$modelMeta.totalTokens' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      summary: {
        totalRequests,
        totalUsers: requestsPerUser.length,
        totalTeams: requestsPerTeam.length,
        totalProjects: requestsPerProject.length,
        totalTokens: tokenStats[0]?.totalTokens || 0,
        avgTokens: tokenStats[0]?.avgTokens || 0,
        tokenRequests: tokenStats[0]?.count || 0,
      },
      requestsPerUser: requestsPerUser.map(item => ({
        userId: item.userId?.toString(),
        userName: item.userName,
        userEmail: item.userEmail,
        count: item.count,
      })),
      requestsPerTeam: requestsPerTeam.map(item => ({
        teamId: item.teamId?.toString(),
        teamName: item.teamName,
        count: item.count,
      })),
      requestsPerProject: requestsPerProject.map(item => ({
        projectId: item.projectId?.toString(),
        projectName: item.projectName,
        count: item.count,
      })),
      lvlUsage: lvlUsage.map(item => ({
        lvlId: item.lvlId?.toString(),
        lvlName: item.lvlName,
        lvlCode: item.lvlCode,
        count: item.count,
      })),
      popularKeywords: popularKeywords.map(item => ({
        keyword: item._id,
        count: item.count,
      })),
      requestsOverTime: requestsOverTime.map(item => ({
        date: item._id,
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', code: 'ANALYTICS_ERROR' });
  }
});

export default router;

