// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: [true,'Name is required'], trim: true, maxlength: 100 },
  email:    { type: String, required: [true,'Email is required'], unique: true, lowercase: true, trim: true,
              match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'] },
  password: { type: String, required: [true,'Password is required'], minlength: 6, select: false },
  role:     { type: String, enum: ['user','admin'], default: 'user' },
  phone:    { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  lastLogin:{ type: Date },

  // ── Email verification ───────────────────────────────
  isVerified:          { type: Boolean, default: false },
  emailVerifyToken:    { type: String, select: false },
  emailVerifyExpires:  { type: Date,   select: false },

  // ── Password reset ───────────────────────────────────
  resetPasswordToken:   { type: String, select: false },
  resetPasswordExpires: { type: Date,   select: false },

}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
