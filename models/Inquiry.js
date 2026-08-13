// models/Inquiry.js
const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    enum: ['web', 'mobile', 'desktop', 'api', 'database', 'other'],
    default: 'web'
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  timeline: {
    type: String,
    enum: ['1-week', '2-weeks', '1-month', '2-months', '3-months', 'flexible'],
    default: 'flexible'
  },
  techStack: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'converted'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', InquirySchema);
