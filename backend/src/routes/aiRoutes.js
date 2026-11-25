const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middlewares/authMiddleware');
const { analyzeYoutube, analyzeAudio } = require('../controllers/aiController');

// Lưu file tạm trên RAM (buffer) để aiController đưa qua Python AI & đẩy lên Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB maximum
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported audio format. Only MP3, WAV, OGG, and M4A files are allowed.'), false);
    }
  },
});

// Hỗ trợ nhận file dù Frontend gửi FormData với key là 'audio' hay 'file'
const handleAudioUpload = (req, res, next) => {
  const uploader = upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  uploader(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    req.file = req.files?.audio?.[0] || req.files?.file?.[0] || null;
    next();
  });
};

router.post('/from-youtube', protect, analyzeYoutube);
router.post('/from-audio', protect, handleAudioUpload, analyzeAudio);

module.exports = router;