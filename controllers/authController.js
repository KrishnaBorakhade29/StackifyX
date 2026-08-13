// controllers/authController.js
const crypto = require('crypto');
const User   = require('../models/User');
const { validationResult } = require('express-validator');
const {
  sendWelcome,
  sendPasswordReset,
  sendVerificationEmail,
} = require('../utils/email');

// helpers
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const rawToken  = ()    => crypto.randomBytes(32).toString('hex');

// ─────────────────────────────────────────────────────────────────────────
// REGISTER — create account + send verification email (no auto-login)
// ─────────────────────────────────────────────────────────────────────────
const getRegister = (req, res) =>
  res.render('auth/register', { title: 'Create Account', errors: [], formData: {} });

const postRegister = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.render('auth/register', { title: 'Create Account', errors: errors.array(), formData: req.body });

  const { name, email, password, phone } = req.body;
  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // If already registered but not verified, offer to resend
      if (!existing.isVerified) {
        return res.render('auth/register', {
          title: 'Create Account',
          errors: [{ msg: 'Account exists but email not verified. <a href="/auth/resend-verification?email=' + encodeURIComponent(email) + '" style="color:var(--accent-blue)">Resend verification email →</a>' }],
          formData: req.body
        });
      }
      return res.render('auth/register', {
        title: 'Create Account',
        errors: [{ msg: 'An account with this email already exists.' }],
        formData: req.body
      });
    }

    // Generate verification token
    const token       = rawToken();
    const hashedTok   = hashToken(token);
    const verifyURL   = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email/${token}`;

    // Create user — NOT verified yet
    const user = await User.create({
      name, email, password, phone,
      isVerified:         false,
      emailVerifyToken:   hashedTok,
      emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(user, verifyURL)
      .catch(e => console.error('Verify email error:', e.message));

    // Show "check your email" page — no session set yet
    res.render('auth/check-email', {
      title: 'Check Your Email',
      email: user.email,
      name:  user.name,
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.render('auth/register', {
      title: 'Create Account',
      errors: [{ msg: 'Registration failed. Please try again.' }],
      formData: req.body
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL — user clicks the link in their inbox
// ─────────────────────────────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  const hashed = hashToken(req.params.token);
  try {
    const user = await User.findOne({
      emailVerifyToken:   hashed,
      emailVerifyExpires: { $gt: Date.now() },
    }).select('+emailVerifyToken +emailVerifyExpires');

    if (!user) {
      return res.render('auth/verify-result', {
        title:   'Verification Failed',
        success: false,
        message: 'This verification link is invalid or has expired.',
      });
    }

    // Activate account
    user.isVerified          = true;
    user.emailVerifyToken    = undefined;
    user.emailVerifyExpires  = undefined;
    await user.save({ validateBeforeSave: false });

    // Send welcome email now that they're verified
    sendWelcome(user).catch(e => console.error('Welcome email error:', e.message));

    res.render('auth/verify-result', {
      title:   'Email Verified!',
      success: true,
      message: 'Your email has been verified. You can now sign in.',
    });
  } catch (err) {
    console.error('Verify email error:', err);
    res.render('auth/verify-result', {
      title: 'Verification Failed', success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// RESEND VERIFICATION EMAIL
// ─────────────────────────────────────────────────────────────────────────
const resendVerification = async (req, res) => {
  const email = req.query.email || req.body.email;
  try {
    const user = await User.findOne({ email: email?.toLowerCase() })
      .select('+emailVerifyToken +emailVerifyExpires');

    if (!user || user.isVerified) {
      return res.render('auth/check-email', {
        title: 'Check Your Email', email, name: '',
        alreadyVerified: user?.isVerified,
      });
    }

    const token     = rawToken();
    const hashed    = hashToken(token);
    const verifyURL = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email/${token}`;

    user.emailVerifyToken   = hashed;
    user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    sendVerificationEmail(user, verifyURL)
      .catch(e => console.error('Resend verify error:', e.message));

    res.render('auth/check-email', { title: 'Check Your Email', email: user.email, name: user.name });
  } catch (err) {
    console.error('Resend verification error:', err);
    req.flash('error', 'Failed to resend. Please try again.');
    res.redirect('/auth/login');
  }
};

