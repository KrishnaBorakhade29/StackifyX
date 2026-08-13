// routes/auth.js
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const {
  getRegister, postRegister,
  verifyEmail, resendVerification,
  getLogin, postLogin, logout,
  getForgotPassword, postForgotPassword,
  getResetPassword, postResetPassword,
} = require('../controllers/authController');
const { ensureGuest } = require('../middleware/auth');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Minimum 6 characters'),
  body('confirmPassword').custom((v, { req }) => {
    if (v !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
];

// Register & verify
router.get ('/register',                ensureGuest, getRegister);
router.post('/register',                ensureGuest, registerRules, postRegister);
router.get ('/verify-email/:token',     verifyEmail);
router.get ('/resend-verification',     resendVerification);
router.post('/resend-verification',     resendVerification);

// Login / logout
router.get ('/login',                   ensureGuest, getLogin);
router.post('/login',                   ensureGuest, loginRules, postLogin);
router.get ('/logout',                  logout);

// Password reset
router.get ('/forgot-password',         ensureGuest, getForgotPassword);
router.post('/forgot-password',         ensureGuest, postForgotPassword);
router.get ('/reset-password/:token',   ensureGuest, getResetPassword);
router.post('/reset-password/:token',   ensureGuest, postResetPassword);

module.exports = router;
