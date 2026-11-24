const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Lưu file tạm trên RAM (buffer) để đẩy thẳng lên Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const isAudio = file.mimetype.startsWith('audio/');

  if (isImage || isAudio) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ hỗ trợ định dạng file ảnh (JPG, PNG, WEBP) hoặc âm thanh (MP3, WAV, OGG)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // Giới hạn tối đa 25MB/file
  },
});

// Middleware nhận tối đa 1 ảnh bìa và 1 file nhạc từ FormData
const uploadSongFields = upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
]);

// Hàm đẩy buffer lên Cloudinary (dùng resource_type: 'auto' để hỗ trợ cả audio & image)
const uploadBufferToCloudinary = (fileBuffer, folder = 'songhomie') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

module.exports = {
  cloudinary,
  uploadSongFields,
  uploadBufferToCloudinary,
};