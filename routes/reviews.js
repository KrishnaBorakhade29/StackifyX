// routes/reviews.js
const express = require('express');
const router = express.Router();
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const { submitReview, adminGetReviews } = require('../controllers/reviewController');

router.post('/reviews/:projectId', ensureAuth, submitReview);
router.get('/admin/reviews', ensureAdmin, adminGetReviews);

module.exports = router;
