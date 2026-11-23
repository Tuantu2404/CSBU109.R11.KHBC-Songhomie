const aiService = require("../services/aiService");
const storageService = require("../services/storageService");

// @desc    Phân tích hợp âm từ YouTube URL qua Python AI Service
// @route   POST /api/ai/from-youtube
exports.analyzeYoutube = async (req, res) => {
  try {
    const { videoUrl, language = "auto" } = req.body;
    if (!videoUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp URL YouTube" });
    }

    const normalizedData = await aiService.analyzeWithPython(videoUrl, language);

    return res.json({
      success: true,
      message: "Phân tích AI từ YouTube hoàn tất",
      data: normalizedData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi xử lý AI từ YouTube",
      error: err.details || err.message,
    });
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
        message: "Vui lòng tải lên 1 file âm thanh (MP3, WAV)",
      });
    }

    const language = req.body?.language || "auto";
    localFilePath = storageService.saveTempFileFromRequest(req.file);

    // 1. Chạy phân tích AI
    const normalizedAiData = await aiService.analyzeWithPython(
      localFilePath,
      language,
    );

    // 2. Upload file âm thanh lên Cloudinary
    const cloudinaryUrl = await storageService.uploadAudioToCloud(
      req.file,
      localFilePath,
      "songhomie/audios",
    );

    return res.json({
      success: true,
      message: "Bóc tách hợp âm và lời bài hát thành công!",
      audioUrl: cloudinaryUrl,
      aiData: normalizedAiData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi xử lý file từ AI",
      error: err.details || err.message,
    });
  } finally {
    // Luôn dọn file tạm dù thành công hay gặp lỗi
    storageService.cleanupTempFile(localFilePath);
  }
};