import { useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Music,
  Upload,
  Save,
  Sparkles,
  Eye,
} from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import GuitarFretboard from '../components/GuitarFretboard';

const QUICK_CHORDS = ['C', 'G', 'Am', 'F', 'Dm', 'Em', 'D', 'E', 'A', 'Bm', 'Fmaj7', 'C7'];

export default function SongProducerPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const textareaRef = useRef(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('Acoustic');
  const [songKey, setSongKey] = useState('C');
  const [vibeTag, setVibeTag] = useState('Chill & Share');
  const [lyricAlign, setLyricAlign] = useState('left');
  const [lyricsChords, setLyricsChords] = useState(
    '[C] Nắng khẽ buông nhẹ [G] trên phím đàn\n[hl-yellow][Am] Từng nhịp âm thanh [F] vang lên dịu dàng[/hl-yellow]'
  );

  const [coverFile, setCoverFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [previewChord, setPreviewChord] = useState('C');
  const [saving, setSaving] = useState(false);

  // Chèn nhanh hợp âm [C], [Am]... tại vị trí con trỏ
  const insertChordAtCursor = (chord) => {
    const textarea = textareaRef.current;
    setPreviewChord(chord);
    if (!textarea) {
      setLyricsChords((prev) => `${prev} [${chord}] `);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const tag = `[${chord}] `;
    const updated =
      lyricsChords.substring(0, start) + tag + lyricsChords.substring(end);

    setLyricsChords(updated);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Tô sáng đoạn văn bản đang bôi đen (Highlight điệp khúc / ghi chú)
  const applyHighlight = (color) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      alert('Hãy bôi đen một đoạn lời bài hát trước khi bấm tô sáng nhé!');
      return;
    }

    const selectedText = lyricsChords.substring(start, end);
    const wrapped = `[hl-${color}]${selectedText}[/hl-${color}]`;
    const updated =
      lyricsChords.substring(0, start) + wrapped + lyricsChords.substring(end);

    setLyricsChords(updated);
  };

  // Lưu bản phối & upload media lên Cloudinary
  const handlePublishSong = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Vui lòng đăng nhập để xuất bản bản phối!');
      return navigate('/login');
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('artist', artist || user.username || 'Songhomie Creator');
      formData.append('genre', genre);
      formData.append('key', songKey);
      formData.append('vibeTag', vibeTag);
      formData.append('lyricAlign', lyricAlign);
      formData.append('lyricsChords', lyricsChords);
      formData.append('type', 'shared');

      if (coverFile) formData.append('cover', coverFile);
      if (audioFile) formData.append('audio', audioFile);

      const res = await API.post('/songs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.data?._id) {
        navigate(`/songs/${res.data.data._id}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu bản phối bài hát.');
    } finally {
      setSaving(false);
    }
  };

  // Render khung xem trước (Live Preview)
  const renderPreview = () => {
    const alignClass =
      lyricAlign === 'center'
        ? 'text-center'
        : lyricAlign === 'right'
        ? 'text-right'
        : 'text-left';

    return (
      <div className={`${alignClass} space-y-2 font-mono text-sm text-slate-200`}>
        {lyricsChords.split('\n').map((line, idx) => {
          const parts = line.split(/(\[hl-(?:yellow|cyan|green)\].*?\[\/hl-(?:yellow|cyan|green)\])/g);
          return (
            <p key={idx} className="min-h-6">
              {parts.map((part, pIdx) => {
                let cls = '';
                let text = part;
                if (part.startsWith('[hl-yellow]')) {
                  cls = 'bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded';
                  text = part.replace(/\[\/?hl-yellow\]/g, '');
                } else if (part.startsWith('[hl-cyan]')) {
                  cls = 'bg-sky-400/20 text-sky-200 px-1.5 py-0.5 rounded';
                  text = part.replace(/\[\/?hl-cyan\]/g, '');
                } else if (part.startsWith('[hl-green]')) {
                  cls = 'bg-emerald-400/20 text-emerald-200 px-1.5 py-0.5 rounded italic';
                  text = part.replace(/\[\/?hl-green\]/g, '');
                }

                const tokens = text.split(/(\[[A-G][#b]?m?(?:7|maj7|sus4|sus2)?\])/g);
                return (
                  <span key={pIdx} className={cls}>
                    {tokens.map((tok, tIdx) =>
                      /^\[.+\]$/.test(tok) ? (
                        <button
                          key={tIdx}
                          type="button"
                          onClick={() => setPreviewChord(tok.replace(/[\[\]]/g, ''))}
                          className="mx-0.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-xs border border-sky-400/40 cursor-pointer"
                        >
                          {tok.replace(/[\[\]]/g, '')}
                        </button>
                      ) : (
                        <span key={tIdx}>{tok}</span>
                      )
                    )}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200 mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Songhomie Creator Studio
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            Biên Soạn Lời & Hợp Âm (Song Producer)
          </h1>
        </div>
      </div>

      <form onSubmit={handlePublishSong} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT TRÁI: TRÌNH SOẠN THẢO */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên bài hát *"
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Ca sĩ / Người biên soạn"
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="Acoustic">Acoustic</option>
              <option value="Pop">Pop</option>
              <option value="Ballad">Ballad</option>
              <option value="Indie">Indie</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={songKey}
                onChange={(e) => setSongKey(e.target.value)}
                placeholder="Tông (C, Am)"
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <select
                value={vibeTag}
                onChange={(e) => setVibeTag(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="Chill & Share">Chill & Share</option>
                <option value="Acoustic Cuối Tuần">Acoustic Cuối Tuần</option>
                <option value="Hợp Âm Dễ Tập">Hợp Âm Dễ Tập</option>
                <option value="Góc AI Sáng Tác">Góc AI Sáng Tác</option>
              </select>
            </div>
          </div>

          {/* Thanh công cụ Align & Highlight */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-2xl">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLyricAlign('left')}
                className={`p-2 rounded-lg cursor-pointer ${
                  lyricAlign === 'left' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'
                }`}
                title="Căn trái"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLyricAlign('center')}
                className={`p-2 rounded-lg cursor-pointer ${
                  lyricAlign === 'center' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'
                }`}
                title="Căn giữa"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLyricAlign('right')}
                className={`p-2 rounded-lg cursor-pointer ${
                  lyricAlign === 'right' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'
                }`}
                title="Căn phải"
              >
                <AlignRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Highlighter className="w-3.5 h-3.5 text-slate-500" />
              <button
                type="button"
                onClick={() => applyHighlight('yellow')}
                className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 cursor-pointer"
              >
                Điệp khúc
              </button>
              <button
                type="button"
                onClick={() => applyHighlight('cyan')}
                className="px-2.5 py-1 rounded-lg bg-sky-200 text-sky-900 cursor-pointer"
              >
                Điểm nhấn
              </button>
              <button
                type="button"
                onClick={() => applyHighlight('green')}
                className="px-2.5 py-1 rounded-lg bg-emerald-200 text-emerald-900 cursor-pointer"
              >
                Ghi chú
              </button>
            </div>
          </div>

          {/* Chèn nhanh hợp âm */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHORDS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => insertChordAtCursor(ch)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-sky-500 hover:text-slate-950 text-sky-300 text-xs font-bold transition cursor-pointer"
              >
                +{ch}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            rows={10}
            required
            value={lyricsChords}
            onChange={(e) => setLyricsChords(e.target.value)}
            className="w-full p-4 bg-slate-950 text-emerald-400 font-mono text-sm rounded-2xl border border-slate-800 focus:outline-none leading-relaxed"
          />

          {/* Upload Ảnh bìa & Audio Cloudinary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer">
              <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">
                {coverFile ? coverFile.name : 'Chọn ảnh bìa (Cloudinary)'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files[0])}
                className="hidden"
              />
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer">
              <Music className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">
                {audioFile ? audioFile.name : 'Chọn file nhạc MP3/WAV'}
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang xuất bản bản phối...' : 'Xuất Bản & Mở Đàn Guitar'}
          </button>
        </div>

        {/* CỘT PHẢI: LIVE PREVIEW & ĐÀN GUITAR */}
        <div className="lg:col-span-5 bg-slate-950 text-slate-100 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <Eye className="w-4 h-4" /> Xem trước trực tiếp (Live Preview)
              </span>
            </div>

            <div className="w-44 mx-auto">
              <GuitarFretboard chord={previewChord} />
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 max-h-80 overflow-y-auto">
              {renderPreview()}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}