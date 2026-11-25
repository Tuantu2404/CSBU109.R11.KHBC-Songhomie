import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AudioLines, Eye, Guitar, Mic, Music } from 'lucide-react';
import API from '../services/api';

export default function HomePage() {
  const features = [
    {
      icon: AudioLines,
      title: 'AI Chord Detection',
      desc: 'Analyze audio and identify guitar chords with precision.',
      iconStyle: 'bg-indigo-100 text-indigo-700',
      surfaceStyle: 'from-white to-indigo-50',
    },
    {
      icon: Mic,
      title: 'Synced Lyrics',
      desc: 'Transcribe lyrics and align them with the song timeline.',
      iconStyle: 'bg-fuchsia-100 text-fuchsia-700',
      surfaceStyle: 'from-white to-fuchsia-50',
    },
    {
      icon: Guitar,
      title: 'Interactive Guitar',
      desc: 'Explore chord shapes and transpose songs to fit your vocal range.',
      iconStyle: 'bg-cyan-100 text-cyan-700',
      surfaceStyle: 'from-white to-cyan-50',
    }
  ];

  const [songs, setSongs] = useState([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [songsError, setSongsError] = useState('');

  useEffect(() => {
    let active = true;

    API.get('/songs')
      .then((response) => {
        if (active) {
          setSongs(Array.isArray(response.data?.data) ? response.data.data : []);
        }
      })
      .catch((error) => {
        console.error('Failed to load community songs:', error);
        if (active) setSongsError('Unable to load community songs right now.');
      })
      .finally(() => {
        if (active) setSongsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const aiAnalyzedSongs = songs
    .filter((song) => song.type === 'generated' || Boolean(song.isAiGenerated))
    .slice(0, 3);
  const communitySongs = songs
    .filter((song) => song.type !== 'generated' && !song.isAiGenerated)
    .slice(0, 3);

  const getSongChords = (song) => {
    const chordNames = [
      ...(song.chordsAi || []).map((item) => item.chord),
      ...(song.timeline || []).map((item) => item.chord),
      ...Array.from(
        String(song.lyricsChords || song.lyrics || '').matchAll(/\[([A-G][#b]?[^\]]*)\]/g),
        (match) => match[1],
      ),
    ];

    return [...new Set(chordNames.map((chord) => chord?.trim()).filter(Boolean))].slice(0, 4);
  };

  const songGroups = [
    {
      title: 'AI-Analyzed Songs',
      description: 'Songs analyzed by members and saved to the library.',
      songs: aiAnalyzedSongs,
      emptyMessage: 'No AI-analyzed songs yet.',
      action: 'Analyze a Song',
      href: '/ai-analyzer',
      badge: 'AI Analysis',
      theme: {
        heading: 'text-violet-800',
        empty: 'border-violet-200 bg-violet-50/70',
        link: 'text-violet-700 hover:text-violet-800',
        card: 'from-violet-50 via-white to-fuchsia-50 hover:border-violet-300 hover:shadow-violet-500/10',
        cover: 'from-violet-100 to-fuchsia-100 text-violet-700',
        badge: 'bg-violet-100 text-violet-700',
        chord: 'border-violet-200 bg-violet-50 text-violet-700',
        footer: 'border-violet-100 bg-violet-50/80',
        action: 'text-violet-700',
      },
    },
    {
      title: 'Community Creations',
      description: 'Chord sheets and arrangements created by members.',
      songs: communitySongs,
      emptyMessage: 'No community creations yet.',
      action: 'Create a Song',
      href: '/producer',
      badge: 'Community Creation',
      theme: {
        heading: 'text-emerald-800',
        empty: 'border-emerald-200 bg-emerald-50/70',
        link: 'text-emerald-700 hover:text-emerald-800',
        card: 'from-emerald-50 via-white to-cyan-50 hover:border-emerald-300 hover:shadow-emerald-500/10',
        cover: 'from-emerald-100 to-cyan-100 text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-700',
        chord: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        footer: 'border-emerald-100 bg-emerald-50/80',
        action: 'text-emerald-700',
      },
    },
  ];

  return (
    <div className="min-h-screen space-y-20 bg-linear-to-br from-sky-50 via-indigo-50/60 to-fuchsia-50/70 pb-20">
      {/* --- HERO SECTION --- */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-24 pb-32 px-6 text-center border-b border-slate-800/60">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-75 h-75 bg-indigo-600/25 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-75 h-75 bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase shadow-inner">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Songhomie AI Engine v2.0 Released
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1]">
            Master Any Song With <br />
            <span className="bg-linear-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
              AI Guitar Chords
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Analyze audio files, sync lyrics and chords, and share your songs with the community.
          </p>

          {/* --- NỊNH MẮT CTA BUTTONS --- */}
          <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto">
            <Link
              to="/ai-analyzer"
              className="w-full sm:w-auto px-8 py-4 bg-linear-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/40 flex items-center justify-center gap-2 text-base group"
            >
              <span>Create / Analyze Song</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>

            <Link
              to="/rankings"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 font-bold rounded-2xl backdrop-blur-md transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center gap-2 text-base"
            >
              <span>Explore Library</span>
            </Link>
          </div>
        </div>
      </section>

      {/* --- FEATURE GRID --- */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Built For Modern Musicians</h2>
          <p className="text-slate-500 text-sm">Everything you need to transcribe, learn, and perform your favorite songs.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className={`group bg-linear-to-br ${f.surfaceStyle} p-7 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 space-y-4`}>
              <div className={`w-12 h-12 rounded-2xl ${f.iconStyle} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- COMMUNITY SONGS --- */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Song Library</span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Songs from the Community</h2>
          </div>
          <Link to="/rankings" className="text-indigo-600 hover:text-indigo-700 font-bold text-sm inline-flex items-center gap-1 group">
            <span>View Song Library</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {songsLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading songs...</p>
        ) : songsError ? (
          <p role="alert" className="py-12 text-center text-sm text-rose-600">
            {songsError}
          </p>
        ) : (
          <div className="space-y-10">
            {songGroups.map((group) => (
              <div key={group.title} className="space-y-4">
                <div>
                  <h3 className={`text-xl font-extrabold ${group.theme.heading}`}>{group.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                </div>

                {group.songs.length === 0 ? (
                  <div className={`rounded-2xl border border-dashed p-8 text-center ${group.theme.empty}`}>
                    <p className="text-sm font-semibold text-slate-600">{group.emptyMessage}</p>
                    <Link
                      to={group.href}
                      className={`mt-3 inline-flex items-center gap-1 text-sm font-bold ${group.theme.link}`}
                    >
                      {group.action}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {group.songs.map((song) => {
                      const chords = getSongChords(song);

                      return (
                        <Link
                          key={song._id}
                          to={`/songs/${song._id}`}
                          className={`group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br ${group.theme.card} shadow-sm transition hover:shadow-xl`}
                        >
                          <div className="space-y-4 p-6">
                            <div className="flex items-center gap-4">
                              <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br ${group.theme.cover}`}>
                                {song.coverUrl ? (
                                  <img
                                    src={song.coverUrl}
                                    alt={`Cover art for ${song.title}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Music className="h-6 w-6" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${group.theme.badge}`}>
                                  {group.badge}
                                </span>
                                <h4 className="truncate text-base font-bold text-slate-800 transition-colors group-hover:text-indigo-600">
                                  {song.title || 'Untitled Song'}
                                </h4>
                                <p className="truncate text-xs text-slate-400">
                                  {song.artist || 'Various Artists'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>{song.genre || 'Acoustic'}</span>
                              <span aria-hidden="true">•</span>
                              <span>Key: {song.key || 'C'}</span>
                            </div>

                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Chords
                              </span>
                              {chords.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {chords.map((chord) => (
                                    <span
                                      key={chord}
                                      className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${group.theme.chord}`}
                                    >
                                      {chord}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400">No chords listed</p>
                              )}
                            </div>
                          </div>

                          <div className={`flex items-center justify-between border-t px-6 py-4 text-xs ${group.theme.footer}`}>
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                              <Eye className="h-3.5 w-3.5" />
                              {song.views || 0} views
                            </span>
                            <span className={`inline-flex items-center gap-1 font-bold ${group.theme.action}`}>
                              View Song
                              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- CTA BANNER --- */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="relative overflow-hidden bg-linear-to-r from-slate-950 via-indigo-950 to-slate-900 rounded-3xl p-10 md:p-14 text-white text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl border border-indigo-500/20">
          <div className="space-y-2 max-w-xl relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight">Ready to transcribe your first song?</h2>
            <p className="text-slate-300 text-sm">Detect chords with AI and create synced lyrics for your favorite songs.</p>
          </div>
          <Link
            to="/ai-analyzer"
            className="relative z-10 bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-2xl transition transform hover:-translate-y-0.5 shrink-0 text-sm"
          >
            Start Analyzing Now
          </Link>
        </div>
      </section>
    </div>
  );
}