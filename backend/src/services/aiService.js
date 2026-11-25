const { spawn } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const SCRIPT_PATH = path.join(__dirname, "../scripts/chord_analyzer.py");

// Giới hạn số tiến trình AI chạy song song để chống quá tải CPU/RAM
const MAX_CONCURRENT_AI_JOBS = parseInt(
  process.env.MAX_CONCURRENT_AI_JOBS || "1",
  10,
);
let activeJobs = 0;
const jobQueue = [];

// Cache kết quả (tối đa 100 bài gần nhất) + gộp các request đang chạy trùng
const resultCache = new Map();
const inFlightRequests = new Map();
const MAX_CACHE_ITEMS = 100;

function getCacheKey(targetInput, language, lyricMode, qualityMode, metadata = {}) {
  let normalizedTarget = targetInput.trim();
  if (!normalizedTarget.startsWith("http") && fs.existsSync(normalizedTarget)) {
    const fileBuffer = fs.readFileSync(normalizedTarget);
    const hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
    normalizedTarget = `file_${hash}`;
  }
  const normalizedMetadata = [metadata.trackTitle || "", metadata.artist || ""]
    .map((value) => value.trim().toLowerCase())
    .join("|");
  return `${normalizedTarget}|${language}|${lyricMode}|${qualityMode}|${normalizedMetadata}`;
}

function saveToCache(key, value) {
  if (resultCache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = resultCache.keys().next().value;
    resultCache.delete(oldestKey);
  }
  resultCache.set(key, value);
}

function enqueueAiTask(taskFn) {
  return new Promise((resolve, reject) => {
    const runTask = async () => {
      activeJobs++;
      try {
        const res = await taskFn();
        resolve(res);
      } catch (err) {
        reject(err);
      } finally {
        activeJobs--;
        if (jobQueue.length > 0) {
          const nextJob = jobQueue.shift();
          nextJob();
        }
      }
    };

    if (activeJobs < MAX_CONCURRENT_AI_JOBS) {
      runTask();
    } else {
      jobQueue.push(runTask);
    }
  });
}

// Tách từng dòng [mm:ss.xx] (Hợp âm) Lời bài hát thành mảng timeline đồng bộ
const parseLyricsToTimeline = (lyricsText, fallbackChords = []) => {
  if (!lyricsText) return [];

  const lines = lyricsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line, idx) => {
    const lrcMatch = line.match(
      /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(?:\(([^)]+)\)\s*)?(.*)$/,
    );
    if (lrcMatch) {
      const mins = parseInt(lrcMatch[1], 10);
      const secs = parseFloat(lrcMatch[2]);
      return {
        time: Number((mins * 60 + secs).toFixed(2)),
        chord:
          lrcMatch[3]?.trim() ||
          (lrcMatch[4].trim() ? fallbackChords[idx]?.chord || "" : ""),
        text: lrcMatch[4].trim(),
      };
    }

    const secMatch = line.match(
      /^\[(\d+(?:\.\d+)?)s?\]\s*\(([^)]+)\)\s*(.*)$/,
    );
    if (secMatch) {
      return {
        time: Number(parseFloat(secMatch[1]).toFixed(2)),
        chord: secMatch[2].trim(),
        text: secMatch[3].trim(),
      };
    }

    const chordMatch = line.match(/^\[([A-G][#b]?[^\]]*)\]\s*(.*)$/);
    if (chordMatch) {
      return {
        time: Number(fallbackChords[idx]?.time) || idx * 4,
        chord: chordMatch[1].trim(),
        text: chordMatch[2].trim(),
      };
    }

    return {
      time: Number(fallbackChords[idx]?.time) || idx * 4,
      chord: fallbackChords[idx]?.chord || "C",
      text: line,
    };
  });
};

// Chuẩn hóa dữ liệu đầu ra tương thích với SongDetailPage & GuitarFretboard
const formatAiOutput = (aiResult = {}) => {
  const chords = Array.isArray(aiResult.chords)
    ? aiResult.chords
    : Array.isArray(aiResult.chordsAi)
      ? aiResult.chordsAi
      : [];

  const lyricsText = aiResult.lyrics || aiResult.lyricsAi || "";
  const parsedTimeline = parseLyricsToTimeline(lyricsText, chords);
  const timedLyricsTimeline = Array.isArray(aiResult.timedLyrics)
    ? aiResult.timedLyrics.map((line) => ({
        ...line,
        time: Number(line.start),
        chord: line.chord || "",
        text: line.text || "",
      }))
    : [];

  const timeline =
    Array.isArray(aiResult.timeline) && aiResult.timeline.length > 0
      ? aiResult.timeline
      : timedLyricsTimeline.length > 0
        ? timedLyricsTimeline
      : parsedTimeline.length > 0
        ? parsedTimeline
        : chords.map((item, idx) => ({
            time: Number(item.time) || idx * 4,
            chord: item.chord || "C",
            text: "",
          }));

  const lyricsChords =
    aiResult.lyricsChords ||
    lyricsText ||
    timeline
      .map((row) => {
        const mins = Math.floor(Number(row.time || 0) / 60);
        const secs = (Number(row.time || 0) % 60).toFixed(2).padStart(5, "0");
        return `[${String(mins).padStart(2, "0")}:${secs}] (${row.chord}) ${row.text || ""}`.trimEnd();
      })
      .join("\n");

  return {
    ...aiResult,
    chordsAi: chords,
    lyricsAi: lyricsText,
    timeline,
    lyricsChords,
  };
};

// Trích xuất an toàn chuỗi JSON từ stdout (bỏ qua log của thư viện AI)
const parsePythonJsonOutput = (stdoutStr) => {
  const cleaned = stdoutStr.trim();
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("{") && lines[i].endsWith("}")) {
      try {
        return JSON.parse(lines[i]);
      } catch (_) {}
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }

  return JSON.parse(cleaned);
};

