const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith('Bearer')) {
    try {
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'songhomie_secret');
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'This account no longer exists.' });
      }
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Your token is invalid or has expired.' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Authentication token not found.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
};

module.exports = { protect, adminOnly };