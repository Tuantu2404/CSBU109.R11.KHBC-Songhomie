const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please enter a post title.'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Please enter post content.'],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Giao lưu Cover',
        'Chia sẻ Chord Sheet',
        'Hỏi đáp Kỹ thuật',
        'Góc AI Sáng tác',
      ],
      default: 'Giao lưu Cover',
    },
    // Đính kèm bài hát / bản phối từ Song Producer để mọi người mở đàn tập ngay
    attachedSong: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      default: null,
    },
    // Nút cổ vũ tích cực (Cheer)
    cheers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    replies: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ForumPost', forumPostSchema);