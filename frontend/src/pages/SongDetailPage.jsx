import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Maximize2,
  Minimize2,
  Music,
  ArrowLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import GuitarFretboard, { playGuitarChordSound } from '../components/GuitarFretboard';
import YouTubePlayer from '../components/YouTubePlayer';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

function transposeChord(chord, semitones) {
  if (!chord || semitones === 0) return chord;
  const match = chord.trim().match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  let [, root, suffix] = match;
  if (FLAT_TO_SHARP[root]) root = FLAT_TO_SHARP[root];

  const idx = NOTES.indexOf(root);
  if (idx === -1) return chord;

  const newIdx = (idx + (semitones % 12) + 12) % 12;
  return `${NOTES[newIdx]}${suffix}`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

// Chuẩn hóa lại các dòng timeline nếu bài cũ bị lưu nhầm timestamp vào cột chord
function normalizeSongTimeline(timeline = []) {
  if (!Array.isArray(timeline)) return [];
  return timeline.map((item, idx) => {
    let chord = String(item.chord || '').trim();
    let text = String(item.text || '').trim();
    let time = Number(item.time);

    // Nếu chord bị lưu nhầm dạng "01:01.24" và text có dạng "(C#m) Yeh yeh yeh"
    const timeAsChord = chord.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (timeAsChord) {
      if (Number.isNaN(time) || time === idx * 4) {
        time = Number(
          (parseInt(timeAsChord[1], 10) * 60 + parseFloat(timeAsChord[2])).toFixed(2),
        );
      }
      const embeddedChord = text.match(/^\(([A-G][#b]?[^)]*)\)\s*(.*)$/);
      if (embeddedChord) {
        chord = embeddedChord[1].trim();
        text = embeddedChord[2].trim();
      } else {
        chord = 'C';
      }
    }

    return {
      ...item,
      time: Number.isNaN(time) ? idx * 4 : time,
      chord: chord || 'C',
      text,
    };
  });
}

export default function SongDetailPage() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const lastPlayedIndexRef = useRef(-1);
  const fetchedSongIdRef = useRef(null);

  const [song, setSong] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // State điều khiển tính năng tương tác
  const [keyTranspose, setKeyTranspose] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedChord, setSelectedChord] = useState('C');
  const [synthEnabled, setSynthEnabled] = useState(true);
  const [strumTrigger, setStrumTrigger] = useState(0);

  useEffect(() => {
    // Ngăn React StrictMode gọi API GET /songs/:id 2 lần liên tiếp (tránh nhảy +2 views)
    if (fetchedSongIdRef.current === id) return;
    fetchedSongIdRef.current = id;

    const fetchSongAndComments = async () => {
      try {
        const songRes = await API.get(`/songs/${id}`);
        const rawSong = songRes.data.data;
        const cleanTimeline = normalizeSongTimeline(rawSong?.timeline);
        const songData = { ...rawSong, timeline: cleanTimeline };
        setSong(songData);

        const initialChord =
          cleanTimeline[0]?.chord ||
          songData?.chordsAi?.[0]?.chord ||
          songData?.key?.replace(/\s*Major/i, '') ||
          'C';
        setSelectedChord(initialChord);

        const commentRes = await API.get(`/comments/song/${id}`);
        setComments(commentRes.data.data || []);
      } catch (err) {
        console.error('Error fetching song detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSongAndComments();
  }, [id]);

  const hasTimeline = Array.isArray(song?.timeline) && song.timeline.length > 0;
  const maxTimelineTime = hasTimeline
    ? Number(song.timeline[song.timeline.length - 1]?.time || 0) + 3
    : 0;

  // Chỉ mô phỏng thời gian cho chord sheet không có audio/video.
  useEffect(() => {
    if (!isPlaying || song?.audioPath || song?.youtubeId) return;

    const interval = setInterval(() => {
      const next = Number((currentTime + 0.1).toFixed(1));
      if (next >= maxTimelineTime) {
        setCurrentTime(0);
        setIsPlaying(false);
        lastPlayedIndexRef.current = -1;
      } else {
        setCurrentTime(next);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentTime, isPlaying, song?.audioPath, song?.youtubeId, hasTimeline, maxTimelineTime]);

  // 2. Xác định dòng hợp âm đang kích hoạt theo currentTime
  const activeTimelineIndex = hasTimeline
    ? song.timeline.reduce((acc, item, idx) => (currentTime >= Number(item.time) ? idx : acc), 0)
    : -1;

  // 3. Đổi thế bấm trên cần đàn + tự động gảy tiếng đàn khi chuyển dòng lúc đang chạy tự động
  useEffect(() => {
    if (hasTimeline && activeTimelineIndex >= 0) {
      const currentChord = song.timeline[activeTimelineIndex]?.chord;
      if (currentChord) setSelectedChord(currentChord);

      if (isPlaying) {
        // Gảy tiếng đàn Guitar mỗi khi bước sang dòng hợp âm mới (nếu bài không có MP3 gốc)
        if (
          !song?.audioPath &&
          !song?.youtubeId &&
          synthEnabled &&
          lastPlayedIndexRef.current !== activeTimelineIndex
        ) {
          lastPlayedIndexRef.current = activeTimelineIndex;
          setStrumTrigger((prev) => prev + 1);
        }
      }
    } else if (song?.chordsAi?.length > 0 && currentTime > 0) {
      const activeAi = song.chordsAi.reduce(
        (acc, item) => (currentTime >= Number(item.time) ? item.chord : acc),
        song.chordsAi[0].chord,
      );
      if (activeAi) setSelectedChord(activeAi);
    }
  }, [activeTimelineIndex, hasTimeline, currentTime, song, isPlaying, synthEnabled]);

  const handleTogglePlayback = () => {
    if (song?.youtubeId && youtubePlayerRef.current) {
      if (youtubePlayerRef.current.getState() === 1) {
        youtubePlayerRef.current.pause();
      } else {
        youtubePlayerRef.current.play();
      }
      return;
    }

    if (song?.audioPath && audioRef.current) {
      if (audioRef.current.paused) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
      return;
    }

    if (!isPlaying && synthEnabled && hasTimeline) {
      const idx = activeTimelineIndex >= 0 ? activeTimelineIndex : 0;
      const chordToPlay = transposeChord(
        song.timeline[idx]?.chord || selectedChord,
        keyTranspose,
      );
      lastPlayedIndexRef.current = idx;
      playGuitarChordSound(chordToPlay);
    } else {
      lastPlayedIndexRef.current = -1;
    }
    setIsPlaying((previous) => !previous);
  };

  const handleResetTimeline = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    lastPlayedIndexRef.current = -1;
    youtubePlayerRef.current?.pause();
    youtubePlayerRef.current?.seekTo(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleSeekToLine = (time, chord, index) => {
    const targetTime = Number(time) || 0;
    if (chord) {
      setSelectedChord(chord);
      if (!song?.audioPath && !song?.youtubeId && synthEnabled) {
        playGuitarChordSound(transposeChord(chord, keyTranspose));
      }
    }
    lastPlayedIndexRef.current = index;
    setCurrentTime(targetTime);

    if (song?.youtubeId && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(targetTime);
      youtubePlayerRef.current.play();
      setIsPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleDeleteSong = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa bài hát này không?')) return;
    try {
      await API.delete(`/songs/${id}`);
      window.alert('Đã xóa bài hát.');
      navigate('/');
    } catch (error) {
      window.alert(error.response?.data?.message || 'Không thể xóa bài hát.');
    }
  };

  const handleReaction = async (reactionType) => {
    if (!user) {
      alert('Vui lòng đăng nhập để gửi năng lượng tích cực nhé!');
      return;
    }
    try {
      const res = await API.post(`/songs/${id}/react`, { reactionType });
      setSong((prev) => ({ ...prev, reactions: res.data.data }));
    } catch (err) {
      console.error('Lỗi thả cảm xúc:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || commentLoading) return;

    setCommentLoading(true);
    try {
      const res = await API.post(`/comments/song/${id}`, { content: newComment });
      if (res.data?.data) {
        setComments((prev) => [res.data.data, ...prev]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Lỗi gửi bình luận:', err.response?.data || err);
      alert(
        err.response?.data?.message ||
          'Không thể gửi bình luận. Vui lòng thử lại.',
      );
    } finally {
      setCommentLoading(false);
    }
  };

  const renderFormattedLyrics = (rawText) => {
    if (!rawText) {
      return (
        <div className="text-slate-500 italic">
          Chưa có lời bài hát hoặc hợp âm cho bản nhạc này.
        </div>
      );
    }

    return rawText.split('\n').map((line, lineIdx) => {
      const parts = line.split(/(\[hl-(?:yellow|cyan|green)\].*?\[\/hl-(?:yellow|cyan|green)\])/g);

      return (
        <p key={lineIdx} className="min-h-7 leading-relaxed">
          {parts.map((part, idx) => {
            let hlClass = '';
            let content = part;

            if (part.startsWith('[hl-yellow]')) {
              hlClass = 'bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded';
              content = part.replace(/\[\/?hl-yellow\]/g, '');
            } else if (part.startsWith('[hl-cyan]')) {
              hlClass = 'bg-sky-400/20 text-sky-200 px-1.5 py-0.5 rounded';
              content = part.replace(/\[\/?hl-cyan\]/g, '');
            } else if (part.startsWith('[hl-green]')) {
              hlClass = 'bg-emerald-400/20 text-emerald-200 px-1.5 py-0.5 rounded italic';
              content = part.replace(/\[\/?hl-green\]/g, '');
            }

            const tokens = content.split(/(\[[A-G][#b]?m?(?:7|maj7|sus4|sus2|dim|aug)?\])/g);

            return (
              <span key={idx} className={hlClass}>
                {tokens.map((token, tIdx) => {
                  if (/^\[.+\]$/.test(token)) {
                    const rawChord = token.replace(/[\[\]]/g, '');
                    const transposed = transposeChord(rawChord, keyTranspose);

                    return (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => {
                          setSelectedChord(rawChord);
                          playGuitarChordSound(transposed);
                        }}
                        title={`Nghe & xem thế bấm ${transposed} trên đàn Guitar`}
                        className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-400 hover:text-slate-950 text-sky-300 font-bold text-xs border border-sky-400/40 transition cursor-pointer"
                      >
                        {transposed}
                      </button>
                    );
                  }
                  return <span key={tIdx}>{token}</span>;
                })}
              </span>
            );
          })}
        </p>
      );
    });
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-500 font-medium">
        Đang tải không gian âm nhạc...
      </div>
    );
  }

  if (!song) {
    return (
      <div className="text-center py-20 text-slate-500 font-medium">
        Không tìm thấy bài hát.
      </div>
    );
  }

  const rawLyrics = song.lyricsChords || song.lyrics || song.lyricsAi || '';
  const alignClass =
    song.lyricAlign === 'center'
      ? 'text-center'
      : song.lyricAlign === 'right'
      ? 'text-right'
      : 'text-left';

  const rawTransposed = transposeChord(selectedChord, keyTranspose);
  const safeChordMatch = String(rawTransposed || '').match(/^([A-G][#b]?m?)/);
  const displayChordOnGuitar = safeChordMatch ? safeChordMatch[1] : 'C';
  const songOwnerId = song.user?._id || song.user;
  const currentUserId = user?._id || user?.id;
  const isSongOwner = Boolean(currentUserId && String(songOwnerId) === String(currentUserId));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách bài hát
        </Link>
        {isSongOwner && (
          <button
            type="button"
            onClick={handleDeleteSong}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            title="Xóa bài hát của bạn"
          >
            <Trash2 className="h-4 w-4" /> Xóa bài hát
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* --- CỘT TRÁI --- */}
        {!isExpanded && (
          <div className="lg:col-span-5 bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center">
                {song.coverUrl ? (
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-500 gap-2">
                    <Music className="w-12 h-12 text-sky-400/70" />
                    <span className="text-xs font-medium">Songhomie Acoustic Sheet</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
                    {song.vibeTag || 'Chill & Share'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    Tông: {transposeChord(song.key?.replace(/\s*Major/i, '') || 'C', keyTranspose)}
                  </span>
                </div>
                <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                  👁️ {song.views || 0} Views
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                    {song.title}
                  </h1>
                  <p className="text-slate-500 text-sm font-medium mt-1">
                    Artist:{' '}
                    <span className="text-slate-800 font-bold">
                      {song.artist || 'Various Artists'}
                    </span>{' '}
                    - Genre: {song.genre || 'Acoustic'}
                  </p>
                </div>
              </div>

              {/* Trình phát video/audio đồng bộ với timeline */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl border border-slate-800 space-y-2">
                {song.youtubeId ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
                      <Volume2 className="w-4 h-4" /> Video YouTube đồng bộ lời & hợp âm
                    </div>
                    <YouTubePlayer
                      ref={youtubePlayerRef}
                      videoId={song.youtubeId}
                      onTimeUpdate={setCurrentTime}
                      onStateChange={setIsPlaying}
                    />
                  </>
                ) : song.audioPath ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
                      <Volume2 className="w-4 h-4" /> Trình phát đồng bộ hợp âm
                    </div>
                    <audio
                      ref={audioRef}
                      controls
                      src={song.audioPath}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                      className="w-full h-9 accent-sky-400"
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <p className="text-xs text-slate-300">
                      {isPlaying
                        ? `⏱️ Đang chạy hợp âm: ${formatTime(currentTime)}`
                        : 'Bản Chord Sheet — Phát để nghe tiếng đàn gảy theo nhịp.'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSynthEnabled((prev) => !prev)}
                        title={synthEnabled ? 'Tắt tiếng đàn đệm' : 'Bật tiếng đàn đệm'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          synthEnabled
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {synthEnabled ? (
                          <Volume2 className="w-3.5 h-3.5" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {currentTime > 0 && (
                        <button
                          type="button"
                          onClick={handleResetTimeline}
                          title="Đặt lại về 0:00"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> 0:00
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Công cụ Transpose Key & Playback */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Transpose:</span>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setKeyTranspose((prev) => prev - 1)}
                      className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-800 font-bold rounded-lg shadow-sm text-xs transition cursor-pointer"
                    >
                      -1
                    </button>
                    <span className="px-2 font-mono text-xs font-bold text-indigo-600">
                      {keyTranspose > 0 ? `+${keyTranspose}` : keyTranspose}
                    </span>
                    <button
                      type="button"
                      onClick={() => setKeyTranspose((prev) => prev + 1)}
                      className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-800 font-bold rounded-lg shadow-sm text-xs transition cursor-pointer"
                    >
                      +1
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTogglePlayback}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isPlaying
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isPlaying ? '⏸ Dừng phát' : '▶ Phát đồng bộ'}
                </button>
              </div>
            </div>

            {/* Cảm xúc cổ vũ tích cực */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-2">Gửi lời cổ vũ tích cực:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleReaction('clap')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  👏 Vỗ tay ({song.reactions?.clap?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => handleReaction('guitar')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  🎸 Hợp âm hay ({song.reactions?.guitar?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => handleReaction('heart')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  ❤️ Truyền cảm hứng ({song.reactions?.heart?.length || 0})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- CỘT PHẢI: LỜI BÀI HÁT & ĐÀN GUITAR --- */}
        <div
          className={`${
            isExpanded ? 'lg:col-span-12' : 'lg:col-span-7'
          } bg-slate-950 text-slate-100 p-6 md:p-7 rounded-3xl border border-slate-800 shadow-xl flex flex-col transition-all duration-300`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-extrabold text-white">Lời bài hát & Hợp âm</h2>
              <p className="text-xs text-slate-400">
                Điểm sáng xanh nhạt trên cần đàn tự động hiển thị thế bấm & phát tiếng tương ứng
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" /> Thu gọn khung
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" /> Mở rộng lời
                </>
              )}
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto max-h-140 mt-5 pr-1 relative"
          >
            {/* Hộp đàn Guitar ghim góc trên bên phải */}
            <div className="w-full sm:w-48 sm:float-right sm:sticky sm:top-0 z-10 sm:ml-5 mb-4">
              <GuitarFretboard
                chord={displayChordOnGuitar}
                autoPlayTrigger={strumTrigger}
              />
            </div>

            {hasTimeline ? (
              <div className="space-y-2.5">
                {song.timeline.map((line, index) => {
                  const isActive = index === activeTimelineIndex;
                  const lineChord = transposeChord(line.chord, keyTranspose);

                  return (
                    <div
                      key={index}
                      onClick={() => handleSeekToLine(line.time, line.chord, index)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-sky-500/15 border-sky-400/50 text-white shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                          : 'bg-slate-900/50 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono text-slate-500">
                          {formatTime(line.time)}
                        </span>
                        {lineChord && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              isActive
                                ? 'bg-sky-400 text-slate-950'
                                : 'bg-slate-800 text-sky-300'
                            }`}
                          >
                            {lineChord}
                          </span>
                        )}
                        <span
                          className={`${
                            isExpanded ? 'text-lg md:text-xl' : 'text-base'
                          } font-medium`}
                        >
                          {line.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`${alignClass} ${
                  isExpanded ? 'text-lg md:text-xl' : 'text-base'
                } font-mono text-slate-200 space-y-2`}
              >
                {renderFormattedLyrics(rawLyrics)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- KHU VỰC BÌNH LUẬN --- */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <h2 className="text-xl font-extrabold text-slate-900">
          💬 Góc Giao Lưu & Bình Luận ({comments.length})
        </h2>

        {user ? (
          <form onSubmit={handleAddComment} className="flex gap-3">
            <input
              type="text"
              placeholder="Chia sẻ cảm nhận tích cực hoặc gợi ý cách đệm đàn..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
            />
            <button
              type="submit"
              disabled={commentLoading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition cursor-pointer"
            >
              {commentLoading ? 'Đang gửi...' : 'Gửi'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Vui lòng đăng nhập để tham gia thảo luận cùng mọi người.
          </p>
        )}

        <div className="divide-y divide-slate-100">
          {comments.map((comment) => (
            <div key={comment._id} className="py-4 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">
                  {comment.user?.username || comment.user_id?.username || 'User'}
                </span>
                <span className="text-slate-400">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-slate-600">{comment.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}