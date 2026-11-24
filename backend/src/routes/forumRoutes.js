const express = require('express');
const router = express.Router();
const {
  getAllPosts,
  createPost,
  toggleCheerPost,
  addReply,
} = require('../controllers/forumController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', getAllPosts);
router.post('/', protect, createPost);
router.post('/:id/cheer', protect, toggleCheerPost);
router.post('/:id/reply', protect, addReply);

module.exports = router;