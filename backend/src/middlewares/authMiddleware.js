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
        return res.status(401).json({ success: false, message: 'Tài khoản không còn tồn tại!' });
      }
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Không tìm thấy Token xác thực!' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối! Chỉ dành cho Admin.' });
  }
};

module.exports = { protect, adminOnly };