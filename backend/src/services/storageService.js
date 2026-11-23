const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  cloudinary,
  uploadBufferToCloudinary,
} = require("../config/cloudinary");

// Lưu file từ multer (diskStorage hoặc memoryStorage) ra đường dẫn tạm giữ nguyên tên gốc
const saveTempFileFromRequest = (file) => {
  if (!file) return null;
  if (file.path) return file.path;

  if (file.buffer) {
    const cleanOriginal = file.originalname.replace(/[<>:"/\\|?*]/g, "_");
    const tempPath = path.join(os.tmpdir(), cleanOriginal);
    fs.writeFileSync(tempPath, file.buffer);
    return tempPath;
  }

  return null;
};

// Xóa file tạm an toàn
const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error("Không thể xóa file tạm:", e.message);
    }
  }
};

// Upload audio lên Cloudinary
const uploadAudioToCloud = async (file, localFilePath, folder = "songhomie/audios") => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return null;

  if (file?.buffer) {
    const uploadRes = await uploadBufferToCloudinary(file.buffer, folder);
    return uploadRes.secure_url;
  }

  if (localFilePath && fs.existsSync(localFilePath)) {
    const uploadRes = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder,
    });
    return uploadRes.secure_url;
  }

  return null;
};

module.exports = {
  saveTempFileFromRequest,
  cleanupTempFile,
  uploadAudioToCloud,
};