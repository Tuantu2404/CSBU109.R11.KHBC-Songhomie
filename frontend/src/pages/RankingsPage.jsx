import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Guitar, Music, Sparkles, PlusCircle } from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';

const VIBE_TABS = [
  { id: 'All', label: '✨ Tất cả giai điệu' },
  { id: 'Chill & Share', label: '☕ Chill & Share' },
  { id: 'Acoustic Cuối Tuần', label: '🎸 Acoustic Cuối Tuần' },
  { id: 'Hợp Âm Dễ Tập', label: '🌱 Hợp Âm Dễ Tập' },
  { id: 'Góc AI Sáng Tác', label: '🤖 Góc AI Sáng Tác' },
];

export default function RankingsPage() {
  const { user } = useContext(AuthContext);
  const [songs, setSongs] = useState([]);
  const [selectedVibe, setSelectedVibe] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommunityVibes = async () => {
      try {
        // Lấy danh sách bài hát kèm vibeTag & reactions tích cực
        const res = await API.get('/songs');
        if (res.data?.data?.length > 0) {
          setSongs(res.data.data);
        } else {
          // Dự phòng endpoint cũ nếu cần
          const fallbackRes = await API.get('/rankings/top-chords');
          setSongs(fallbackRes.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch community songs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCommunityVibes();
  }, []);

  // Thả cảm xúc cổ vũ tích cực ngay tại danh sách
  const handleReaction = async (songId, reactionType) => {
    if (!user) {
      alert('Vui lòng đăng nhập để gửi lời cổ vũ tới bạn bè nhé!');
      return;
    }
    try {
      const res = await API.post(`/songs/${songId}/react`, { reactionType });
      setSongs((prev) =>
        prev.map((s) => (s._id === songId ? { ...s, reactions: res.data.data } : s))
      );
    } catch (err) {
      console.error('Lỗi thả cảm xúc:', err);
    }
  };

  // Tính tổng lượt cổ vũ tích cực để gợi ý các bài truyền cảm hứng
  const getVibePoints = (song) => {
    const claps = song.reactions?.clap?.length || 0;
    const guitars = song.reactions?.guitar?.length || 0;
    const hearts = song.reactions?.heart?.length || 0;
    return claps + guitars + hearts;
  };

  const displayedSongs = songs
    .filter((song) => selectedVibe === 'All' || song.vibeTag === selectedVibe)
    .sort((a, b) => getVibePoints(b) - getVibePoints(a));

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* --- HEADER TÍCH CỰC --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Music Hobbies & Good Vibes Only
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            🎶 Giai Điệu Truyền Cảm Hứng
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Không chạy đua thứ hạng — cùng khám phá các bản hợp âm dễ tập, bản phối AI thú vị và gửi lời cổ vũ cho nhau.
          </p>
        </div>

        <Link
          to="/producer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-sky-500 hover:text-slate-950 text-white text-xs font-bold transition shrink-0 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" /> Chia sẻ bản hợp âm
        </Link>
      </div>

      {/* --- BỘ LỌC THEO CHỦ ĐỀ SỞ THÍCH --- */}
      <div className="flex flex-wrap gap-2">
        {VIBE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedVibe(tab.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              selectedVibe === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- DANH SÁCH GIAI ĐIỆU CỘNG ĐỒNG --- */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 font-medium">
          Đang tải không gian giai điệu...
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-800">
              ✨ Góc Chia Sẻ Đam Mê ({displayedSongs.length} bài hát)
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              Bấm vào bài hát để mở cần đàn Guitar
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {displayedSongs.length > 0 ? (
              displayedSongs.map((song) => {
                const claps = song.reactions?.clap?.length || 0;
                const guitars = song.reactions?.guitar?.length || 0;
                const hearts = song.reactions?.heart?.length || 0;

                return (
                  <div
                    key={song._id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition"
                  >
                    {/* Thông tin bài hát (Thay số thứ hạng #1, #2 bằng icon/ảnh bìa thân thiện) */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-sky-400 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                        {song.coverUrl ? (
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/songs/${song._id}`}
                            className="font-extrabold text-slate-900 hover:text-sky-600 transition truncate"
                          >
                            {song.title || 'Untitled Song'}
                          </Link>
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 text-[11px] font-bold">
                            {song.vibeTag || 'Chill & Share'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 mt-1 truncate">
                          Artist: <span className="font-semibold text-slate-700">{song.artist || 'Various Artists'}</span>{' '}
                          • Genre: {song.genre || 'Acoustic'} • 🎧 {song.views || 0} lượt tập
                        </p>
                      </div>
                    </div>

                    {/* Nút thả cảm xúc cổ vũ & Nút mở đàn Guitar */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReaction(song._id, 'clap')}
                        title="Vỗ tay cổ vũ"
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        👏 {claps}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReaction(song._id, 'guitar')}
                        title="Hợp âm hay"
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        🎸 {guitars}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReaction(song._id, 'heart')}
                        title="Truyền cảm hứng"
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        ❤️ {hearts}
                      </button>

                      <Link
                        to={`/songs/${song._id}`}
                        className="inline-flex items-center gap-1.5 ml-1 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-sky-400 text-indigo-700 hover:text-slate-950 text-xs font-extrabold transition"
                      >
                        <Guitar className="w-3.5 h-3.5" /> Mở đàn
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-10 text-center text-slate-400 text-sm">
                Chưa có bài hát nào trong chủ đề này. Hãy là người đầu tiên chia sẻ nhé!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}