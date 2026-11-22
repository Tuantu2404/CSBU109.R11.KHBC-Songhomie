const Song = require('../models/Song');
const { uploadBufferToCloudinary } = require('../config/cloudinary');

// Hàm hỗ trợ parse JSON khi Frontend gửi mảng (timeline, chordsAi) qua FormData
const safeParseJSON = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// @desc    Lấy tất cả bài hát (Hỗ trợ tìm kiếm, lọc thể loại, vibeTag & sắp xếp)
// @route   GET /api/songs
exports.getAllSongs = async (req, res) => {
  try {
    const { search, genre, vibeTag, sort } = req.query;
    const query = { status: 'approved' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } }
      ];
    }
    if (genre && genre !== 'All') query.genre = genre;
    if (vibeTag && vibeTag !== 'All') query.vibeTag = vibeTag;

    const sortOption = sort === 'popular' ? { views: -1 } : { createdAt: -1 };

    const songs = await Song.find(query)
      .populate('user', 'username avatar')
      .sort(sortOption);

    res.json({ success: true, count: songs.length, data: songs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// @desc    Lấy chi tiết bài hát theo ID & tăng lượt nghe
// @route   GET /api/songs/:id
exports.getSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).populate('user', 'username avatar');
    if (!song) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    song.views = (song.views || 0) + 1;
    await song.save();

    res.json({ success: true, data: song });
  } catch (error) {
    res.status(500).json({ success: false, message: 'ID bài hát không hợp lệ', error: error.message });
  }
};

// @desc    Tạo bài hát mới (Upload Cloudinary + Lưu Song Producer / AI Timeline)
// @route   POST /api/songs
exports.createSong = async (req, res) => {
  try {
    const {
      title,
      artist,
      genre,
      key,
      lyrics,         // Giữ tương thích với form cũ
      lyricsChords,   // Trường chuẩn trong Song.js (có hỗ trợ thẻ Highlight)
      lyricAlign,     // Căn lề: 'left' | 'center' | 'right'
      isAiGenerated,  // Giữ tương thích với form cũ
      type,           // 'generated' | 'shared'
      youtubeId,
      chordsAi,
      lyricsAi,
      timeline,
      vibeTag,
      competition
    } = req.body;

    // Gộp tương thích giữa field cũ (lyrics) và mới (lyricsChords)
    const finalLyrics = lyricsChords !== undefined ? lyricsChords : (lyrics || '');
    const hasAudioFile = Boolean(req.files?.audio?.[0] || req.body.audioPath);

    if (!title) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề bài hát' });
    }

    if (!finalLyrics && !lyricsAi && !hasAudioFile) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập lời bài hát hoặc tải lên file âm thanh'
      });
    }

    let coverUrl = req.body.coverUrl || '';
    let audioPath = req.body.audioPath || '';

    // 1. Upload ảnh bìa lên Cloudinary (nếu có)
    if (req.files?.cover?.[0]) {
      const coverResult = await uploadBufferToCloudinary(
        req.files.cover[0].buffer,
        'songhomie/covers'
      );
      coverUrl = coverResult.secure_url;
    }

    // 2. Upload file âm thanh lên Cloudinary (nếu có)
    if (req.files?.audio?.[0]) {
      const audioResult = await uploadBufferToCloudinary(
        req.files.audio[0].buffer,
        'songhomie/audios'
      );
      audioPath = audioResult.secure_url;
    }

    const song = await Song.create({
      title,
      artist: artist || 'Various Artists',
      genre: genre || 'Acoustic',
      key: key || 'C',
      coverUrl,
      audioPath,
      lyricsChords: finalLyrics,
      lyricAlign: lyricAlign || 'left',
      youtubeId: youtubeId || undefined,
      chordsAi: safeParseJSON(chordsAi, []),
      lyricsAi: lyricsAi || '',
      timeline: safeParseJSON(timeline, []),
      type: type || (isAiGenerated ? 'generated' : 'shared'),
      vibeTag: vibeTag || 'Chill & Share',
      competition: competition || null,
      user: req.user._id || req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Tạo bài hát thành công!',
      data: song
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// @desc    Cập nhật bài hát (Dùng cho Song Producer: Align, Highlight, Timeline, Media)
// @route   PUT /api/songs/:id
exports.updateSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    const userId = (req.user._id || req.user.id).toString();
    if (song.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài hát này' });
    }

    // Cập nhật ảnh bìa mới lên Cloudinary nếu người dùng tải file mới
    if (req.files?.cover?.[0]) {
      const coverResult = await uploadBufferToCloudinary(
        req.files.cover[0].buffer,
        'songhomie/covers'
      );
      song.coverUrl = coverResult.secure_url;
    }

    // Cập nhật file âm thanh mới lên Cloudinary nếu người dùng tải file mới
    if (req.files?.audio?.[0]) {
      const audioResult = await uploadBufferToCloudinary(
        req.files.audio[0].buffer,
        'songhomie/audios'
      );
      song.audioPath = audioResult.secure_url;
    }

    const updatableFields = [
      'title',
      'artist',
      'genre',
      'key',
      'lyricsChords',
      'lyricAlign',
      'lyricsAi',
      'vibeTag'
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        song[field] = req.body[field];
      }
    });

    // Giữ tương thích nếu frontend gửi field tên là `lyrics`
    if (req.body.lyrics !== undefined && req.body.lyricsChords === undefined) {
      song.lyricsChords = req.body.lyrics;
    }

    if (req.body.timeline !== undefined) {
      song.timeline = safeParseJSON(req.body.timeline, song.timeline);
    }
    if (req.body.chordsAi !== undefined) {
      song.chordsAi = safeParseJSON(req.body.chordsAi, song.chordsAi);
    }

    await song.save();

    res.json({
      success: true,
      message: 'Cập nhật bài hát thành công!',
      data: song
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật bài hát', error: error.message });
  }
};

