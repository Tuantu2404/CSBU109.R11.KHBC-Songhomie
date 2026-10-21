const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Vui lòng nhập tên bài hát"],
      trim: true,
      maxlength: [255, "Tên bài hát tối đa 255 ký tự"],
    },
    artist: {
      type: String,
      trim: true,
      maxlength: [100, "Tên ca sĩ tối đa 100 ký tự"],
      default: "Unknown",
    },
    key: {
      type: String,
      default: "C", // Phục vụ tính năng Transpose (Đổi tông nhạc)
      trim: true,
    },
    genre: {
      type: String,
      default: "Pop",
      trim: true,
    },

    // --- MEDIA LƯU TRỮ TRÊN CLOUDINARY ---
    coverUrl: {
      type: String,
      default: "", // Link ảnh bìa bài hát trên Cloudinary
      trim: true,
    },
    audioPath: {
      type: String,
      maxlength: 500,
      sparse: true, // Lưu link file âm thanh (.mp3/.wav) trên Cloudinary hoặc đường dẫn nội bộ
    },

    // --- SONG PRODUCER & CHỈNH SỬA LỜI BÀI HÁT ---
    // Lưu lời + hợp âm thủ công (hỗ trợ cả thẻ highlight như [hl-yellow]...[/hl-yellow])
    lyricsChords: {
      type: String,
      required: false,
    },
    // Lưu trạng thái căn lề của khung lời bài hát trong Song Producer
    lyricAlign: {
      type: String,
      enum: ["left", "center", "right"],
      default: "left",
    },

    // --- BÓC TÁCH AI & ĐỒNG BỘ CẦN ĐÀN GUITAR ---
    youtubeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    chordsAi: [
      {
        time: Number,
        chord: String,
      },
    ],
    lyricsAi: {
      type: String,
    },
    // Mảng đồng bộ từng câu hát + hợp âm theo giây để chạy cần đàn Guitar điểm sáng
    timeline: [
      {
        time: { type: Number, required: true }, // Mốc giây câu hát bắt đầu (VD: 12.5)
        chord: { type: String, default: "" }, // Hợp âm tại thời điểm đó (VD: "Am")
        text: { type: String, default: "" }, // Lời câu hát tương ứng
      },
    ],
    type: {
      type: String,
      enum: ["generated", "shared"],
      default: "shared",
    },

    // --- GIAO LƯU ÂM NHẠC TÍCH CỰC & CHIA SẺ SỞ THÍCH ---
    views: {
      type: Number,
      default: 0, // Lượt nghe / tập đàn cùng bài hát
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Bài hát được yêu thích
      },
    ],
    bookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Lưu vào sổ tay hợp âm cá nhân
      },
    ],
    // Các nút thả cảm xúc cổ vũ tích cực (không dùng hệ thống chấm điểm/chê bai)
    reactions: {
      clap: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // 👏 Vỗ tay cổ vũ
      guitar: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // 🎸 Phối hợp âm hay
      heart: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // ❤️ Truyền cảm hứng
    },
    vibeTag: {
      type: String,
      default: "Chill & Share", // Thẻ chủ đề giao lưu (VD: "Acoustic Cuối Tuần", "Tập Đàn Cho Người Mới")
      trim: true,
    },

    // --- THỬ THÁCH GIAO LƯU VUI (WEEKLY MUSIC JAM) ---
    // Giữ tên trường competition & votes để tương thích với các route cũ, định hướng sang giao lưu cộng đồng
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
      default: null,
    },
    votes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Lượt thả tim ủng hộ cho các bản cover giao lưu
      },
    ],

    // --- THÔNG TIN QUẢN LÝ NGƯỜI ĐĂNG ---
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // Cho phép hiển thị ngay để tăng tương tác
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// INDEXING: Tối ưu tốc độ tìm kiếm bài hát & truy vấn danh sách nổi bật
songSchema.index({ title: "text", artist: "text" });
songSchema.index({ views: -1 });
songSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Song", songSchema);