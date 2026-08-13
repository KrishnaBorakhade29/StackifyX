// controllers/paymentController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Project = require('../models/Project');

// Initialize Razorpay
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

// @desc  Create Razorpay order
// @route POST /payments/create-order
const createOrder = async (req, res) => {
  try {
    const { projectId, amount } = req.body;

    const project = await Project.findOne({
      _id: projectId,
      user: req.session.userId
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        projectId: project._id.toString(),
        userId: req.session.userId.toString(),
        projectTitle: project.title
      }
    });

    // Save payment record
    const payment = await Payment.create({
      project: project._id,
      user: req.session.userId,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: 'created',
      receipt: order.receipt,
      description: `Payment for: ${project.title}`
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      projectTitle: project.title,
      userEmail: req.session.userEmail,
      userName: req.session.userName
    });
  } catch (err) {
    console.error('Payment order error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create payment order' });
  }
};

// @desc  Verify payment signature
// @route POST /payments/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, projectId } = req.body;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'captured'
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Update project payment status
    const project = await Project.findById(projectId);
    if (project) {
      const newAmountPaid = (project.amountPaid || 0) + (payment.amount / 100);
      const paymentStatus = newAmountPaid >= project.price ? 'paid' : 'partial';

      await Project.findByIdAndUpdate(projectId, {
        amountPaid: newAmountPaid,
        paymentStatus
      });
    }

    res.json({ success: true, message: 'Payment verified successfully', paymentId: payment._id });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

// @desc  Get payment history (user)
// @route GET /payments
const getUserPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.session.userId })
      .populate('project', 'title')
      .sort({ createdAt: -1 });

    res.render('user/payments', { title: 'Payment History', payments });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load payments.');
    res.redirect('/dashboard');
  }
};

// @desc  Get all payments (admin)
// @route GET /admin/payments
const adminGetPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'captured' })
      .populate('user', 'name email')
      .populate('project', 'title')
      .sort({ createdAt: -1 });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0) / 100;

    res.render('admin/payments', { title: 'Payment Records', payments, totalRevenue });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load payments.');
    res.redirect('/admin/dashboard');
  }
};

module.exports = { createOrder, verifyPayment, getUserPayments, adminGetPayments };
