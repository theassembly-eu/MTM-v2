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

    // PROMPT ANALYTICS: Output Format Usage
    const outputFormatUsage = await RequestLog.aggregate([
      { $match: { ...dateFilter, outputFormat: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$outputFormat',
          count: { $sum: 1 },
          avgTokens: { $avg: '$modelMeta.totalTokens' },
        },
      },
      {
        $lookup: {
          from: 'outputformats',
          localField: '_id',
          foreignField: '_id',
          as: 'formatData',
        },
      },
      {
        $unwind: {
          path: '$formatData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          formatId: '$_id',
          formatName: { $ifNull: ['$formatData.name', 'Unknown'] },
          count: 1,
          avgTokens: { $ifNull: ['$avgTokens', 0] },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // PROMPT ANALYTICS: Research Mode Usage
    const researchModeStats = await RequestLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $ifNull: ['$researchMode', false] },
          count: { $sum: 1 },
          avgTokens: { $avg: '$modelMeta.totalTokens' },
        },
      },
    ]);

    // PROMPT ANALYTICS: Target Audience Distribution
    const targetAudienceUsage = await RequestLog.aggregate([
      { $match: { ...dateFilter, targetAudience: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$targetAudience',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'targetaudiences',
          localField: '_id',
          foreignField: '_id',
          as: 'audienceData',
        },
      },
      {
        $unwind: {
          path: '$audienceData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          audienceId: '$_id',
          audienceName: { $ifNull: ['$audienceData.name', 'Unknown'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // PROMPT ANALYTICS: Reference Usage
    const referenceUsage = await RequestLog.aggregate([
      { $match: { ...dateFilter, referenceIds: { $exists: true, $ne: [] } } },
      { $unwind: '$referenceIds' },
      {
        $group: {
          _id: '$referenceIds',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'references',
          localField: '_id',
          foreignField: '_id',
          as: 'referenceData',
        },
      },
      {
        $unwind: {
          path: '$referenceData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          referenceId: '$_id',
          referenceTitle: { $ifNull: ['$referenceData.title', 'Unknown'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // PROMPT ANALYTICS: Token Usage by Output Format
    const tokenUsageByFormat = await RequestLog.aggregate([
      { $match: { ...dateFilter, outputFormat: { $exists: true, $ne: null }, 'modelMeta.totalTokens': { $exists: true } } },
      {
        $group: {
          _id: '$outputFormat',
          totalTokens: { $sum: '$modelMeta.totalTokens' },
          avgTokens: { $avg: '$modelMeta.totalTokens' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'outputformats',
          localField: '_id',
          foreignField: '_id',
          as: 'formatData',
        },
      },
      {
        $unwind: {
          path: '$formatData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          formatId: '$_id',
          formatName: { $ifNull: ['$formatData.name', 'Unknown'] },
          totalTokens: 1,
          avgTokens: { $ifNull: ['$avgTokens', 0] },
          count: 1,
        },
      },
      { $sort: { totalTokens: -1 } },
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
      // PROMPT ANALYTICS
      promptAnalytics: {
        outputFormatUsage: outputFormatUsage.map(item => ({
          formatId: item.formatId?.toString(),
          formatName: item.formatName,
          count: item.count,
          avgTokens: Math.round(item.avgTokens || 0),
        })),
        researchModeStats: {
          enabled: researchModeStats.find(s => s._id === true)?.count || 0,
          disabled: researchModeStats.find(s => s._id === false)?.count || 0,
          enabledAvgTokens: Math.round(researchModeStats.find(s => s._id === true)?.avgTokens || 0),
          disabledAvgTokens: Math.round(researchModeStats.find(s => s._id === false)?.avgTokens || 0),
        },
        targetAudienceUsage: targetAudienceUsage.map(item => ({
          audienceId: item.audienceId?.toString(),
          audienceName: item.audienceName,
          count: item.count,
        })),
        referenceUsage: referenceUsage.map(item => ({
          referenceId: item.referenceId?.toString(),
          referenceTitle: item.referenceTitle,
          count: item.count,
        })),
        tokenUsageByFormat: tokenUsageByFormat.map(item => ({
          formatId: item.formatId?.toString(),
          formatName: item.formatName,
          totalTokens: item.totalTokens,
          avgTokens: Math.round(item.avgTokens || 0),
          count: item.count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', code: 'ANALYTICS_ERROR' });
  }
});

export default router;

