const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { cloudinary, uploadBufferToCloudinary } = require('../config/cloudinary');

// Hàm phụ xóa file tạm an toàn
const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Không thể xóa file tạm:', e.message);
    }
  }
};

// Chuẩn hóa dữ liệu trả về từ Python AI để tương thích với SongDetailPage (GuitarFretboard)
const formatAiOutput = (aiResult = {}) => {
  const chords = Array.isArray(aiResult.chords)
    ? aiResult.chords
    : Array.isArray(aiResult.chordsAi)
    ? aiResult.chordsAi
    : [];

  const lyricsText = aiResult.lyrics || aiResult.lyricsAi || '';
  const lyricLines = lyricsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Tạo timeline đồng bộ từng câu hát + hợp âm theo giây nếu Python chưa trả về sẵn
  const timeline = Array.isArray(aiResult.timeline) && aiResult.timeline.length > 0
    ? aiResult.timeline
    : chords.map((item, idx) => ({
        time: Number(item.time) || idx * 4,
        chord: item.chord || 'C',
        text: lyricLines[idx] || `Đoạn nhạc ${idx + 1} (${item.chord || 'C'})`,
      }));

  // Tạo chuỗi lyricsChords gắn sẵn thẻ [Chord] để mở được trong Song Producer
  const lyricsChords =
    aiResult.lyricsChords ||
    (timeline.length > 0
      ? timeline.map((row) => `[${row.chord}] ${row.text}`).join('\n')
      : lyricsText);

  return {
    ...aiResult,
    chordsAi: chords,
    lyricsAi: lyricsText,
    timeline,
    lyricsChords,
  };
};

// @desc    Phân tích hợp âm từ YouTube URL qua Python AI Service
// @route   POST /api/ai/from-youtube
exports.analyzeYoutube = async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp URL YouTube' });
    }

    const scriptPath = path.join(__dirname, '../scripts/chord_analyzer.py');
    const pythonProcess = spawn('python', [scriptPath, videoUrl], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString('utf-8');
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString('utf-8');
    });

    pythonProcess.on('error', (err) => {
      return res.status(500).json({
        success: false,
        message: 'Không thể khởi chạy tiến trình Python AI',
        error: err.message,
      });
    });

    pythonProcess.on('close', (code) => {
      try {
        if (!dataString.trim()) {
          return res.status(500).json({
            success: false,
            message: 'Python AI không trả về dữ liệu',
            error: errorString || `Exit code: ${code}`,
          });
        }

        const rawResult = JSON.parse(dataString.trim());
        const normalizedData = formatAiOutput(rawResult);

        res.json({
          success: true,
          message: 'Phân tích AI từ YouTube hoàn tất',
          data: normalizedData,
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Lỗi parse dữ liệu từ Python AI',
          error: errorString || err.message,
        });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// @desc    Phân tích hợp âm & bóc tách lời từ File Audio Upload
// @route   POST /api/ai/from-audio
exports.analyzeAudio = async (req, res) => {
  let localFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên 1 file âm thanh (MP3, WAV)',
      });
    }

    // Hỗ trợ cả diskStorage (req.file.path) và memoryStorage (req.file.buffer)
    if (req.file.path) {
      localFilePath = req.file.path;
    } else if (req.file.buffer) {
      const safeName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      localFilePath = path.join(os.tmpdir(), safeName);
      fs.writeFileSync(localFilePath, req.file.buffer);
    }

    const scriptPath = path.join(__dirname, '../scripts/chord_analyzer.py');

    // 1. Thực thi Python AI Script trên file nhạc vừa upload
    const pythonProcess = spawn('python', [scriptPath, localFilePath], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString('utf-8');
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString('utf-8');
    });

    pythonProcess.on('error', (err) => {
      cleanupTempFile(localFilePath);
      return res.status(500).json({
        success: false,
        message: 'Không thể khởi chạy tiến trình Python AI',
        error: err.message,
      });
    });

    pythonProcess.on('close', async (code) => {
      try {
        if (!dataString.trim()) {
          cleanupTempFile(localFilePath);
          return res.status(500).json({
            success: false,
            message: 'Python AI không trả về dữ liệu phân tích',
            error: errorString || `Exit code: ${code}`,
          });
        }

        const rawAiResult = JSON.parse(dataString.trim());
        const normalizedAiData = formatAiOutput(rawAiResult);

        // 2. Upload file âm thanh lên Cloudinary lưu trữ lâu dài
        let cloudinaryUrl = null;
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          if (req.file.buffer) {
            const uploadRes = await uploadBufferToCloudinary(
              req.file.buffer,
              'songhomie/audios'
            );
            cloudinaryUrl = uploadRes.secure_url;
          } else {
            const uploadRes = await cloudinary.uploader.upload(localFilePath, {
              resource_type: 'auto',
              folder: 'songhomie/audios',
            });
            cloudinaryUrl = uploadRes.secure_url;
          }
        }

        // 3. Xóa file tạm sau khi xử lý xong
        cleanupTempFile(localFilePath);

        res.json({
          success: true,
          message: 'Bóc tách hợp âm và lời bài hát thành công!',
          audioUrl: cloudinaryUrl,
          aiData: normalizedAiData,
        });
      } catch (err) {
        cleanupTempFile(localFilePath);
        res.status(500).json({
          success: false,
          message: 'Lỗi xử lý file từ AI',
          error: errorString || err.message,
        });
      }
    });
  } catch (error) {
    cleanupTempFile(localFilePath);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};