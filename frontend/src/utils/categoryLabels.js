const VIBE_TAG_LABELS = {
  "Chill & Share": "Chill & Share",
  "Acoustic Cuối Tuần": "Weekend Acoustic",
  "Hợp Âm Dễ Tập": "Easy Chord Sheets",
  "Góc AI Sáng Tác": "AI Songwriting",
  "Tập Đàn Cho Người Mới": "Beginner Practice",
};

const FORUM_CATEGORY_LABELS = {
  "Giao lưu Cover": "Cover Sharing",
  "Chia sẻ Chord Sheet": "Chord Sheet Sharing",
  "Hỏi đáp Kỹ thuật": "Technical Q&A",
  "Góc AI Sáng tác": "AI Songwriting",
};

export function getVibeTagLabel(value) {
  return VIBE_TAG_LABELS[value] || value || "Chill & Share";
}

export function getForumCategoryLabel(value) {
  return FORUM_CATEGORY_LABELS[value] || value;
}
