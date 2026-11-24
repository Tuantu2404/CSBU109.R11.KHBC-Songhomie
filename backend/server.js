require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./src/config/database");

const app = express();
const PORT = process.env.PORT || 5000;

// 1. KẾT NỐI MONGODB ATLAS
connectDB();

// 2. MIDDLEWARES HỆ THỐNG
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Phục vụ file tĩnh (tương thích ngược với các bản nhạc mẫu cũ)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 3. RESTFUL API ROUTES
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/songs", require("./src/routes/songRoutes"));
app.use("/api/ai", require("./src/routes/aiRoutes"));
app.use("/api/forum", require("./src/routes/forumRoutes"));
app.use("/api/comments", require("./src/routes/commentRoutes"));
app.use("/api/rankings", require("./src/routes/rankingRoutes"));
app.use("/api/competitions", require("./src/routes/competitionRoutes"));

// Route kiểm tra trạng thái Server
app.get("/", (req, res) => {
  res.send(`🚀 SongHomie RESTful API Server đang chạy trên cổng ${PORT}`);
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "🚀 SongHomie RESTful API Server đang hoạt động ổn định!",
    timestamp: new Date().toISOString(),
  });
});

// 4. XỬ LÝ LỖI 404 & LỖI HỆ THỐNG TẬP TRUNG
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy đường dẫn API: ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Lỗi máy chủ nội bộ",
  });
});

// 5. KHỞI ĐỘNG SERVER
app.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 SongHomie API running on: http://localhost:${PORT}`);
  console.log("=================================");
});
