const express = require('express');
const router = express.Router();
const {
  getAllSongs,
  getSongById,
  createSong,
  updateSong,
  deleteSong,
  reactToSong,
  toggleLikeSong,
  toggleBookmarkSong,
} = require('../controllers/songController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadSongFields } = require('../config/cloudinary');

// Public routes
router.get('/', getAllSongs);
router.get('/:id', getSongById);

// Protected routes (Bắt buộc đăng nhập + hỗ trợ upload ảnh bìa & file nhạc lên Cloudinary)
router.post('/', protect, uploadSongFields, createSong);
router.put('/:id', protect, uploadSongFields, updateSong);
router.delete('/:id', protect, deleteSong);

// Tương tác cộng đồng tích cực (👏 clap, 🎸 guitar, ❤️ heart, like, bookmark)
router.post('/:id/react', protect, reactToSong);
router.post('/:id/like', protect, toggleLikeSong);
router.post('/:id/bookmark', protect, toggleBookmarkSong);

module.exports = router;