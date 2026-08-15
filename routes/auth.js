// routes/auth.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  getRegister,
  postRegister,

  verifyEmail,
  resendVerification,

  getLogin,
  postLogin,

  googleLogin,
  googleCallback,

  logout,

  getForgotPassword,
  postForgotPassword,

  getResetPassword,
  postResetPassword,
} = require('../controllers/authController');

const { ensureGuest } = require('../middleware/auth');


// ============================================================
// REGISTER VALIDATION
// ============================================================

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 }),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Minimum 6 characters'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }

      return true;
    }),
];


// ============================================================
// LOGIN VALIDATION
// ============================================================

const loginRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password required'),
];


// ============================================================
// REGISTER & EMAIL VERIFICATION
// ============================================================

router.get(
  '/register',
  ensureGuest,
  getRegister
);

router.post(
  '/register',
  ensureGuest,
  registerRules,
  postRegister
);

router.get(
  '/verify-email/:token',
  verifyEmail
);

router.get(
  '/resend-verification',
  resendVerification
);

router.post(
  '/resend-verification',
  resendVerification
);


// ============================================================
// LOGIN
// ============================================================

router.get(
  '/login',
  ensureGuest,
  getLogin
);

router.post(
  '/login',
  ensureGuest,
  loginRules,
  postLogin
);


// ============================================================
// GOOGLE LOGIN / SIGN UP
// ============================================================

// Step 1:
// User clicks "Continue with Google"
router.get(
  '/google',
  ensureGuest,
  googleLogin
);


// Step 2:
// Google redirects the user back here
router.get(
  '/google/callback',
  ensureGuest,
  googleCallback
);


// ============================================================
// LOGOUT
// ============================================================

router.get(
  '/logout',
  logout
);


// ============================================================
// PASSWORD RESET
// ============================================================

router.get(
  '/forgot-password',
  ensureGuest,
  getForgotPassword
);

router.post(
  '/forgot-password',
  ensureGuest,
  postForgotPassword
);

router.get(
  '/reset-password/:token',
  ensureGuest,
  getResetPassword
);

router.post(
  '/reset-password/:token',
  ensureGuest,
  postResetPassword
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;