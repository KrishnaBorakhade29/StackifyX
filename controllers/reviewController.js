// controllers/reviewController.js
const Review = require('../models/Review');
const Project = require('../models/Project');

// @desc  Submit review
// @route POST /reviews/:projectId
const submitReview = async (req, res) => {
  try {
    const { rating, title, feedback, communication, quality, timeliness, value } = req.body;

    // Verify project belongs to user and is completed
    const project = await Project.findOne({
      _id: req.params.projectId,
      user: req.session.userId,
      status: 'completed'
    });

    if (!project) {
      req.flash('error', 'Project not found or not yet completed.');
      return res.redirect('/dashboard');
    }

    // Check for existing review
    const existingReview = await Review.findOne({ project: project._id });
    if (existingReview) {
      req.flash('error', 'You have already submitted a review for this project.');
      return res.redirect(`/projects/${project._id}`);
    }

    await Review.create({
      project: project._id,
      user: req.session.userId,
      rating: parseInt(rating),
      title,
      feedback,
      communication: parseInt(communication) || undefined,
      quality: parseInt(quality) || undefined,
      timeliness: parseInt(timeliness) || undefined,
      value: parseInt(value) || undefined
    });

    req.flash('success', 'Thank you for your review! Your feedback means a lot to us.');
    res.redirect(`/projects/${project._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to submit review.');
    res.redirect(`/projects/${req.params.projectId}`);
  }
};

// @desc  Get all reviews (admin)
// @route GET /admin/reviews
const adminGetReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('project', 'title')
      .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    res.render('admin/reviews', { title: 'Reviews & Ratings', reviews, avgRating });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load reviews.');
    res.redirect('/admin/dashboard');
  }
};

module.exports = { submitReview, adminGetReviews };
