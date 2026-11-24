# 🎵 Songhomie - AI-Powered Chord & Lyrics Platform

> **Đồ án môn học Web 2:** `CSBU109.R11.KHBC-Songhomie`  
> Nền tảng bóc tách hợp âm, đồng bộ lời bài hát tự động bằng AI (tối ưu Tiếng Việt & Tiếng Anh) và biên soạn Chord Sheet chuyên nghiệp dành cho Guitarist & Musician.

---

## 🚀 Công nghệ sử dụng (Tech Stack)

- **Frontend:** React.js, Vite, Tailwind CSS v4, Axios, Context API, React Router v6.
- **Backend:** Node.js, Express.js RESTful API, MongoDB Atlas, Mongoose, JWT Auth, Cloudinary, Multer, In-Memory Concurrency Queue & Result Cache.
- **AI & Audio Engine (Python):**
  - **Nhận diện hợp âm & nhịp (Chord & Tempo):** `Librosa` (Harmonic filtering, Chroma-CQT, Beat Tracking & Chord Smoothing).
  - **Đồng bộ & bóc tách lời bài hát (Hybrid Lyrics Pipeline):**
    - Tra cứu lời chuẩn theo mốc thời gian qua **LRCLIB API** kết hợp **Silero VAD** tự động căn chỉnh độ trễ đoạn nhạc dạo đầu (intro).
    - Nhận diện giọng hát trực tiếp qua **Groq Cloud Whisper (`whisper-large-v3-turbo`)** tốc độ cao và **Faster-Whisper** (chạy nội bộ dự phòng).
    - Hiệu đính dấu thanh Tiếng Việt & chính tả Tiếng Anh bằng **Gemini 2.5 Flash / Llama 3.3**.
  - **Tách giọng hát & nhạc nền (Chế độ Studio):** `audio-separator` (`UVR_MDXNET_KARA_2.onnx` / ONNX Runtime).
  - **Tải & giải mã âm thanh:** `yt-dlp`, `FFmpeg`, `PyAV`, `SoundFile`.
- **Architecture:** Monorepo (`backend/` + `frontend/`).

---

## ✨ Tính năng nổi bật

1. **🤖 AI Auto Chord & Lyrics Extraction:**
   - Hỗ trợ bóc tách hợp âm và lời đồng bộ từ **link YouTube** hoặc **file âm thanh tải lên** (`.mp3`, `.wav`, `.m4a`, `.ogg`).
   - Hỗ trợ 2 chế độ lấy lời (**Tìm lời chuẩn LRCLIB** & **AI tự nghe giọng hát**) và 2 mức xử lý (**Fast ~5s** & **Studio tách Vocal/Instrumental**).
   - Tích hợp **Job Queue & Request Collapsing** giúp giới hạn tiến trình AI đồng thời, chống quá tải CPU/RAM khi nhiều người dùng truy cập cùng lúc.
2. **✍️ Manual Chord Sheet Editor:** Bộ chuyển đổi chế độ linh hoạt cho phép tự biên soạn bài hát, chèn và căn chỉnh hợp âm dạng `[C]`, `[Am]`, `[Dm]` thủ công.
3. **🎸 Interactive Fretboard, Key Transposer & Auto Scroll:** Hiển thị thế bấm hợp âm trực quan theo thời gian thực khi phát nhạc, đổi tông tức thì (`-1` / `+1`) và cuộn trang tự động khi biểu diễn.
4. **🏆 Rankings & Music Competitions:** Bảng xếp hạng bài hát/hợp âm nổi bật và các thử thách cover nhạc cụ dành cho cộng đồng.
5. **🔐 Authentication & Community Discussion:** Hệ thống đăng ký, đăng nhập bảo mật bằng JWT, quản lý danh sách phát cá nhân và khu vực bình luận tương tác.

---

## ⚡ Cài đặt & Khởi chạy (Quick Start)

### 1. Yêu cầu môi trường
- **Node.js** `>= 18.x`
- **Python** `>= 3.10` và công cụ **FFmpeg** đã thêm vào `PATH` hệ thống.

### 2. Cài đặt thư viện Python cho AI Engine
```bash
pip install numpy scipy soundfile librosa yt-dlp av requests faster-whisper onnxruntime audioread beartype==0.18.5
# (Tùy chọn nếu dùng chế độ Studio tách vocal)
pip install audio-separator --no-deps


## 📂 Cấu trúc Monorepo Dự án

CSBU109.R11.KHBC-Songhomie/
├── backend/                      # RESTful API Server & AI Service
│   ├── src/
│   │   ├── config/               # Cấu hình kết nối MongoDB Atlas & Cloudinary
│   │   ├── controllers/          # Xử lý logic API (Auth, Songs, Rankings, Comments, AI)
│   │   ├── middlewares/          # Xác thực JWT & xử lý Upload
│   │   ├── models/               # Mongoose Schemas (User, Song, Comment, Competition, Playlist)
│   │   ├── routes/               # Khai báo Express API Endpoints
│   │   ├── scripts/
│   │   │   └── chord_analyzer.py # Python AI Engine (Librosa CQT, LRCLIB, Whisper, MDX-NET)
│   │   ├── services/
│   │   │   ├── aiService.js      # Quản lý tiến trình Python, Hàng đợi & Cache kết quả AI
│   │   │   └── storageService.js # Tích hợp lưu trữ âm thanh Cloudinary
│   │   └── server.js             # Entry point Express Server
│   ├── .env                      # Biến môi trường Server (không commit lên Git)
│   └── package.json
├── frontend/                     # React + Vite Client Application
│   ├── src/
│   │   ├── components/           # UI Components (Navbar, Footer, GuitarFretboard, ...)
│   │   ├── context/              # AuthContext quản lý trạng thái đăng nhập
│   │   ├── pages/                # Các trang giao diện (Home, AI Analyzer, SongDetail, Rankings, ...)
│   │   ├── services/             # Cấu hình Axios API Client
│   │   ├── App.jsx               # Main Router Configuration
│   │   └── main.jsx              # Entry point React Vite
│   ├── index.html                # HTML Shell
│   └── package.json
├── .gitignore                    # Chặn commit node_modules, .env & file âm thanh tạm
└── README.md                     # Tài liệu hướng dẫn dự án