# Songhomie Backend API & AI Service

## 🚀 Core Features
- **RESTful API Architecture:** Express.js endpoints for Authentication, Songs, Rankings, Comments, and Competitions.
- **Python AI Engine (`chord_analyzer.py`):** Automatic chord extraction using Librosa CQT & lyrics transcription powered by Faster-Whisper.
- **Cloudinary Storage:** Media asset management and cloud uploading for audio files (`.mp3`, `.wav`).
- **Database:** MongoDB Atlas integration using Mongoose ORM with structured schemas.

## 🛠️ Getting Started

### 1. Install Dependencies And Start 
```bash
cd backend
npm install
npm run dev
```

## Deploy on Render with Docker

- Set **Root Directory** to `backend` and deploy using its `Dockerfile` (Node.js 26).
- Set the health check path to `/api/health`.
- Configure `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `CORS_ORIGINS`.
- Set `CORS_ORIGINS` to the exact Vercel site origin(s), comma-separated,
  such as `https://your-site.vercel.app`.
- Render provides `PORT`; the server listens on that value automatically.
- In production, the server exits at startup if `JWT_SECRET` or
  `CORS_ORIGINS` is missing.