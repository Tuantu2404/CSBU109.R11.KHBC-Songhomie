require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./src/config/database");
const setupSwagger = require("./src/config/swagger");

const corsOriginsSetting = process.env.CORS_ORIGINS || "";
const allowedOrigins = (corsOriginsSetting || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (process.env.NODE_ENV === "production") {
  const missingVariables = ["JWT_SECRET"].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (!corsOriginsSetting.trim() || allowedOrigins.length === 0) {
    missingVariables.push("CORS_ORIGINS");
  }
  if (missingVariables.length > 0) {
    console.error(
      `Missing required production environment variables: ${missingVariables.join(", ")}`,
    );
    process.exit(1);
  }
}

const app = express();
setupSwagger(app);
const PORT = process.env.PORT || 5000;

// 1. Connect to MongoDB Atlas
connectDB();

// 2. System middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files for backward compatibility with older sample tracks
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 3. REST API routes
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/songs", require("./src/routes/songRoutes"));
app.use("/api/ai", require("./src/routes/aiRoutes"));
app.use("/api/forum", require("./src/routes/forumRoutes"));
app.use("/api/comments", require("./src/routes/commentRoutes"));
app.use("/api/rankings", require("./src/routes/rankingRoutes"));
app.use("/api/competitions", require("./src/routes/competitionRoutes"));

// Server status routes
app.get("/", (req, res) => {
  res.send(`SongHomie REST API server is running on port ${PORT}`);
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SongHomie REST API server is healthy.",
    timestamp: new Date().toISOString(),
  });
});

// 4. Centralized 404 and error handling
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// 5. Start the server
app.listen(PORT, () => {
  console.log(`SongHomie API is listening on port ${PORT}`);
});
