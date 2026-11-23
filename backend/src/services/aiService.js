const { spawn } = require("child_process");
const path = require("path");

const SCRIPT_PATH = path.join(__dirname, "../scripts/chord_analyzer.py");

// Tách từng dòng [mm:ss.xx] (Hợp âm) Lời bài hát thành mảng timeline đồng bộ
const parseLyricsToTimeline = (lyricsText, fallbackChords = []) => {
  if (!lyricsText) return [];

  const lines = lyricsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line, idx) => {
    // Dạng 1: [01:15.86] (G) Nhưng anh ngồi đây...
    const lrcMatch = line.match(
      /^\[(\d+):(\d+(?:\.\d+)?)\]\s*\(([^)]+)\)\s*(.*)$/,
    );
    if (lrcMatch) {
      const mins = parseInt(lrcMatch[1], 10);
      const secs = parseFloat(lrcMatch[2]);
      return {
        time: Number((mins * 60 + secs).toFixed(2)),
        chord: lrcMatch[3].trim(),
        text: lrcMatch[4].trim(),
      };
    }

    // Dạng 2: [13.84s] (A#) [Beat Marker]
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

    // Dạng 3: [Am] Lời bài hát
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

  const timeline =
    Array.isArray(aiResult.timeline) && aiResult.timeline.length > 0
      ? aiResult.timeline
      : parsedTimeline.length > 0
        ? parsedTimeline
        : chords.map((item, idx) => ({
            time: Number(item.time) || idx * 4,
            chord: item.chord || "C",
            text: `Đoạn nhạc ${idx + 1} (${item.chord || "C"})`,
          }));

  const lyricsChords =
    aiResult.lyricsChords ||
    lyricsText ||
    timeline.map((row) => `[${row.chord}] ${row.text}`).join("\n");

  return {
    ...aiResult,
    chordsAi: chords,
    lyricsAi: lyricsText,
    timeline,
    lyricsChords,
  };
};

// Trích xuất an toàn chuỗi JSON từ stdout (bỏ qua log/thanh tiến trình của thư viện AI)
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
      } catch (_) {
        // Bỏ qua nếu không phải JSON hoàn chỉnh
      }
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }

  return JSON.parse(cleaned);
};

// Thực thi script Python phân tích hợp âm & lời bài hát (trả về Promise)
const analyzeWithPython = (targetInput, language = "auto") => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(
      "python",
      [SCRIPT_PATH, targetInput, language],
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
      const error = new Error("Không thể khởi chạy tiến trình Python AI");
      error.details = err.message;
      reject(error);
    });

    pythonProcess.on("close", (code) => {
      try {
        if (!dataString.trim()) {
          const error = new Error("Python AI không trả về dữ liệu phân tích");
          error.details = errorString || `Exit code: ${code}`;
          return reject(error);
        }

        const rawResult = parsePythonJsonOutput(dataString);
        if (rawResult.success === false) {
          const error = new Error(
            rawResult.error || "Lỗi xử lý từ Python AI",
          );
          error.details = errorString;
          return reject(error);
        }

        resolve(formatAiOutput(rawResult));
      } catch (err) {
        const error = new Error("Lỗi parse dữ liệu từ Python AI");
        error.details = errorString || err.message;
        reject(error);
      }
    });
  });
};

module.exports = {
  analyzeWithPython,
  formatAiOutput,
  parseLyricsToTimeline,
};