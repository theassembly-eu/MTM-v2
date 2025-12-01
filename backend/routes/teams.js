import express from 'express';
import Team from '../models/Team.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requireRoleOrHigher, requireTeamOwnership } from '../middleware/roles.js';

const router = express.Router();

// GET /api/teams - Get teams (filtered by role)
router.get('/', authenticate, async (req, res) => {
  try {
    let teams;
    
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN sees all teams
      teams = await Team.find().populate('lvls', 'name code').populate('members', 'email name role');
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN sees teams that have at least one of their assigned LVLs
      teams = await Team.find({ lvls: { $in: req.user.lvls } })
        .populate('lvls', 'name code')
        .populate('members', 'email name role');
    } else {
      // Other users only see teams they belong to
      teams = await Team.find({ members: req.user.id })
        .populate('lvls', 'name code')
        .populate('members', 'email name role');
    }

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams', code: 'FETCH_ERROR' });
  }
});

// GET /api/teams/:id - Get single team
router.get('/:id', authenticate, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('lvls', 'name code')
      .populate('members', 'email name role');

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check permissions
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can see any team
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can see teams that have at least one of their assigned LVLs
      const teamLvlIds = team.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to view this team' });
      }
    } else {
      // Other users only see teams they belong to
      if (!req.user.teams.includes(req.params.id)) {
        return res.status(403).json({ error: 'Not authorized to view this team' });
      }
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team', code: 'FETCH_ERROR' });
  }
});

// POST /api/teams - Create team (SUPER_ADMIN/ADMIN)
router.post('/', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    const { name, lvls, members } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (!lvls || !Array.isArray(lvls) || lvls.length === 0) {
      return res.status(400).json({ error: 'At least one LVL is required' });
    }

    // ADMIN can only assign LVLs they have permission for
    if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const requestedLvlIds = lvls.map(id => id.toString());
      const allAllowed = requestedLvlIds.every(lvlId => adminLvlIds.includes(lvlId));
      if (!allAllowed) {
        return res.status(403).json({ error: 'ADMIN can only assign LVLs they have permission for' });
      }
    }

    const team = await Team.create({
      name,
      lvls,
      members: members || [],
    });

    // If members provided, update their teams array
    // Note: ADMIN is NOT automatically added as a team member (LVL-based, not team-based)
    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members } },
        { $addToSet: { teams: team._id } }
      );
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('lvls', 'name code')
      .populate('members', 'email name role');

    res.status(201).json(populatedTeam);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Team with this name already exists' });
    }
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team', code: 'CREATE_ERROR' });
  }
});

// PUT /api/teams/:id - Update team (SUPER_ADMIN/ADMIN with ownership)
router.put('/:id', authenticate, requireTeamOwnership((req) => req.params.id), async (req, res) => {
  try {
    const { name, lvls, members } = req.body;

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // ADMIN can only change LVLs to ones they have permission for
    if (lvls && req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const requestedLvlIds = lvls.map(id => id.toString());
      const allAllowed = requestedLvlIds.every(lvlId => adminLvlIds.includes(lvlId));
      if (!allAllowed) {
        return res.status(403).json({ error: 'ADMIN can only assign LVLs they have permission for' });
      }
    }

    // Check if team has projects before allowing LVL changes
    if (lvls && JSON.stringify(lvls.sort()) !== JSON.stringify(team.lvls.map(id => id.toString()).sort())) {
      const projectCount = await Project.countDocuments({ team: req.params.id });
      if (projectCount > 0) {
        return res.status(400).json({ 
          error: 'Cannot change LVLs when team has projects', 
          projectCount 
        });
      }
    }

    // Update team
    if (name) team.name = name;
    if (lvls) team.lvls = lvls;
    if (members) {
      // Remove old members from teams array
      const oldMembers = team.members.map(id => id.toString());
      const newMembers = members.map(id => id.toString());
      const toRemove = oldMembers.filter(id => !newMembers.includes(id));
      const toAdd = newMembers.filter(id => !oldMembers.includes(id));

      await User.updateMany(
        { _id: { $in: toRemove } },
        { $pull: { teams: req.params.id } }
      );
      await User.updateMany(
        { _id: { $in: toAdd } },
        { $addToSet: { teams: req.params.id } }
      );

      team.members = members;
    }

    await team.save();

    const populatedTeam = await Team.findById(team._id)
      .populate('lvls', 'name code')
      .populate('members', 'email name role');

    res.json(populatedTeam);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Team with this name already exists' });
    }
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/teams/:id - Delete team (SUPER_ADMIN only)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if team has projects
    const projectCount = await Project.countDocuments({ team: req.params.id });
    if (projectCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete team with existing projects', 
        projectCount 
      });
    }

    // Remove team from all users
    await User.updateMany(
      { teams: req.params.id },
      { $pull: { teams: req.params.id } }
    );

    await Team.findByIdAndDelete(req.params.id);

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team', code: 'DELETE_ERROR' });
  }
});

// POST /api/teams/:id/members - Add member to team
router.post('/:id/members', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check ownership
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can add to any team
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can manage teams that have at least one of their assigned LVLs
      const teamLvlIds = team.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to manage this team' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can manage their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(req.params.id)) {
        return res.status(403).json({ error: 'Not authorized to manage this team' });
      }
    } else {
      return res.status(403).json({ error: 'Not authorized to manage this team' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add to team if not already member
    if (!team.members.includes(userId)) {
      team.members.push(userId);
      await team.save();
    }

    // Add team to user
    if (!user.teams.includes(req.params.id)) {
      user.teams.push(req.params.id);
      await user.save();
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('lvls', 'name code')
      .populate('members', 'email name role');

    res.json(populatedTeam);
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member', code: 'ADD_MEMBER_ERROR' });
  }
});

// DELETE /api/teams/:id/members/:userId - Remove member from team
router.delete('/:id/members/:userId', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check ownership
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can remove from any team
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can manage teams that have at least one of their assigned LVLs
      const teamLvlIds = team.lvls.map(id => id.toString());
      const adminLvlIds = req.user.lvls.map(id => id.toString());
      const hasMatchingLvl = teamLvlIds.some(lvlId => adminLvlIds.includes(lvlId));
      if (!hasMatchingLvl) {
        return res.status(403).json({ error: 'Not authorized to manage this team' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can manage their teams (if no LVLs assigned yet)
      if (!req.user.teams.includes(req.params.id)) {
        return res.status(403).json({ error: 'Not authorized to manage this team' });
      }
    } else {
      return res.status(403).json({ error: 'Not authorized to manage this team' });
    }

    // Remove from team
    team.members = team.members.filter(id => id.toString() !== req.params.userId);
    await team.save();

    // Remove team from user
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { teams: req.params.id }
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('lvls', 'name code')
      .populate('members', 'email name role');

    res.json(populatedTeam);
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member', code: 'REMOVE_MEMBER_ERROR' });
  }
});

export default router;

