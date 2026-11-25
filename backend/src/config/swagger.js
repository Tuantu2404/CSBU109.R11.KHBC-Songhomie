const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Songhomie API Documentation",
      version: "1.0.0",
      description:
        "RESTful API for Songhomie — AI Guitar Chord Recognition, Lyric Synchronization & Music Community Platform",
    },
    servers: [
      {
        url: process.env.BACKEND_URL || "http://localhost:3000",
        description: "Active Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "Kiểm tra trạng thái hoạt động của Backend",
          responses: {
            200: { description: "Server đang hoạt động bình thường" },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Đăng ký tài khoản mới",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "email", "password"],
                  properties: {
                    username: { type: "string", example: "guitarist_uit" },
                    email: { type: "string", example: "user@songhomie.app" },
                    password: { type: "string", example: "123456" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Tạo tài khoản thành công" },
            400: { description: "Dữ liệu không hợp lệ hoặc email đã tồn tại" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Đăng nhập và nhận JWT Token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", example: "user@songhomie.app" },
                    password: { type: "string", example: "123456" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Đăng nhập thành công, trả về token" },
            401: { description: "Sai email hoặc mật khẩu" },
          },
        },
      },
      "/api/songs/analyze": {
        post: {
          tags: ["AI Audio Analysis"],
          summary: "Phân tích hợp âm (72 chords) & đồng bộ lời bài hát từ file audio hoặc link YouTube",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    audio: { type: "string", format: "binary", description: "File MP3/WAV/M4A" },
                    youtubeUrl: { type: "string", example: "https://www.youtube.com/watch?v=..." },
                    lang: { type: "string", enum: ["auto", "vi", "en"], default: "auto" },
                    lyricMode: { type: "string", enum: ["search", "transcribe"], default: "search" },
                    qualityMode: { type: "string", enum: ["fast", "studio"], default: "fast" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Trả về tempo, key, danh sách hợp âm và lời đã gắn hợp âm theo từng từ" },
            400: { description: "Thiếu file audio hoặc URL không hợp lệ" },
          },
        },
      },
      "/api/songs": {
        get: {
          tags: ["Songs & Verified Cache"],
          summary: "Lấy danh sách bài hát đã lưu của cộng đồng",
          responses: {
            200: { description: "Danh sách bài hát kèm hợp âm và lời" },
          },
        },
        post: {
          tags: ["Songs & Verified Cache"],
          summary: "Lưu bài hát đã chỉnh sửa vào Database & Verified Cache (v5)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", example: "Nắng Ấm Xa Dần" },
                    artist: { type: "string", example: "Sơn Tùng M-TP" },
                    key: { type: "string", example: "Am" },
                    tempo: { type: "number", example: 118 },
                    lyricsWithChords: { type: "string" },
                    cacheKey: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Đã lưu bài hát và cập nhật Verified Cache" },
          },
        },
      },
      "/api/forum": {
        get: {
          tags: ["Community Forum"],
          summary: "Lấy danh sách bài viết thảo luận & chia sẻ hợp âm",
          responses: {
            200: { description: "Danh sách bài viết diễn đàn" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  // Xuất raw JSON spec (dùng cho công cụ test hoặc import Postman)
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Dùng CDN để Swagger UI hiển thị đẹp trên cả Vercel Serverless
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Songhomie API Docs",
      customCssUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css",
      customJs: [
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js",
      ],
    })
  );
}

module.exports = setupSwagger;