const jwt = require('jsonwebtoken');
const User = require('../models/User');

function auth(required = true, checkEmailVerification = false) {
  return async function authMiddleware(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (required) return res.status(401).json({ message: 'Unauthorized' });
      req.user = null;
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
      const payload = jwt.verify(token, secret);
      
      // If email verification is required, fetch user from database
      if (checkEmailVerification) {
        const user = await User.findById(payload.sub);
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }
        if (!user.emailVerified) {
          return res.status(403).json({ 
            message: 'Email verification required',
            emailVerified: false 
          });
        }
        req.user = { 
          id: user._id, 
          email: user.email, 
          emailVerified: user.emailVerified 
        };
      } else {
        req.user = { id: payload.sub, email: payload.email };
      }
      
      return next();
    } catch (err) {
      if (required) return res.status(401).json({ message: 'Invalid token' });
      req.user = null;
      return next();
    }
  };
}

module.exports = auth;