// @desc    Xóa bài hát
// @route   DELETE /api/songs/:id
exports.deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    const userId = (req.user._id || req.user.id).toString();
    if (song.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài hát này' });
    }

    await song.deleteOne();
    res.json({ success: true, message: 'Đã xóa bài hát thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xóa bài hát', error: error.message });
  }
};

// @desc    Thả cảm xúc cổ vũ tích cực (👏 clap | 🎸 guitar | ❤️ heart)
// @route   POST /api/songs/:id/react
exports.reactToSong = async (req, res) => {
  try {
    const { reactionType } = req.body;
    const allowedTypes = ['clap', 'guitar', 'heart'];

    if (!allowedTypes.includes(reactionType)) {
      return res.status(400).json({ success: false, message: 'Loại cảm xúc không hợp lệ' });
    }

    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });
    }

    const userId = (req.user._id || req.user.id).toString();
    const list = song.reactions[reactionType] || [];
    const index = list.findIndex((id) => id.toString() === userId);

    if (index > -1) list.splice(index, 1);
    else list.push(userId);

    song.reactions[reactionType] = list;
    await song.save();

    res.json({ success: true, data: song.reactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi thả cảm xúc', error: error.message });
  }
};

// @desc    Thích / Bỏ thích bài hát
// @route   POST /api/songs/:id/like
exports.toggleLikeSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });

    const userId = (req.user._id || req.user.id).toString();
    const index = song.likes.findIndex((id) => id.toString() === userId);

    if (index > -1) song.likes.splice(index, 1);
    else song.likes.push(userId);

    await song.save();
    res.json({ success: true, data: song.likes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi thao tác yêu thích', error: error.message });
  }
};

// @desc    Lưu / Bỏ lưu vào sổ tay hợp âm cá nhân
// @route   POST /api/songs/:id/bookmark
exports.toggleBookmarkSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Không tìm thấy bài hát' });

    const userId = (req.user._id || req.user.id).toString();
    const index = song.bookmarks.findIndex((id) => id.toString() === userId);

    if (index > -1) song.bookmarks.splice(index, 1);
    else song.bookmarks.push(userId);

    await song.save();
    res.json({ success: true, data: song.bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi lưu bài hát', error: error.message });
  }
};