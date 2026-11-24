import { useState, useContext, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Upload,
  Video,
  Guitar,
  Save,
  Sparkles,
  Sliders,
  Music,
} from "lucide-react";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import YouTubePlayer from "../components/YouTubePlayer";

const extractYoutubeId = (url = "") => {
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
  );
  return match ? match[1] : "";
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

const parseEditedTimelineLine = (line, previousLine) => {
  const lrcMatch = line.match(
    /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(?:\(([^)]+)\)\s*)?(.*)$/,
  );
  if (lrcMatch) {
    return {
      ...previousLine,
      time: Number(
        (parseInt(lrcMatch[1], 10) * 60 + parseFloat(lrcMatch[2])).toFixed(2),
      ),
      chord: lrcMatch[3]?.trim() || previousLine.chord,
      text: lrcMatch[4].trim(),
    };
  }

  const secondsMatch = line.match(
    /^\[(\d+(?:\.\d+)?)s?\]\s*(?:\(([^)]+)\)\s*)?(.*)$/,
  );
  if (secondsMatch) {
    return {
      ...previousLine,
      time: Number(parseFloat(secondsMatch[1]).toFixed(2)),
      chord: secondsMatch[2]?.trim() || previousLine.chord,
      text: secondsMatch[3].trim(),
    };
  }

  const chordMatch = line.match(/^\[([A-G][#b]?[^\]]*)\]\s*(.*)$/);
  return {
    ...previousLine,
    chord: chordMatch?.[1]?.trim() || previousLine.chord,
    text: chordMatch ? chordMatch[2].trim() : line,
  };
};

export default function AiAnalyzerPage() {
  const [activeTab, setActiveTab] = useState("ai"); // 'ai' | 'manual'
  const [aiSourceMode, setAiSourceMode] = useState("audio"); // 'audio' | 'youtube'
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // State chế độ AI
  const [videoUrl, setVideoUrl] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [audioTrackTitle, setAudioTrackTitle] = useState("");
  const [audioTrackArtist, setAudioTrackArtist] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [editableLyrics, setEditableLyrics] = useState("");
  const [aiAudioUrl, setAiAudioUrl] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultSource, setAiResultSource] = useState("");
  const [aiResultVideoId, setAiResultVideoId] = useState("");
  const [aiCurrentTime, setAiCurrentTime] = useState(0);
  const aiAudioRef = useRef(null);
  const aiYoutubePlayerRef = useRef(null);

  // Thông tin để lưu kết quả AI thành bài hát
  const [aiSongTitle, setAiSongTitle] = useState("");
  const [aiSongArtist, setAiSongArtist] = useState("");
  const [aiSaving, setAiSaving] = useState(false);

  // State chế độ Tự soạn thủ công
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("Acoustic");
  const [key, setKey] = useState("C");
  const [vibeTag, setVibeTag] = useState("Chill & Share");
  const [lyrics, setLyrics] = useState("");
  const [manualCover, setManualCover] = useState(null);
  const [manualAudio, setManualAudio] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // 1. Phân tích AI từ File Audio Upload (Python AI + Cloudinary)
  const handleAnalyzeAudio = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Vui lòng đăng nhập để sử dụng công cụ AI phân tích nhạc!");
      return navigate("/login");
    }
    if (!audioFile) {
      alert("Vui lòng chọn 1 file âm thanh (MP3, WAV) trước nhé!");
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    setEditableLyrics("");
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("trackTitle", audioTrackTitle.trim());
      formData.append("artist", audioTrackArtist.trim());
      formData.append("lyricMode", "search");
      formData.append("qualityMode", "fast");

      const res = await API.post("/ai/from-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res.data.aiData;
      setAiResult(data);
      setAiResultSource("audio");
      setAiCurrentTime(0);
      setEditableLyrics(
        data?.lyricsChords ||
          data?.lyricsAi ||
          "",
      );
      setAiAudioUrl(res.data.audioUrl || "");
      setAiSongTitle(
        (currentTitle) =>
          currentTitle ||
          data?.detectedTitle ||
          audioTrackTitle.trim() ||
          audioFile.name.replace(/\.[^/.]+$/, ""),
      );
      if (audioTrackArtist.trim()) {
        setAiSongArtist((currentArtist) => currentArtist || audioTrackArtist.trim());
      }
    } catch (err) {
      alert(
        err.response?.data?.message || "Lỗi phân tích file âm thanh từ AI.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  // 2. Phân tích AI từ YouTube URL
  const handleAnalyzeYoutube = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Vui lòng đăng nhập để sử dụng công cụ AI phân tích nhạc!");
      return navigate("/login");
    }

    setAiLoading(true);
    setAiResult(null);
    setEditableLyrics("");
    setAiAudioUrl("");
    try {
      const res = await API.post("/ai/from-youtube", { videoUrl });
      const data = res.data.data;
      setAiResult(data);
      setAiResultSource("youtube");
      setAiResultVideoId(extractYoutubeId(videoUrl));
      setAiCurrentTime(0);
      setEditableLyrics(
        data?.lyricsChords ||
          data?.lyricsAi ||
          JSON.stringify(data?.chordsAi || [], null, 2),
      );
      if (!aiSongTitle && data?.detectedTitle) {
        setAiSongTitle(data.detectedTitle);
      } else if (!aiSongTitle) {
        setAiSongTitle("YouTube AI Chord Sheet");
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Không thể phân tích link YouTube. Hãy kiểm tra lại Backend.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  // 3. Lưu kết quả phân tích AI vào MongoDB & mở trang Đàn Guitar
  const handleSaveAiSong = async () => {
    if (!user) {
      alert("Vui lòng đăng nhập để lưu bài hát!");
      return navigate("/login");
    }
    if (!aiResult) return;

    setAiSaving(true);
    try {
      const editedLines = editableLyrics
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const updatedTimeline = Array.isArray(aiResult.timeline)
        ? aiResult.timeline.map((item, idx) => {
            if (!editedLines[idx]) return item;
            return parseEditedTimelineLine(editedLines[idx], item);
          })
        : [];

      const payload = {
        title: aiSongTitle.trim() || "AI Transcribed Song",
        artist: aiSongArtist.trim() || "AI Studio",
        genre: "Acoustic",
        key: aiResult.chordsAi?.[0]?.chord || "C",
        audioPath: aiAudioUrl || "",
        youtubeId:
          aiResultSource === "youtube" ? aiResultVideoId : undefined,
        chordsAi: aiResult.chordsAi || [],
        timeline: updatedTimeline,
        lyricsChords: editableLyrics || aiResult.lyricsChords || aiResult.lyricsAi || "",
        lyricsAi: editableLyrics || aiResult.lyricsAi || "",
        lyricAlign: "left",
        type: "generated",
        vibeTag: "Góc AI Sáng Tác",
      };

      const res = await API.post("/songs", payload);
      if (res.data.data?._id) {
        navigate(`/songs/${res.data.data._id}`);
      }
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Lỗi khi lưu bản phân tích AI.",
      );
    } finally {
      setAiSaving(false);
    }
  };

  // 4. Lưu bài hát tự soạn thủ công (Hỗ trợ kèm Cover & Audio lên Cloudinary)
  const handleCreateManualSong = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Vui lòng đăng nhập để lưu bản hợp âm của bạn!");
      return navigate("/login");
    }

    setSaveLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("artist", artist || "Songhomie Member");
      formData.append("genre", genre);
      formData.append("key", key);
      formData.append("vibeTag", vibeTag);
      formData.append("lyricsChords", lyrics);
      formData.append("type", "shared");

      if (manualCover) formData.append("cover", manualCover);
      if (manualAudio) formData.append("audio", manualAudio);

      const res = await API.post("/songs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.data?._id) {
        navigate(`/songs/${res.data.data._id}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Không thể lưu bản hợp âm.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSeekToAiLine = (line) => {
    const time = Number(line.time) || 0;
    setAiCurrentTime(time);
    if (aiResultSource === "youtube") {
      aiYoutubePlayerRef.current?.seekTo(time);
      aiYoutubePlayerRef.current?.play();
    } else if (aiAudioRef.current) {
      aiAudioRef.current.currentTime = time;
      aiAudioRef.current.play().catch(() => {});
    }
  };

  const activeAiTimelineIndex = Array.isArray(aiResult?.timeline)
    ? aiResult.timeline.reduce(
        (activeIndex, line, index) =>
          aiCurrentTime >= Number(line.time) ? index : activeIndex,
        0,
      )
    : -1;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
      {/* --- HEADER --- */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
          <Sparkles className="w-3.5 h-3.5" /> AI Chord & Lyric Assistant
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Tạo & Bóc Tách Hợp Âm Thông Minh
        </h1>
        <p className="text-slate-500 text-sm">
          Tải file nhạc lên để AI tự động nhận diện hợp âm, hoặc tự soạn bản đệm
          hát để chia sẻ cùng bạn bè.
        </p>
      </div>

      {/* --- MODE SWITCHER TABS --- */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl max-w-md mx-auto shadow-inner text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "ai"
              ? "bg-white text-indigo-600 shadow-md"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🤖 AI Auto Extract</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "manual"
              ? "bg-white text-indigo-600 shadow-md"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>✍️ Tự Soạn Nhanh</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: AI AUTO EXTRACT (FILE AUDIO CLOUDINARY + YOUTUBE)              */}
      {/* ===================================================================== */}
      {activeTab === "ai" && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          {/* Chọn nguồn đầu vào cho AI */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Bóc tách hợp âm tự động bằng AI
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Hỗ trợ tải file âm thanh trực tiếp (đồng bộ cần đàn Guitar) hoặc
                dán link YouTube.
              </p>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => setAiSourceMode("audio")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition cursor-pointer disabled:opacity-50 ${
                  aiSourceMode === "audio"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> File Audio
              </button>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => setAiSourceMode("youtube")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition cursor-pointer disabled:opacity-50 ${
                  aiSourceMode === "youtube"
                    ? "bg-rose-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Video className="w-3.5 h-3.5" /> YouTube URL
              </button>
            </div>
          </div>

          {/* Form 1A: Upload File Audio */}
          {aiSourceMode === "audio" ? (
            <form onSubmit={handleAnalyzeAudio} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={audioTrackTitle}
                  onChange={(e) => setAudioTrackTitle(e.target.value)}
                  disabled={aiLoading}
                  placeholder="Tên bài hát (để tìm lời đồng bộ)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <input
                  type="text"
                  value={audioTrackArtist}
                  onChange={(e) => setAudioTrackArtist(e.target.value)}
                  disabled={aiLoading}
                  placeholder="Ca sĩ (không bắt buộc)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl bg-slate-50/70 cursor-pointer transition text-center">
                <Music className="w-10 h-10 text-indigo-500 mb-2" />
                <span className="text-sm font-bold text-slate-700">
                  {audioFile
                    ? `Đã chọn: ${audioFile.name}`
                    : "Bấm để chọn file âm thanh (MP3, WAV, OGG - Tối đa 25MB)"}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  AI tìm lời đồng bộ theo tên bài trước, sau đó tự nghe file nếu
                  chưa tìm thấy; mốc thời gian lấy từ chính file này.
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  disabled={aiLoading}
                  onChange={(e) => setAudioFile(e.target.files[0])}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={aiLoading}
                className="w-full py-4 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-80 text-sm flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {aiLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>AI đang phân tích bạn chờ chút nhé :&lt;&lt;</span>
                  </>
                ) : (
                  <span>Bắt đầu phân tích File Nhạc</span>
                )}
              </button>
            </form>
          ) : (
            /* Form 1B: Dán Link YouTube */
            <form onSubmit={handleAnalyzeYoutube} className="space-y-4">
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                disabled={aiLoading}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm disabled:opacity-60"
                required
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="w-full py-4 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-80 text-sm flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {aiLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>AI đang phân tích bạn chờ chút nhé :&lt;&lt;</span>
                  </>
                ) : (
                  <span>Bắt đầu phân tích YouTube</span>
                )}
              </button>
            </form>
          )}

          {/* Khung hoạt ảnh loading trực quan để người dùng biết hệ thống đang chạy */}
          {aiLoading && (
            <div className="p-6 rounded-2xl bg-linear-to-br from-indigo-50 via-purple-50 to-sky-50 border border-indigo-200/80 flex flex-col items-center text-center space-y-3.5 shadow-inner">
              <div className="flex items-end justify-center gap-1.5 h-9">
                <span className="w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s] h-4" />
                <span className="w-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s] h-7" />
                <span className="w-1.5 bg-sky-500 rounded-full animate-bounce h-9" />
                <span className="w-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s] h-6" />
                <span className="w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s] h-4" />
              </div>

              <div className="space-y-1">
                <p className="text-base font-extrabold text-indigo-900">
                  AI đang phân tích bạn chờ chút nhé :&lt;&lt;
                </p>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  {aiSourceMode === "youtube"
                    ? "Đang tải âm thanh từ YouTube, nhận diện hợp âm Guitar và đồng bộ lời bài hát..."
                    : "Đang quét hợp âm theo từng nhịp, đồng bộ lời bài hát và tải file lên Cloudinary..."}
                </p>
              </div>

              <div className="w-full max-w-xs h-1.5 bg-indigo-200/70 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-linear-to-r from-indigo-500 via-purple-500 to-sky-500 rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Hiển thị kết quả AI + Form lưu sang màn hình Đàn Guitar */}
          {aiResult && (
            <div className="pt-6 border-t border-slate-100 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">
                    ✨ Kết quả bóc tách từ AI
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bạn có thể bấm trực tiếp vào khung dưới để chỉnh sửa nếu cần
                    trước khi lưu.
                  </p>
                </div>
                {aiAudioUrl && (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    ✓ Đã lưu audio trên Cloudinary
                  </span>
                )}
              </div>

                {aiResult.lyricsWarning && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Chưa nhận diện được lời: {aiResult.lyricsWarning}
                  </p>
                )}
                {aiResult.audioWarning && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {aiResult.audioWarning}
                  </p>
                )}

              {aiResultSource === "youtube" && aiResultVideoId ? (
                <YouTubePlayer
                  ref={aiYoutubePlayerRef}
                  videoId={aiResultVideoId}
                  onTimeUpdate={setAiCurrentTime}
                />
              ) : aiAudioUrl ? (
                <audio
                  ref={aiAudioRef}
                  controls
                  src={aiAudioUrl}
                  onTimeUpdate={(event) => setAiCurrentTime(event.target.currentTime)}
                  className="w-full h-10"
                />
              ) : null}

              {Array.isArray(aiResult.timeline) && aiResult.timeline.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-600">
                    Bấm một dòng để phát đúng mốc lời và hợp âm:
                  </p>
                  {aiResult.timeline.map((line, index) => (
                    <button
                      key={`${line.time}-${index}`}
                      type="button"
                      onClick={() => handleSeekToAiLine(line)}
                      className={`flex w-full items-start gap-2 rounded-xl border p-2.5 text-left text-sm transition ${
                        index === activeAiTimelineIndex
                          ? "border-sky-300 bg-sky-100 text-slate-900"
                          : "border-transparent bg-white text-slate-600 hover:border-slate-200"
                      }`}
                    >
                      <span className="shrink-0 font-mono text-xs text-slate-400">
                        {line.isInstrumental
                          ? `${formatTime(line.time)} - ${formatTime(line.end)}`
                          : formatTime(line.time)}
                      </span>
                      <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-sky-300">
                        {line.chord}
                      </span>
                      <span>{line.text}</span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                rows={10}
                value={editableLyrics}
                onChange={(e) => setEditableLyrics(e.target.value)}
                className="w-full bg-slate-950 text-emerald-400 p-6 rounded-2xl font-mono text-sm leading-relaxed border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />

              <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-5 space-y-4">
                <p className="text-xs font-bold text-sky-900">
                  Lưu bản phân tích này vào thư viện để luyện tập cùng cần đàn
                  Guitar đồng bộ:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={aiSongTitle}
                    onChange={(e) => setAiSongTitle(e.target.value)}
                    placeholder="Đặt tên bài hát *"
                    className="px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    value={aiSongArtist}
                    onChange={(e) => setAiSongArtist(e.target.value)}
                    placeholder="Tên ca sĩ / tác giả"
                    className="px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAiSong}
                  disabled={aiSaving}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-sky-500 hover:text-slate-950 text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Guitar className="w-4 h-4" />
                  {aiSaving ? "Đang lưu..." : "Lưu & Mở Trình Tập Đàn Guitar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: TỰ SOẠN NHANH (KÈM LIÊN KẾT SANG SONG PRODUCER NÂNG CAO)       */}
      {/* ===================================================================== */}
      {activeTab === "manual" && (
        <form
          onSubmit={handleCreateManualSong}
          className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Soạn Chord Sheet Nhanh
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Đặt hợp âm trong ngoặc vuông như{" "}
                <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-bold">
                  [C]
                </code>{" "}
                để đàn Guitar tự nhận diện thế bấm.
              </p>
            </div>

            <Link
              to="/producer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" /> Mở Studio Căn lề & Tô sáng
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tên bài hát *
              </label>
              <input
                type="text"
                placeholder="VD: Nàng Thơ"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ca sĩ / Người chia sẻ
              </label>
              <input
                type="text"
                placeholder="VD: Hoàng Dũng"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Thể loại & Tông chính
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  <option value="Acoustic">Acoustic</option>
                  <option value="Pop">Pop</option>
                  <option value="Ballad">Ballad</option>
                  <option value="Indie">Indie</option>
                </select>
                <input
                  type="text"
                  placeholder="Tông (VD: C, Am)"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Chủ đề giao lưu (Vibe)
              </label>
              <select
                value={vibeTag}
                onChange={(e) => setVibeTag(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
              >
                <option value="Chill & Share">☕ Chill & Share</option>
                <option value="Acoustic Cuối Tuần">
                  🎸 Acoustic Cuối Tuần
                </option>
                <option value="Hợp Âm Dễ Tập">🌱 Hợp Âm Dễ Tập</option>
                <option value="Góc AI Sáng Tác">🤖 Góc AI Sáng Tác</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer hover:border-indigo-400">
              <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">
                {manualCover
                  ? `Ảnh bìa: ${manualCover.name}`
                  : "Đính kèm ảnh bìa (Tùy chọn)"}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setManualCover(e.target.files[0])}
                className="hidden"
              />
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer hover:border-indigo-400">
              <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">
                {manualAudio
                  ? `File nhạc: ${manualAudio.name}`
                  : "Đính kèm bản thu MP3/WAV (Tùy chọn)"}
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setManualAudio(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Lời bài hát & Hợp âm *
            </label>
            <textarea
              rows="10"
              placeholder="[C] Em hát câu ca [G] mùa hạ&#10;[Am] Nắng vương trên đôi [F] bờ vai..."
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              className="w-full p-4 bg-slate-950 text-emerald-400 font-mono text-sm border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 leading-relaxed"
              required
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={saveLoading}
            className="w-full py-4 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saveLoading
              ? "Đang lưu & tải lên Cloudinary..."
              : "Lưu & Mở Trình Phát Đàn Guitar"}
          </button>
        </form>
      )}
    </div>
  );
}