const spawnPythonAnalyzer = (
  targetInput,
  safeLang,
  safeMode,
  safeQuality,
  metadata,
) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(
      "python",
      [
        SCRIPT_PATH,
        targetInput,
        safeLang,
        safeMode,
        safeQuality,
        metadata.trackTitle || "",
        metadata.artist || "",
      ],
      {
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      },
    );

    let dataString = "";
    let errorString = "";

    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString("utf-8");
    });

    pythonProcess.stderr.on("data", (data) => {
      errorString += data.toString("utf-8");
    });

    pythonProcess.on("error", (err) => {
      const error = new Error("Unable to start the Python AI process.");
      error.details = err.message;
      reject(error);
    });

    pythonProcess.on("close", (code) => {
      try {
        if (!dataString.trim()) {
          const error = new Error("The Python AI process returned no analysis data.");
          error.details = errorString || `Exit code: ${code}`;
          return reject(error);
        }

        const rawResult = parsePythonJsonOutput(dataString);
        if (rawResult.success === false) {
          const error = new Error(
            rawResult.error || "Python AI processing failed.",
          );
          error.details = errorString;
          return reject(error);
        }

        resolve(formatAiOutput(rawResult));
      } catch (err) {
        const error = new Error("Failed to parse Python AI output.");
        error.details = errorString || err.message;
        reject(error);
      }
    });
  });
};

// Thực thi qua Cache + Gộp request trùng + Hàng đợi giới hạn đồng thời
const analyzeWithPython = (
  targetInput,
  language = "auto",
  lyricMode = "search",
  qualityMode = "fast",
  metadata = {},
) => {
  const safeLang = (language || "auto").trim();
  const safeMode = lyricMode === "transcribe" ? "transcribe" : "search";
  const safeQuality = qualityMode === "studio" ? "studio" : "fast";
  const cacheKey = getCacheKey(targetInput, safeLang, safeMode, safeQuality, metadata);

  if (resultCache.has(cacheKey)) {
    return Promise.resolve({ ...resultCache.get(cacheKey), fromCache: true });
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const jobPromise = enqueueAiTask(() =>
    spawnPythonAnalyzer(targetInput, safeLang, safeMode, safeQuality, metadata),
  )
    .then((formattedResult) => {
      saveToCache(cacheKey, formattedResult);
      return formattedResult;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, jobPromise);
  return jobPromise;
};

const analyzeYoutube = (
  videoUrl,
  language = "auto",
  lyricMode = "search",
  qualityMode = "fast",
) => analyzeWithPython(videoUrl, language, lyricMode, qualityMode);

const analyzeAudio = (
  filePath,
  language = "auto",
  lyricMode = "search",
  qualityMode = "fast",
  metadata = {},
) => analyzeWithPython(filePath, language, lyricMode, qualityMode, metadata);

module.exports = {
  analyzeWithPython,
  analyzeYoutube,
  analyzeAudio,
  formatAiOutput,
  parseLyricsToTimeline,
};