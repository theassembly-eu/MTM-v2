import express from 'express';
import Reference from '../models/Reference.js';
import Project from '../models/Project.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { authenticate } from '../middleware/auth.js';
import { requireRoleOrHigher } from '../middleware/roles.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to fetch and summarize URL
async function fetchAndSummarizeURL(url) {
  try {
    // Fetch URL content
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MensentaalMachine/2.0)',
      },
    });

    // Parse HTML
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Extract text content
    const text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit to 5000 chars

    if (!text || text.length < 50) {
      return { summary: 'Could not extract meaningful content from URL', error: 'INSUFFICIENT_CONTENT' };
    }

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Summarize the following content in 2-3 sentences in Dutch. Focus on key information that would be useful for text simplification context:\n\n${text}`,
      }],
      max_tokens: 150,
      temperature: 0.7,
    });

    return { summary: completion.choices[0].message.content.trim() };
  } catch (error) {
    console.error('Error fetching/summarizing URL:', error);
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { summary: '', error: 'TIMEOUT' };
    }
    return { summary: '', error: error.message };
  }
}

// GET /api/projects/:projectId/references - Get references for a project
router.get('/projects/:projectId/references', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const teamId = project.team._id.toString();
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can view any references
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can view references for projects using their assigned LVLs
      const projectLvlIds = project.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = projectLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to view references for this project' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can view references for their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to view references for this project' });
      }
    } else {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to view references for this project' });
      }
    }

    const references = await Reference.find({ project: req.params.projectId })
      .sort({ createdAt: -1 });

    res.json(references);
  } catch (error) {
    console.error('Error fetching references:', error);
    res.status(500).json({ error: 'Failed to fetch references', code: 'FETCH_ERROR' });
  }
});

// POST /api/projects/:projectId/references - Create reference
router.post('/projects/:projectId/references', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { type, title, url, keywords, geoContext, summary } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: 'Type and title are required' });
    }

    if (!['URL', 'KEYWORDS'].includes(type)) {
      return res.status(400).json({ error: 'Type must be URL or KEYWORDS (FILE not supported in MVP)' });
    }

    const project = await Project.findById(req.params.projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const teamId = project.team._id.toString();
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can create references for any project
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can create references for projects using their assigned LVLs
      const projectLvlIds = project.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = projectLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to create references for this project' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can create references for their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to create references for this project' });
      }
    } else {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to create references for this project' });
      }
    }

    let referenceData = {
      project: req.params.projectId,
      type,
      title,
      keywords: keywords || [],
      geoContext: geoContext || '',
      summary: summary || '',
    };

    // If URL type, fetch and summarize
    if (type === 'URL') {
      if (!url) {
        return res.status(400).json({ error: 'URL is required for URL type references' });
      }
      referenceData.url = url;

      // Fetch and summarize URL
      const urlResult = await fetchAndSummarizeURL(url);
      if (urlResult.summary) {
        referenceData.summary = urlResult.summary;
      } else if (urlResult.error) {
        // Still create reference but with error note
        referenceData.summary = `Error fetching URL: ${urlResult.error}. Please add summary manually.`;
      }
    }

    const reference = await Reference.create(referenceData);
    res.status(201).json(reference);
  } catch (error) {
    console.error('Error creating reference:', error);
    res.status(500).json({ error: 'Failed to create reference', code: 'CREATE_ERROR' });
  }
});

// PUT /api/references/:id - Update reference
router.put('/:id', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { title, url, keywords, geoContext, summary } = req.body;

    const reference = await Reference.findById(req.params.id).populate('project');
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    const project = await Project.findById(reference.project._id).populate('team');
    const teamId = project.team._id.toString();

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can update any reference
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can update references for projects using their assigned LVLs
      const projectLvlIds = project.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = projectLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to update this reference' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can update references for their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to update this reference' });
      }
    } else {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to update this reference' });
      }
    }

    if (title) reference.title = title;
    if (url) reference.url = url;
    if (keywords) reference.keywords = keywords;
    if (geoContext !== undefined) reference.geoContext = geoContext;
    if (summary !== undefined) reference.summary = summary;

    await reference.save();
    res.json(reference);
  } catch (error) {
    console.error('Error updating reference:', error);
    res.status(500).json({ error: 'Failed to update reference', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/references/:id - Delete reference
router.delete('/:id', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const reference = await Reference.findById(req.params.id).populate('project');
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    const project = await Project.findById(reference.project._id).populate('team');
    const teamId = project.team._id.toString();

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can delete any reference
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can delete references for projects using their assigned LVLs
      const projectLvlIds = project.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = projectLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to delete this reference' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can delete references for their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to delete this reference' });
      }
    } else {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to delete this reference' });
      }
    }

    await Reference.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reference deleted successfully' });
  } catch (error) {
    console.error('Error deleting reference:', error);
    res.status(500).json({ error: 'Failed to delete reference', code: 'DELETE_ERROR' });
  }
});

export default router;

