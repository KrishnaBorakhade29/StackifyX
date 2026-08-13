// models/Review.js
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true // One review per project
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Review title cannot exceed 100 characters']
  },
  feedback: {
    type: String,
    required: [true, 'Feedback is required'],
    trim: true,
    maxlength: [1000, 'Feedback cannot exceed 1000 characters']
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  // Breakdown ratings
  communication: { type: Number, min: 1, max: 5 },
  quality: { type: Number, min: 1, max: 5 },
  timeliness: { type: Number, min: 1, max: 5 },
  value: { type: Number, min: 1, max: 5 }
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);
