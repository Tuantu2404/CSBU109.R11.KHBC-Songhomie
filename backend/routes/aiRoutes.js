const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { analyzeYoutube, analyzeAudio } = require("../controllers/aiController");

router.post("/from-youtube", protect, analyzeYoutube);
router.post("/from-audio", protect, analyzeAudio);

module.exports = router;
