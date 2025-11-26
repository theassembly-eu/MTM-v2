/**
 * Require specific role(s)
 * @param {...string} roles - Required roles
 * @returns {Function} Middleware function
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_AUTH' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions', 
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Require one of the specified roles (role hierarchy)
 * SUPER_ADMIN > ADMIN > TEAM_LEADER > TEAM_MEMBER
 * @param {...string} roles - Minimum required role
 * @returns {Function} Middleware function
 */
export function requireRoleOrHigher(...roles) {
  const roleHierarchy = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    TEAM_LEADER: 2,
    TEAM_MEMBER: 1,
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_AUTH' });
    }

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = Math.max(...roles.map(role => roleHierarchy[role] || 0));

    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions', 
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Check if user is member of a specific team
 * @param {Function} getTeamId - Function to extract team ID from request (req) => string
 * @returns {Function} Middleware function
 */
export function requireTeamMembership(getTeamId) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_AUTH' });
    }

    // SUPER_ADMIN and ADMIN can access any team
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      return next();
    }

    const teamId = getTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID required', code: 'NO_TEAM_ID' });
    }

    if (!req.user.teams.includes(teamId)) {
      return res.status(403).json({ 
        error: 'Not a member of this team', 
        code: 'NOT_TEAM_MEMBER',
        teamId,
      });
    }

    next();
  };
}

/**
 * Check if user owns or is admin of a team
 * @param {Function} getTeamId - Function to extract team ID from request
 * @returns {Function} Middleware function
 */
export function requireTeamOwnership(getTeamId) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_AUTH' });
    }

    // SUPER_ADMIN can access any team
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const teamId = getTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID required', code: 'NO_TEAM_ID' });
    }

    // ADMIN and TEAM_LEADER can manage teams they belong to
    if ((req.user.role === 'ADMIN' || req.user.role === 'TEAM_LEADER') && 
        req.user.teams.includes(teamId)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Not authorized to manage this team', 
      code: 'NOT_TEAM_OWNER',
      teamId,
    });
  };
}

