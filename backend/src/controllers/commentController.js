const Comment = require('../models/Comment');

// @desc    Lấy danh sách bình luận của 1 bài hát
// @route   GET /api/comments/song/:songId
exports.getSongComments = async (req, res) => {
  try {
    const comments = await Comment.find({ song: req.params.songId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: comments.length, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// @desc    Tạo bình luận mới
// @route   POST /api/comments/song/:songId
exports.createComment = async (req, res) => {
  try {
    const content = (req.body.content || '').trim();

    if (!content) {
      return res
        .status(400)
        .json({ success: false, message: 'Nội dung bình luận không được trống' });
    }

    const comment = await Comment.create({
      song: req.params.songId,
      user: req.user._id || req.user.id,
      content,
    });

    const populatedComment = await comment.populate('user', 'username avatar');

    res
      .status(201)
      .json({ success: true, message: 'Thêm bình luận thành công', data: populatedComment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};