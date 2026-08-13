// routes/payments.js
const express = require('express');
const router = express.Router();
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const { createOrder, verifyPayment, getUserPayments, adminGetPayments } = require('../controllers/paymentController');

router.post('/payments/create-order', ensureAuth, createOrder);
router.post('/payments/verify', ensureAuth, verifyPayment);
router.get('/payments', ensureAuth, getUserPayments);
router.get('/admin/payments', ensureAdmin, adminGetPayments);

module.exports = router;
