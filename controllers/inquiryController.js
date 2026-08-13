// controllers/inquiryController.js
const Inquiry = require('../models/Inquiry');
const Project = require('../models/Project');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { sendInquiryAccepted } = require('../utils/email');

// @desc  Show inquiry form
// @route GET /inquiries/new
const getInquiryForm = (req, res) => {
  res.render('user/inquiry-form', { title: 'Submit Project Request', errors: [], formData: {} });
};

// @desc  Submit inquiry
// @route POST /inquiries
const submitInquiry = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('user/inquiry-form', {
      title: 'Submit Project Request',
      errors: errors.array(),
      formData: req.body
    });
  }

  try {
    const { title, description, category, budget, timeline, techStack } = req.body;

    // Process uploaded files
    const attachments = (req.files || []).map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/inquiries/${file.filename}`,
      size: file.size
    }));

    // Parse tech stack from comma-separated string
    const techStackArray = techStack
      ? techStack.split(',').map(t => t.trim()).filter(t => t)
      : [];

    const inquiry = await Inquiry.create({
      user: req.session.userId,
      title,
      description,
      category,
      budget: parseFloat(budget),
      timeline,
      techStack: techStackArray,
      attachments
    });

    req.flash('success', 'Your project request has been submitted! We\'ll review it shortly.');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Inquiry submit error:', err);
    req.flash('error', 'Failed to submit request. Please try again.');
    res.redirect('/inquiries/new');
  }
};

// @desc  Get user's inquiries
// @route GET /inquiries
const getUserInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ user: req.session.userId })
      .sort({ createdAt: -1 });

    res.render('user/inquiries', { title: 'My Inquiries', inquiries });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load inquiries.');
    res.redirect('/dashboard');
  }
};

// ===== ADMIN ROUTES =====

// @desc  Get all inquiries (admin)
// @route GET /admin/inquiries
const adminGetInquiries = async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;

    const [inquiries, total] = await Promise.all([
      Inquiry.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Inquiry.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/inquiries', {
      title: 'Manage Inquiries',
      inquiries,
      currentPage: parseInt(page),
      totalPages,
      status: status || '',
      total
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load inquiries.');
    res.redirect('/admin/dashboard');
  }
};

// @desc  Update inquiry status (admin)
// @route POST /admin/inquiries/:id/status
const updateInquiryStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { status, adminNote },
      { new: true }
    ).populate('user');

    if (!inquiry) {
      req.flash('error', 'Inquiry not found.');
      return res.redirect('/admin/inquiries');
    }

    // Send email on acceptance (non-blocking)
    if (status === 'accepted' && inquiry.user) {
      sendInquiryAccepted(inquiry.user, inquiry)
        .catch(e => console.error('Inquiry-accepted email error:', e.message));
    }

    req.flash('success', `Inquiry ${status} successfully.`);
    res.redirect('/admin/inquiries');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update inquiry.');
    res.redirect('/admin/inquiries');
  }
};

// @desc  Convert inquiry to project (admin)
// @route POST /admin/inquiries/:id/convert
const convertToProject = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id).populate('user');
    if (!inquiry) {
      req.flash('error', 'Inquiry not found.');
      return res.redirect('/admin/inquiries');
    }

    const { price, deadline, adminNotes } = req.body;

    const project = await Project.create({
      inquiry: inquiry._id,
      user: inquiry.user._id,
      title: inquiry.title,
      description: inquiry.description,
      category: inquiry.category,
      price: parseFloat(price),
      deadline: new Date(deadline),
      techStack: inquiry.techStack,
      adminNotes,
      status: 'pending'
    });

    // Mark inquiry as converted
    await Inquiry.findByIdAndUpdate(inquiry._id, { status: 'converted' });

    req.flash('success', `Project created successfully for ${inquiry.user.name}.`);
    res.redirect(`/admin/projects/${project._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to convert inquiry to project.');
    res.redirect('/admin/inquiries');
  }
};

module.exports = {
  getInquiryForm,
  submitInquiry,
  getUserInquiries,
  adminGetInquiries,
  updateInquiryStatus,
  convertToProject
};
