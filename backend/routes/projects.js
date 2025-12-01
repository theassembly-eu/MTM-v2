import express from 'express';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import Reference from '../models/Reference.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoleOrHigher, requireTeamMembership, adminHasAccessToProject } from '../middleware/roles.js';

const router = express.Router();

// GET /api/projects?teamId=... - Get projects (filtered by permissions)
router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = {};

    if (teamId) {
      query.team = teamId;
      
      // Check if user has access to this team
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN can see all projects
      } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
        // ADMIN can see projects using their assigned LVLs
        query.lvls = { $in: req.user.lvls };
      } else if (req.user.role === 'ADMIN') {
        // Fallback: ADMIN sees projects from their teams (if no LVLs assigned yet)
        if (!req.user.teams.includes(teamId)) {
          return res.status(403).json({ error: 'Not authorized to view projects for this team' });
        }
      } else if (req.user.role === 'TEAM_LEADER' || req.user.role === 'TEAM_MEMBER') {
        // TEAM_LEADER and TEAM_MEMBER can only see projects from their teams
        if (!req.user.teams || !req.user.teams.includes(teamId)) {
          return res.status(403).json({ error: 'Not authorized to view projects for this team' });
        }
      } else {
        // Unknown role
        return res.status(403).json({ error: 'Not authorized to view projects for this team' });
      }
    } else {
      // If no teamId, filter by permissions
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN sees all projects
      } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
        // ADMIN sees projects using their assigned LVLs
        query.lvls = { $in: req.user.lvls };
      } else if (req.user.role === 'TEAM_LEADER' || req.user.role === 'TEAM_MEMBER') {
        // TEAM_LEADER and TEAM_MEMBER only see projects from their teams
        if (!req.user.teams || req.user.teams.length === 0) {
          query.team = { $in: [] }; // Empty array = no results
        } else {
          query.team = { $in: req.user.teams };
        }
      } else if (req.user.role === 'ADMIN') {
        // Fallback: ADMIN sees projects from their teams (if no LVLs assigned yet)
        query.team = { $in: req.user.teams || [] };
      } else {
        // Unknown role - return empty
        query.team = { $in: [] };
      }
    }

    const projects = await Project.find(query)
      .populate('team', 'name')
      .populate('lvls', 'name code')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects', code: 'FETCH_ERROR' });
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('team', 'name members')
      .populate('lvls', 'name code');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can see any project
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can see projects using their assigned LVLs
      if (!adminHasAccessToProject(req.user, project)) {
        return res.status(403).json({ error: 'Not authorized to view this project' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN sees projects from their teams (if no LVLs assigned yet)
      const teamId = project.team._id.toString();
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to view this project' });
      }
    } else {
      const teamId = project.team._id.toString();
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to view this project' });
      }
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project', code: 'FETCH_ERROR' });
  }
});

// POST /api/projects - Create project
router.post('/', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { name, team, lvls, description } = req.body;

    if (!name || !team || !lvls || !Array.isArray(lvls) || lvls.length === 0) {
      return res.status(400).json({ error: 'Name, team, and at least one LVL are required' });
    }

    // Check team exists and user has access
    const teamDoc = await Team.findById(team);
    if (!teamDoc) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can create projects for any team
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can create projects for teams that have their LVLs, but can only use their assigned LVLs
      const teamLvlIds = teamDoc.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to create projects for this team' });
      }
      // ADMIN can only use LVLs they have permission for
      const projectLvlIds = lvls.map(id => id.toString());
      const allAllowed = projectLvlIds.every(lvlId => adminLvlIds.includes(lvlId));
      if (!allAllowed) {
        return res.status(403).json({ error: 'ADMIN can only use LVLs they have permission for' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can create projects for their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(team)) {
        return res.status(403).json({ error: 'Not authorized to create projects for this team' });
      }
    } else {
      if (!req.user.teams.includes(team)) {
        return res.status(403).json({ error: 'Not authorized to create projects for this team' });
      }
    }

    // Validate LVLs are subset of team's LVLs
    const teamLvlIds = teamDoc.lvls.map(id => id.toString());
    const projectLvlIds = lvls.map(id => id.toString());
    const isValidSubset = projectLvlIds.every(lvlId => teamLvlIds.includes(lvlId));

    if (!isValidSubset) {
      return res.status(400).json({ 
        error: 'Project LVLs must be a subset of team LVLs',
        teamLvls: teamLvlIds,
        projectLvls: projectLvlIds,
      });
    }

    const project = await Project.create({
      name,
      team,
      lvls,
      description: description || '',
    });

    const populatedProject = await Project.findById(project._id)
      .populate('team', 'name')
      .populate('lvls', 'name code');

    res.status(201).json(populatedProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project', code: 'CREATE_ERROR' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const { name, lvls, description } = req.body;

    const project = await Project.findById(req.params.id).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const teamId = project.team._id.toString();
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can update any project
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can update projects using their assigned LVLs
      if (!adminHasAccessToProject(req.user, project)) {
        return res.status(403).json({ error: 'Not authorized to update this project' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can update projects from their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to update this project' });
      }
    } else {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to update this project' });
      }
    }

    // If LVLs are being updated, validate subset and ADMIN permissions
    if (lvls && Array.isArray(lvls)) {
      const team = await Team.findById(teamId);
      const teamLvlIds = team.lvls.map(id => id.toString());
      const projectLvlIds = lvls.map(id => id.toString());
      
      // ADMIN can only use LVLs they have permission for
      if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
        const adminLvlIds = req.user.lvls.map(id => id.toString());
        const allAllowed = projectLvlIds.every(lvlId => adminLvlIds.includes(lvlId));
        if (!allAllowed) {
          return res.status(403).json({ error: 'ADMIN can only use LVLs they have permission for' });
        }
      }
      
      const isValidSubset = projectLvlIds.every(lvlId => teamLvlIds.includes(lvlId));

      if (!isValidSubset) {
        return res.status(400).json({ 
          error: 'Project LVLs must be a subset of team LVLs',
          teamLvls: teamLvlIds,
          projectLvls: projectLvlIds,
        });
      }
      project.lvls = lvls;
    }

    if (name) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate('team', 'name')
      .populate('lvls', 'name code');

    res.json(populatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticate, requireRoleOrHigher('TEAM_LEADER'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const teamId = project.team._id.toString();
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can delete any project
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can delete projects using their assigned LVLs
      if (!adminHasAccessToProject(req.user, project)) {
        return res.status(403).json({ error: 'Not authorized to delete this project' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can delete projects from their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to delete this project' });
      }
    } else {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not authorized to delete this project' });
      }
    }

    // Check if project has references
    const referenceCount = await Reference.countDocuments({ project: req.params.id });
    if (referenceCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete project with existing references', 
        referenceCount 
      });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project', code: 'DELETE_ERROR' });
  }
});

export default router;

