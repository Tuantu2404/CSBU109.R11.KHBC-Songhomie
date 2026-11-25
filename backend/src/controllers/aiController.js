const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const aiService = require("../services/aiService");
const storageService = require("../services/storageService");

function removeLocalFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, () => {});
  }
}

function buildNormalizedAiPayload(result, extra = {}) {
  const detectedKey =
    result.key ||
    result.chordsAi?.[0]?.chord ||
    result.chords?.[0]?.chord ||
    "C";

  const syncedText =
    result.lyricsChords ||
    result.lyricsAi ||
    result.lyrics ||
    "";

  return {
    ...result,
    key: detectedKey,
    chordsAi: result.chordsAi || result.chords || [],
    lyricsChords: syncedText,
    lyricsAi: syncedText,
    ...extra,
  };
}

// @desc    Phân tích hợp âm & lời bài hát từ link YouTube
// @route   POST /api/ai/from-youtube
exports.analyzeYoutube = async (req, res) => {
  try {
    const videoUrl = (
      req.body.videoUrl ||
      req.body.youtubeUrl ||
      req.body.url ||
      ""
    ).trim();
    const language = (req.body.language || "auto").trim();
    const lyricMode =
      req.body.lyricMode === "transcribe" ? "transcribe" : "search";
    const qualityMode = req.body.qualityMode === "studio" ? "studio" : "fast";

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        message: "Please enter a YouTube video URL.",
      });
    }

    const result = await aiService.analyzeYoutube(
      videoUrl,
      language,
      lyricMode,
      qualityMode,
    );

    if (!result || result.success === false) {
      return res.status(500).json({
        success: false,
        message: result?.error || "Unable to analyze this YouTube video.",
      });
    }

    const normalizedData = buildNormalizedAiPayload(result, {
      lyricMode,
      qualityMode,
    });

    return res.json({
      success: true,
      data: normalizedData,
      aiData: normalizedData,
    });
  } catch (error) {
    console.error("[AI YouTube Error]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error while analyzing the YouTube video.",
    });
  }
};

// @desc    Phân tích hợp âm & lời bài hát từ file âm thanh tải lên (hỗ trợ memoryStorage & diskStorage)
// @route   POST /api/ai/from-audio
exports.analyzeAudio = async (req, res) => {
  let tempFilePath = req.file?.path || "";
  let createdFromBuffer = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please choose an audio file (.mp3, .wav, or .m4a).",
      });
    }

    // Nếu multer dùng memoryStorage(), ghi buffer ra file tạm để Python & Cloudinary đọc được
    if (!tempFilePath && req.file.buffer) {
      const ext = path.extname(req.file.originalname || "") || ".mp3";
      const uniqueName = `songhomie_upload_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
      tempFilePath = path.join(os.tmpdir(), uniqueName);
      fs.writeFileSync(tempFilePath, req.file.buffer);
      createdFromBuffer = true;
    }

    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      return res.status(400).json({
        success: false,
        message: "Unable to read the uploaded audio file.",
      });
    }

    const language = (req.body.language || "auto").trim();
    const lyricMode =
      req.body.lyricMode === "transcribe" ? "transcribe" : "search";
    const qualityMode = req.body.qualityMode === "studio" ? "studio" : "fast";

    const result = await aiService.analyzeAudio(
      tempFilePath,
      language,
      lyricMode,
      qualityMode,
      {
        trackTitle: (req.body.trackTitle || "").trim(),
        artist: (req.body.artist || "").trim(),
      },
    );

    if (!result || result.success === false) {
      return res.status(500).json({
        success: false,
        message: result?.error || "Unable to analyze the audio file.",
      });
    }

    // Lưu file gốc lên Cloudinary để phát lại và đồng bộ timeline sau khi lưu bài hát
    let audioPath = "";
    let audioWarning = "";
    try {
      if (typeof storageService.uploadAudioToCloud === "function") {
        audioPath = await storageService.uploadAudioToCloud(req.file, tempFilePath);
      }
      if (!audioPath) {
        audioWarning = "Unable to save the original audio. Check the backend's Cloudinary configuration.";
      }
    } catch (uploadErr) {
      console.error("Upload audio storage warning:", uploadErr.message);
      audioWarning = "Unable to upload the original audio to storage: " + uploadErr.message;
    }

    const normalizedData = buildNormalizedAiPayload(result, {
      lyricMode,
      qualityMode,
      audioPath,
      audioWarning,
    });

    return res.json({
      success: true,
      aiData: normalizedData,
      audioUrl: audioPath,
      audioWarning,
      data: normalizedData,
    });
  } catch (error) {
    console.error("[AI Audio Error]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error while analyzing the audio file.",
    });
  } finally {
    if (
      createdFromBuffer ||
      (storageService && typeof storageService.uploadAudioToCloud === "function")
    ) {
      removeLocalFile(tempFilePath);
    }
  }
};

exports.analyzeFromYoutube = exports.analyzeYoutube;
exports.analyzeFromAudio = exports.analyzeAudio;
exports.analyzeFile = exports.analyzeAudio;