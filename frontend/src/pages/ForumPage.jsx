import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Music,
  Send,
  Sparkles,
  Guitar,
  PlusCircle,
} from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { getForumCategoryLabel } from '../utils/categoryLabels';

const CATEGORIES = [
  'All',
  'Giao lưu Cover',
  'Chia sẻ Chord Sheet',
  'Hỏi đáp Kỹ thuật',
  'Góc AI Sáng tác',
];

export default function ForumPage() {
  const { user } = useContext(AuthContext);

  const [posts, setPosts] = useState([]);
  const [songs, setSongs] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // State tạo bài viết mới
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Giao lưu Cover');
  const [attachedSong, setAttachedSong] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // State nhập phản hồi cho từng bài viết
  const [replyTexts, setReplyTexts] = useState({});

  const fetchForumData = async () => {
    try {
      const [postRes, songRes] = await Promise.all([
        API.get('/forum', { params: { category: activeCategory } }),
        API.get('/songs'),
      ]);
      setPosts(postRes.data.data || []);
      setSongs(songRes.data.data || []);
    } catch (err) {
      console.error('Failed to load forum data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForumData();
  }, [activeCategory]);

  // Đăng bài chia sẻ mới
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const res = await API.post('/forum', {
        title,
        content,
        category,
        attachedSong: attachedSong || null,
      });
      setPosts([res.data.data, ...posts]);
      setTitle('');
      setContent('');
      setAttachedSong('');
      setShowCreateForm(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Please sign in to create a post.');
    } finally {
      setSubmitting(false);
    }
  };

  // Thả nút cổ vũ tích cực (Cheer)
  const handleCheer = async (postId) => {
    if (!user) {
      alert('Please sign in to cheer on the community.');
      return;
    }
    try {
      const res = await API.post(`/forum/${postId}/cheer`);
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, cheers: res.data.data } : p))
      );
    } catch (err) {
      console.error('Failed to send cheer:', err);
    }
  };

  // Gửi bình luận giao lưu
  const handleReply = async (e, postId) => {
    e.preventDefault();
    const text = replyTexts[postId];
    if (!text?.trim()) return;

    try {
      const res = await API.post(`/forum/${postId}/reply`, { content: text });
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, replies: res.data.data } : p))
      );
      setReplyTexts((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      alert('Please sign in to join the conversation.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Banner Header tích cực */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/15 text-sky-300 text-xs font-bold border border-sky-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Music & Guitar Community
          </span>
          <h1 className="text-2xl md:text-3xl font-black">
            Songhomie Community Forum
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Share casual covers, trade easy-to-play chord sheets, and encourage
            each other's love of music.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/producer"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold border border-slate-700 transition"
          >
            ✍️ Open Song Producer
          </Link>
          {user && (
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-extrabold transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              {showCreateForm ? 'Close post form' : 'Share a post'}
            </button>
          )}
        </div>
      </div>

      {/* Form đăng bài chia sẻ */}
      {showCreateForm && user && (
        <form
          onSubmit={handleCreatePost}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-extrabold text-slate-900">
            Create a Community Post
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title (e.g., I just learned the Canon chord progression...)"
              className="md:col-span-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
            >
              {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {getForumCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>

          <textarea
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a song story, your strumming pattern, or a question for the community..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <select
              value={attachedSong}
              onChange={(e) => setAttachedSong(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
            >
              <option value="">-- Attach a chord sheet or arrangement (optional) --</option>
              {songs.map((s) => (
                <option key={s._id} value={s._id}>
                  🎵 {s.title} ({s.artist})
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
            >
              {submitting ? 'Posting...' : 'Post to Forum'}
            </button>
          </div>
        </form>
      )}

      {/* Thanh lọc chuyên mục */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeCategory === cat
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat === 'All' ? '✨ All Topics' : getForumCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Danh sách bài đăng giao lưu */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Loading the community...
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
          <p className="text-slate-600 font-semibold">There are no posts in this category yet.</p>
          <p className="text-xs text-slate-400">
            Be the first to inspire the community!
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => {
            const hasCheered = user && post.cheers?.includes(user._id || user.id);

            return (
              <div
                key={post._id}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
              >
                {/* Tác giả & Chuyên mục */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 font-black flex items-center justify-center text-sm">
                      {(post.author?.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {post.author?.username || 'Songhomie Member'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(post.createdAt).toLocaleDateString('en-US')}
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                    {getForumCategoryLabel(post.category)}
                  </span>
                </div>

                {/* Tiêu đề & Nội dung */}
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{post.title}</h3>
                  <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Thẻ bài hát đính kèm -> Mở thẳng sang màn hình Đàn Guitar */}
                {post.attachedSong && (
                  <div className="bg-slate-950 text-slate-100 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
                        <Music className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {post.attachedSong.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {post.attachedSong.artist} • Key {post.attachedSong.key || 'C'}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/songs/${post.attachedSong._id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-extrabold transition"
                    >
                      <Guitar className="w-4 h-4" /> Open Guitar Player
                    </Link>
                  </div>
                )}

                {/* Thanh tương tác tích cực */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleCheer(post._id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      hasCheered
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-sky-50 text-slate-700'
                    }`}
                  >
                    🎶 Cheer ({post.cheers?.length || 0})
                  </button>

                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {post.replies?.length || 0} replies
                  </span>
                </div>

                {/* Khu vực phản hồi */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  {post.replies?.map((rep, idx) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <span className="font-bold text-slate-800">
                        {rep.user?.username || 'Member'}:{' '}
                      </span>
                      <span className="text-slate-600">{rep.content}</span>
                    </div>
                  ))}

                  {user && (
                    <form
                      onSubmit={(e) => handleReply(e, post._id)}
                      className="flex gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={replyTexts[post._id] || ''}
                        onChange={(e) =>
                          setReplyTexts((prev) => ({ ...prev, [post._id]: e.target.value }))
                        }
                        placeholder="Leave an encouraging note or share a guitar tip..."
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}