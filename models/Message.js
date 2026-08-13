// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  fileData: {
    filename: String,
    originalName: String,
    path: String,
    size: Number
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
