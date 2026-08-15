// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    // ============================================================
    // BASIC USER INFORMATION
    // ============================================================

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Invalid email',
      ],
    },

    // ============================================================
    // PASSWORD
    // ============================================================

    // Not required for Google accounts.
    // Normal StackifyX accounts still use a password.
    password: {
      type: String,
      minlength: 6,
      select: false,
    },

    // ============================================================
    // GOOGLE ACCOUNT
    // ============================================================

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    // ============================================================
    // USER ROLE
    // ============================================================

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    phone: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
    },

    // ============================================================
    // EMAIL VERIFICATION
    // ============================================================

    isVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifyToken: {
      type: String,
      select: false,
    },

    emailVerifyExpires: {
      type: Date,
      select: false,
    },

    // ============================================================
    // PASSWORD RESET
    // ============================================================

    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },

  },
  {
    timestamps: true,
  }
);


// ============================================================
// HASH PASSWORD BEFORE SAVING
// ============================================================

UserSchema.pre('save', async function (next) {

  // Google users don't have a password.
  // Also don't hash password if it wasn't changed.
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);

  next();
});


// ============================================================
// COMPARE PASSWORD
// ============================================================

UserSchema.methods.comparePassword = function (candidate) {

  if (!this.password) {
    return false;
  }

  return bcrypt.compare(candidate, this.password);
};


module.exports = mongoose.model('User', UserSchema);