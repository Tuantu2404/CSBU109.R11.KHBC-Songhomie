const Song = require('../models/Song');
const User = require('../models/User');

// Hàm phụ tính tổng lượt cổ vũ tích cực (clap + guitar + heart)
const enrichSongStats = (song) => {
  const clapCount = song.reactions?.clap?.length || 0;
  const guitarCount = song.reactions?.guitar?.length || 0;
  const heartCount = song.reactions?.heart?.length || 0;
  const totalReactions = clapCount + guitarCount + heartCount;

  return {
    ...song,
    totalReactions,
    likesCount: song.likesCount || totalReactions,
  };
};

// @desc    Bảng xếp hạng Hợp âm Hot nhất (Nhiều lượt xem/cổ vũ nhất)
// @route   GET /api/rankings/top-chords
exports.getTopHotChords = async (req, res) => {
  try {
    const topSongs = await Song.find()
      .sort({ views: -1, likesCount: -1, createdAt: -1 })
      .limit(10)
      .populate('user_id', 'username avatar')
      .lean();

    const formattedSongs = topSongs.map(enrichSongStats);

    res.json({ success: true, data: formattedSongs });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

// @desc    Bảng xếp hạng Bài hát bóc tách bởi AI nổi bật nhất
// @route   GET /api/rankings/top-ai
exports.getTopAiSongs = async (req, res) => {
  try {
    // Khớp cả field cũ (isAiGenerated) lẫn field mới từ AiAnalyzerPage (type: 'generated')
    const aiSongs = await Song.find({
      $or: [{ isAiGenerated: true }, { type: 'generated' }],
    })
      .sort({ views: -1, createdAt: -1 })
      .limit(10)
      .populate('user_id', 'username avatar')
      .lean();

    const formattedSongs = aiSongs.map(enrichSongStats);

    res.json({ success: true, data: formattedSongs });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

// @desc    Top người đóng góp / Tác giả sôi nổi nhất
// @route   GET /api/rankings/top-creators
exports.getTopCreators = async (req, res) => {
  try {
    const topCreators = await User.find()
      .select('username avatar contributionsCount points')
      .sort({ points: -1, contributionsCount: -1, createdAt: 1 })
      .limit(5)
      .lean();

    res.json({ success: true, data: topCreators });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};