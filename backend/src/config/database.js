const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Hỗ trợ đọc linh hoạt cả MONGODB_URI hoặc MONGO_URI từ file .env
    const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!dbURI) {
      console.error('❌ LỖI: Chưa cấu hình MONGODB_URI trong file .env!');
      process.exit(1);
    }

    const conn = await mongoose.connect(dbURI);

    const songsCollectionExists = await mongoose.connection.db
      .listCollections({ name: 'songs' }, { nameOnly: true })
      .hasNext();
    if (songsCollectionExists) {
      const songsCollection = mongoose.connection.collection('songs');
      const songIndexes = await songsCollection.indexes();
      const uniqueYoutubeIndex = songIndexes.find(
        (index) =>
          index.unique &&
          Object.keys(index.key).length === 1 &&
          index.key.youtubeId === 1,
      );
      if (uniqueYoutubeIndex) {
        await songsCollection.dropIndex(uniqueYoutubeIndex.name);
        console.log('✅ Đã gỡ unique index YouTube ID để cho phép lưu video bởi nhiều người dùng.');
      }
    }

    console.log(`✅ Kết nối MongoDB Atlas thành công: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ LỖI Kết nối MongoDB:', err.message);
    process.exit(1); 
  }
};

module.exports = connectDB;