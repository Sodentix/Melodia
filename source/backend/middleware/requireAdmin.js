const User = require('../models/User');

/**
 * Use after auth(true) or auth(true, true). Ensures the authenticated user has userRole === 'admin'.
 * Returns 403 if not admin.
 */
async function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await User.findByIdNotDeleted(req.user.id).select('userRole').lean();
    if (!user || user.userRole !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = requireAdmin;