// ─────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────
const getLogin = (req, res) =>
  res.render('auth/login', { title: 'Login', errors: [], formData: {} });

const postLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.render('auth/login', { title: 'Login', errors: errors.array(), formData: req.body });

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password)))
      return res.render('auth/login', {
        title: 'Login',
        errors: [{ msg: 'Invalid email or password.' }],
        formData: req.body,
      });

    if (!user.isActive)
      return res.render('auth/login', {
        title: 'Login',
        errors: [{ msg: 'Your account has been deactivated. Contact support.' }],
        formData: req.body,
      });

    // Block unverified users (admins are auto-verified on seed)
    if (!user.isVerified)
      return res.render('auth/login', {
        title: 'Login',
        errors: [{
          msg: `Email not verified. <a href="/auth/resend-verification?email=${encodeURIComponent(email)}" style="color:var(--accent-blue);font-weight:600;">Resend verification email →</a>`
        }],
        formData: req.body,
      });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    req.session.userId   = user._id;
    req.session.userRole = user.role;

    req.flash('success', `Welcome back, ${user.name}!`);
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', {
      title: 'Login',
      errors: [{ msg: 'Login failed. Please try again.' }],
      formData: req.body,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────
const logout = (req, res) =>
  req.session.destroy(() => res.redirect('/auth/login'));

// ─────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────────────
const getForgotPassword = (req, res) =>
  res.render('auth/forgot-password', { title: 'Forgot Password', error: null, success: null });

const postForgotPassword = async (req, res) => {
  const { email } = req.body;
  const successMsg = "If that email is registered and verified, you'll receive a reset link shortly.";

  if (!email?.trim())
    return res.render('auth/forgot-password', {
      title: 'Forgot Password', success: null, error: 'Please enter your email address.',
    });

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.isVerified)
      return res.render('auth/forgot-password', { title: 'Forgot Password', error: null, success: successMsg });

    const token     = rawToken();
    const hashed    = hashToken(token);
    const resetURL  = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password/${token}`;

    user.resetPasswordToken   = hashed;
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    sendPasswordReset(user, resetURL)
      .catch(e => console.error('Reset email error:', e.message));

    res.render('auth/forgot-password', { title: 'Forgot Password', error: null, success: successMsg });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.render('auth/forgot-password', {
      title: 'Forgot Password', success: null, error: 'Something went wrong. Please try again.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────
const getResetPassword = async (req, res) => {
  const hashed = hashToken(req.params.token);
  try {
    const user = await User.findOne({
      resetPasswordToken:   hashed,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user)
      return res.render('auth/reset-password', {
        title: 'Reset Password', token: null, error: 'Link is invalid or expired.', success: null,
      });
    res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token, error: null, success: null });
  } catch (err) {
    res.render('auth/reset-password', {
      title: 'Reset Password', token: null, error: 'Something went wrong.', success: null,
    });
  }
};

const postResetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;
  const hashed = hashToken(req.params.token);

  if (!password || password.length < 6)
    return res.render('auth/reset-password', {
      title: 'Reset Password', token: req.params.token, error: 'Minimum 6 characters.', success: null,
    });
  if (password !== confirmPassword)
    return res.render('auth/reset-password', {
      title: 'Reset Password', token: req.params.token, error: 'Passwords do not match.', success: null,
    });

  try {
    const user = await User.findOne({
      resetPasswordToken:   hashed,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+password +resetPasswordToken +resetPasswordExpires');

    if (!user)
      return res.render('auth/reset-password', {
        title: 'Reset Password', token: null, error: 'Link is invalid or expired.', success: null,
      });

    user.password             = password;
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash('success', '✅ Password reset! Please sign in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Reset password error:', err);
    res.render('auth/reset-password', {
      title: 'Reset Password', token: req.params.token, error: 'Failed to reset. Try again.', success: null,
    });
  }
};

module.exports = {
  getRegister, postRegister,
  verifyEmail, resendVerification,
  getLogin, postLogin, logout,
  getForgotPassword, postForgotPassword,
  getResetPassword, postResetPassword,
};
