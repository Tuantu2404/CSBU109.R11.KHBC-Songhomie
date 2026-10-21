import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Maximize2,
  Minimize2,
  Music,
  ArrowLeft,
  Volume2,
} from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import GuitarFretboard from '../components/GuitarFretboard';

// Bảng 12 nốt phục vụ tính năng đổi tông (Transpose Key)
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

// Hàm dịch tông một hợp âm bất kỳ (VD: Am + 2 -> Bm)
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

export default function SongDetailPage() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);

  const audioRef = useRef(null);
  const lyricsBoxRef = useRef(null);

  const [song, setSong] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // Các state điều khiển tính năng tương tác
  const [keyTranspose, setKeyTranspose] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedChord, setSelectedChord] = useState('C');

  useEffect(() => {
    const fetchSongAndComments = async () => {
      try {
        const songRes = await API.get(`/songs/${id}`);
        const songData = songRes.data.data;
        setSong(songData);

        // Khởi tạo hợp âm ban đầu cho cần đàn Guitar
        const initialChord =
          songData?.timeline?.[0]?.chord ||
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

  // Xử lý Auto Scroll mượt mà bên trong khung lời bài hát
  useEffect(() => {
    let interval;
    if (isScrolling) {
      interval = setInterval(() => {
        if (lyricsBoxRef.current) {
          lyricsBoxRef.current.scrollBy({ top: 1, behavior: 'smooth' });
        } else {
          window.scrollBy({ top: 1, behavior: 'smooth' });
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isScrolling]);

  // Đồng bộ hợp âm trên cần đàn Guitar theo thời gian nhạc đang phát (Timeline / AI Chords)
  const hasTimeline = song?.timeline && song.timeline.length > 0;
  const activeTimelineIndex = hasTimeline
    ? song.timeline.reduce((acc, item, idx) => (currentTime >= item.time ? idx : acc), 0)
    : -1;

  useEffect(() => {
    if (hasTimeline && activeTimelineIndex >= 0) {
      const currentChord = song.timeline[activeTimelineIndex]?.chord;
      if (currentChord) setSelectedChord(currentChord);
    } else if (song?.chordsAi?.length > 0 && currentTime > 0) {
      const activeAi = song.chordsAi.reduce(
        (acc, item) => (currentTime >= item.time ? item.chord : acc),
        song.chordsAi[0].chord
      );
      if (activeAi) setSelectedChord(activeAi);
    }
  }, [activeTimelineIndex, hasTimeline, currentTime, song]);

  // Tua nhạc đến đúng giây khi bấm vào 1 câu hát trong Timeline
  const handleSeekToLine = (time, chord) => {
    if (chord) setSelectedChord(chord);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
    }
  };

  // Thả cảm xúc tích cực (👏 clap | 🎸 guitar | ❤️ heart)
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

  // Đăng bình luận cộng đồng
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await API.post(`/comments/song/${id}`, { content: newComment });
      setComments([res.data.data, ...comments]);
      setNewComment('');
    } catch (err) {
      alert('Không thể gửi bình luận. Vui lòng đăng nhập lại.');
    }
  };

  // Render lời bài hát từ Song Producer (hỗ trợ Highlight, Transpose & click chọn hợp âm)
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

            // Nhận diện hợp âm dạng [C], [Am], [F#m7]...
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
                        onClick={() => setSelectedChord(rawChord)}
                        title={`Xem thế bấm ${transposed} trên đàn Guitar`}
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

  // Hỗ trợ cả tên trường cũ (lyrics) và mới (lyricsChords / lyricsAi)
  const rawLyrics = song.lyricsChords || song.lyrics || song.lyricsAi || '';
  const alignClass =
    song.lyricAlign === 'center'
      ? 'text-center'
      : song.lyricAlign === 'right'
      ? 'text-right'
      : 'text-left';

  // Hợp âm hiển thị trên cần đàn đã được dịch tông theo keyTranspose
  const displayChordOnGuitar = transposeChord(selectedChord, keyTranspose);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      {/* Nút quay lại */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách bài hát
        </Link>
      </div>

      {/* ===================================================================== */}
      {/* KHU VỰC CHÍNH 2 CỘT ĐÚNG BẢN PHÁC THẢO (TRÁI: NHẠC | PHẢI: LỜI & ĐÀN) */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* --- CỘT TRÁI: THÔNG TIN BÀI HÁT, CLOUDINARY AUDIO & TOOLBAR --- */}
        {!isExpanded && (
          <div className="lg:col-span-5 bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Ảnh bìa từ Cloudinary */}
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

              {/* Thẻ chủ đề & Lượt xem */}
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

              {/* Tiêu đề & Ca sĩ */}
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                  {song.title}
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Artist:{' '}
                  <span className="text-slate-800 font-bold">
                    {song.artist || 'Various Artists'}
                  </span>{' '}
                  • Genre: {song.genre || 'Acoustic'}
                </p>
              </div>

              {/* Trình phát nhạc Audio từ Cloudinary */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl border border-slate-800 space-y-2">
                {song.audioPath ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-sky-300 font-semibold">
                      <Volume2 className="w-4 h-4" /> Trình phát đồng bộ hợp âm
                    </div>
                    <audio
                      ref={audioRef}
                      controls
                      src={song.audioPath}
                      onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                      className="w-full h-9 accent-sky-400"
                    />
                  </>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-1">
                    Bản Chord Sheet — Bấm vào các nút hợp âm bên phải để xem thế bấm trên đàn Guitar.
                  </p>
                )}
              </div>

              {/* Công cụ Transpose Key & Auto Scroll */}
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
                  onClick={() => setIsScrolling(!isScrolling)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isScrolling
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isScrolling ? '⏸ Dừng cuộn' : '📜 Tự động cuộn'}
                </button>
              </div>
            </div>

            {/* Cảm xúc cổ vũ tích cực (Không cạnh tranh/tiêu cực) */}
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

        {/* --- CỘT PHẢI: KHUNG "LỜI BÀI HÁT" + HỘP "ĐÀN GHI TA" GÓC TRÊN PHẢI --- */}
        <div
          className={`${
            isExpanded ? 'lg:col-span-12' : 'lg:col-span-7'
          } bg-slate-950 text-slate-100 p-6 md:p-7 rounded-3xl border border-slate-800 shadow-xl flex flex-col transition-all duration-300`}
        >
          {/* Thanh tiêu đề Lời bài hát & Nút Mở rộng */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-extrabold text-white">Lời bài hát & Hợp âm</h2>
              <p className="text-xs text-slate-400">
                Điểm sáng xanh nhạt trên cần đàn tự động hiển thị thế bấm tương ứng
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

          {/* Nội dung Lời bài hát bao quanh Hộp Đàn Guitar ở góc trên bên phải */}
          <div
            ref={lyricsBoxRef}
            className="flex-1 overflow-y-auto max-h-140 mt-5 pr-1"
          >
            {/* HỘP ĐÀN GUITAR NỔI GÓC TRÊN BÊN PHẢI (ĐÚNG VỊ TRÍ BẢN PHÁC THẢO) */}
            <div className="w-full sm:w-48 sm:float-right sm:ml-5 mb-4">
              <GuitarFretboard chord={displayChordOnGuitar} />
            </div>

            {/* Chế độ 1: Nếu có Timeline đồng bộ theo giây nhạc */}
            {hasTimeline ? (
              <div className="space-y-2.5">
                {song.timeline.map((line, index) => {
                  const isActive = index === activeTimelineIndex;
                  const lineChord = transposeChord(line.chord, keyTranspose);

                  return (
                    <div
                      key={index}
                      onClick={() => handleSeekToLine(line.time, line.chord)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-sky-500/15 border-sky-400/50 text-white shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                          : 'bg-slate-900/50 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono text-slate-500">
                          {Math.floor(line.time / 60)}:
                          {String(Math.floor(line.time % 60)).padStart(2, '0')}
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
              /* Chế độ 2: Hiển thị Lời & Hợp âm đã căn lề / tô sáng từ Song Producer */
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

      {/* ===================================================================== */}
      {/* KHU VỰC BÌNH LUẬN CỘNG ĐỒNG (GIỮ NGUYÊN TỪ BẢN CŨ)                    */}
      {/* ===================================================================== */}
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition cursor-pointer"
            >
              Gửi
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
                  {comment.user_id?.username || comment.user?.username || 'User'}
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