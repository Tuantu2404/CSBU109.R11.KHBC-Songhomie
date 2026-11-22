import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AiAnalyzerPage from './pages/AiAnalyzerPage';
import RankingsPage from './pages/RankingsPage';
import CompetitionsPage from './pages/CompetitionsPage';
import ForumPage from './pages/ForumPage';
import SongProducerPage from './pages/SongProducerPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SongDetailPage from './pages/SongDetailPage';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
          <div>
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/ai-analyzer" element={<AiAnalyzerPage />} />
              <Route path="/producer" element={<SongProducerPage />} />
              <Route path="/rankings" element={<RankingsPage />} />
              <Route path="/competitions" element={<CompetitionsPage />} />
              <Route path="/forum" element={<ForumPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/songs/:id" element={<SongDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}