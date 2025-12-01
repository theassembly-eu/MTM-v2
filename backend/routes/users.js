import express from 'express';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requireRoleOrHigher } from '../middleware/roles.js';
import { hashPassword, validatePassword } from '../utils/password.js';

const router = express.Router();

// GET /api/users - Get users (filtered by role)
router.get('/', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    let users;

    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN sees all users
      users = await User.find().select('-passwordHash').populate('teams', 'name').populate('lvls', 'name code');
    } else if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN sees users who work on teams/projects using their assigned LVLs
      // Find teams that have at least one of the ADMIN's LVLs
      const teams = await Team.find({ lvls: { $in: req.user.lvls } }).select('_id');
      const teamIds = teams.map(t => t._id);
      
      // Find users who belong to these teams
      users = await User.find({ teams: { $in: teamIds } })
        .select('-passwordHash')
        .populate('teams', 'name')
        .populate('lvls', 'name code');
    } else {
      // Fallback: ADMIN sees users from their teams (if no LVLs assigned yet)
      users = await User.find({ teams: { $in: req.user.teams } })
        .select('-passwordHash')
        .populate('teams', 'name')
        .populate('lvls', 'name code');
    }

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', code: 'FETCH_ERROR' });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').populate('teams', 'name').populate('lvls', 'name code');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions (ADMIN can see users who work on teams/projects using their LVLs)
    if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      const userTeamIds = user.teams.map(team => team._id.toString());
      // Find teams that have at least one of the ADMIN's LVLs
      const teams = await Team.find({ 
        _id: { $in: userTeamIds },
        lvls: { $in: req.user.lvls }
      }).select('_id');
      
      if (teams.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view this user' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN sees users from their teams (if no LVLs assigned yet)
      const userTeamIds = user.teams.map(team => team._id.toString());
      const hasCommonTeam = req.user.teams.some(teamId => userTeamIds.includes(teamId));
      if (!hasCommonTeam) {
        return res.status(403).json({ error: 'Not authorized to view this user' });
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user', code: 'FETCH_ERROR' });
  }
});

// POST /api/users - Create user (SUPER_ADMIN/ADMIN)
router.post('/', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    const { email, name, password, role, teams, lvls } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER'];
    const userRole = role || 'TEAM_MEMBER';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // ADMIN cannot create SUPER_ADMIN
    if (req.user.role === 'ADMIN' && userRole === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'ADMIN cannot create SUPER_ADMIN users' });
    }

    // Only SUPER_ADMIN can assign LVLs to ADMIN users
    if (lvls && lvls.length > 0) {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only SUPER_ADMIN can assign LVLs to users' });
      }
      if (userRole !== 'ADMIN') {
        return res.status(400).json({ error: 'LVLs can only be assigned to ADMIN users' });
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    console.log('Creating user:', { email: email.toLowerCase(), role: userRole, hasPassword: !!passwordHash });

    const userData = {
      email: email.toLowerCase(),
      name: name || '',
      passwordHash,
      role: userRole,
      teams: teams || [],
    };

    // Only add lvls if provided and user is ADMIN
    if (lvls && lvls.length > 0 && userRole === 'ADMIN') {
      userData.lvls = lvls;
    }

    const user = await User.create(userData);
    console.log('User created successfully:', user._id.toString());

    const userResponse = await User.findById(user._id).select('-passwordHash').populate('teams', 'name').populate('lvls', 'name code');
    res.status(201).json(userResponse);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', code: 'CREATE_ERROR' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, requireRoleOrHigher('ADMIN'), async (req, res) => {
  try {
    const { name, password, role, teams, lvls } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions
    if (req.user.role === 'ADMIN' && req.user.lvls && req.user.lvls.length > 0) {
      // ADMIN can update users who work on teams/projects using their LVLs
      const userTeamIds = user.teams.map(id => id.toString());
      const teams = await Team.find({ 
        _id: { $in: userTeamIds },
        lvls: { $in: req.user.lvls }
      }).select('_id');
      
      if (teams.length === 0) {
        return res.status(403).json({ error: 'Not authorized to update this user' });
      }
      // ADMIN cannot change role to SUPER_ADMIN
      if (role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'ADMIN cannot set role to SUPER_ADMIN' });
      }
    } else if (req.user.role === 'ADMIN') {
      // Fallback: ADMIN can update users from their teams (if no LVLs assigned yet)
      const userTeamIds = user.teams.map(id => id.toString());
      const hasCommonTeam = req.user.teams.some(teamId => userTeamIds.includes(teamId));
      if (!hasCommonTeam) {
        return res.status(403).json({ error: 'Not authorized to update this user' });
      }
      // ADMIN cannot change role to SUPER_ADMIN
      if (role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'ADMIN cannot set role to SUPER_ADMIN' });
      }
    }

    // Only SUPER_ADMIN can update SUPER_ADMIN users
    if (user.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can update SUPER_ADMIN users' });
    }

    // Only SUPER_ADMIN can assign LVLs to ADMIN users
    if (lvls !== undefined) {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only SUPER_ADMIN can assign LVLs to users' });
      }
      if (user.role !== 'ADMIN' && role !== 'ADMIN') {
        return res.status(400).json({ error: 'LVLs can only be assigned to ADMIN users' });
      }
      user.lvls = lvls;
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (teams !== undefined) user.teams = teams;

    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }
      user.passwordHash = await hashPassword(password);
    }

    await user.save();

    const userResponse = await User.findById(user._id).select('-passwordHash').populate('teams', 'name').populate('lvls', 'name code');
    res.json(userResponse);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', code: 'UPDATE_ERROR' });
  }
});

// DELETE /api/users/:id - Delete user (SUPER_ADMIN only)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user', code: 'DELETE_ERROR' });
  }
});

export default router;

