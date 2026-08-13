// routes/inquiries.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const { handleInquiryUpload } = require('../middleware/upload');
const {
  getInquiryForm,
  submitInquiry,
  getUserInquiries,
  adminGetInquiries,
  updateInquiryStatus,
  convertToProject
} = require('../controllers/inquiryController');

const inquiryValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 2000 }),
  body('budget').isNumeric().withMessage('Budget must be a number').isFloat({ min: 0 }),
  body('category').isIn(['web', 'mobile', 'desktop', 'api', 'database', 'other']).withMessage('Invalid category')
];

// User routes
router.get('/inquiries/new', ensureAuth, getInquiryForm);
router.post('/inquiries', ensureAuth, handleInquiryUpload, inquiryValidation, submitInquiry);
router.get('/inquiries', ensureAuth, getUserInquiries);

// Admin routes
router.get('/admin/inquiries', ensureAdmin, adminGetInquiries);
router.post('/admin/inquiries/:id/status', ensureAdmin, updateInquiryStatus);
router.post('/admin/inquiries/:id/convert', ensureAdmin, convertToProject);

module.exports = router;
