import { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const NAV_LINKS = [
  { path: '/', label: 'Home' },
  { path: '/ai-analyzer', label: 'AI Analyzer' },
  { path: '/producer', label: 'Song Producer' },
  { path: '/rankings', label: 'Trending Vibes' },
  { path: '/competitions', label: 'Music Jam' },
  { path: '/forum', label: 'Forum' },
];

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-slate-900 text-white px-4 md:px-8 py-4 shadow-lg border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="text-2xl font-bold text-indigo-400 hover:text-sky-400 transition flex items-center gap-2 shrink-0"
        >
          🎵 Songhomie
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex gap-6 items-center font-medium text-sm text-slate-300">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`transition ${
                isActive(item.path)
                  ? 'text-sky-400 font-bold'
                  : 'hover:text-indigo-400'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <div className="flex gap-4 items-center ml-2 pl-4 border-l border-slate-700">
              <span className="text-indigo-300 font-semibold">{user.username}</span>
              <button
                onClick={logout}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition ml-2"
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3 text-sm font-medium text-slate-300">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-xl transition ${
                isActive(item.path)
                  ? 'bg-slate-800 text-sky-400 font-bold'
                  : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="pt-3 mt-1 border-t border-slate-800 flex items-center justify-between px-3">
            {user ? (
              <>
                <span className="text-indigo-300 font-semibold">{user.username}</span>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}