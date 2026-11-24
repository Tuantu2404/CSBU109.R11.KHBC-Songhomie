const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Hàm tạo JWT Token
const generateToken = (id) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const lifetimeSeconds = 30 * 60;
  return {
    token: jwt.sign(
      { id, iat: issuedAt },
      process.env.JWT_SECRET || 'songhomie_secret',
      { expiresIn: lifetimeSeconds },
    ),
    tokenExpiresAt: new Date((issuedAt + lifetimeSeconds) * 1000).toISOString(),
  };
};

// @desc    Đăng ký tài khoản mới
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng' });
    }

    const user = await User.create({ username, email, password });
    const authToken = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: authToken.token,
        tokenExpiresAt: authToken.tokenExpiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// @desc    Đăng nhập
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (user && (await user.matchPassword(password))) {
      const authToken = generateToken(user._id);
      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          token: authToken.token,
          tokenExpiresAt: authToken.tokenExpiresAt,
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// @desc    Lấy thông tin người dùng hiện tại
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};