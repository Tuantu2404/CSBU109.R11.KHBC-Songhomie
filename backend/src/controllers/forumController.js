const ForumPost = require('../models/ForumPost');

// @desc    Lấy danh sách bài đăng trên Diễn đàn
// @route   GET /api/forum
exports.getAllPosts = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category && category !== 'All') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await ForumPost.find(query)
      .populate('author', 'username avatar')
      .populate('attachedSong', 'title artist key vibeTag coverUrl')
      .populate('replies.user', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load the forum.', error: error.message });
  }
};

// @desc    Tạo bài viết mới trên Diễn đàn
// @route   POST /api/forum
exports.createPost = async (req, res) => {
  try {
    const { title, content, category, attachedSong } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Please enter both a title and content.' });
    }

    const newPost = await ForumPost.create({
      author: req.user._id || req.user.id,
      title,
      content,
      category: category || 'Giao lưu Cover',
      attachedSong: attachedSong || null,
    });

    const populated = await ForumPost.findById(newPost._id)
      .populate('author', 'username avatar')
      .populate('attachedSong', 'title artist key vibeTag coverUrl');

    res.status(201).json({ success: true, message: 'Post published successfully.', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to publish the post.', error: error.message });
  }
};

// @desc    Gửi lời cổ vũ tích cực (Cheer)
// @route   POST /api/forum/:id/cheer
exports.toggleCheerPost = async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const userId = (req.user._id || req.user.id).toString();
    const index = post.cheers.findIndex((id) => id.toString() === userId);

    if (index > -1) post.cheers.splice(index, 1);
    else post.cheers.push(userId);

    await post.save();
    res.json({ success: true, data: post.cheers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send reaction.', error: error.message });
  }
};

// @desc    Bình luận phản hồi bài viết
// @route   POST /api/forum/:id/reply
exports.addReply = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    post.replies.push({
      user: req.user._id || req.user.id,
      content,
    });

    await post.save();

    const updated = await ForumPost.findById(post._id)
      .populate('author', 'username avatar')
      .populate('attachedSong', 'title artist key vibeTag coverUrl')
      .populate('replies.user', 'username avatar');

    res.status(201).json({ success: true, data: updated.replies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send reply.', error: error.message });
  }
};