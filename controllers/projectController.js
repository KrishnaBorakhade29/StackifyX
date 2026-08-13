// controllers/projectController.js
const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const { sendProjectStarted, sendProjectCompleted } = require('../utils/email');

// @desc  User dashboard
// @route GET /dashboard
const userDashboard = async (req, res) => {
  try {
    const [projects, recentProjects] = await Promise.all([
      Project.find({ user: req.session.userId }).sort({ createdAt: -1 }),
      Project.find({ user: req.session.userId }).sort({ updatedAt: -1 }).limit(3)
    ]);

    const stats = {
      total: projects.length,
      inProgress: projects.filter(p => p.status === 'in-progress').length,
      completed: projects.filter(p => p.status === 'completed').length,
      pending: projects.filter(p => p.status === 'pending').length,
      totalPaid: projects.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
      totalDue: projects.reduce((sum, p) => sum + Math.max(0, p.price - (p.amountPaid || 0)), 0)
    };

    const Inquiry = require('../models/Inquiry');
    const inquiries = await Inquiry.find({ user: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('user/dashboard', {
      title: 'My Dashboard',
      projects: recentProjects,
      allProjects: projects,
      stats,
      inquiries
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load dashboard.');
    res.render('user/dashboard', { title: 'Dashboard', projects: [], allProjects: [], stats: {}, inquiries: [] });
  }
};

// @desc  Get single project (user)
// @route GET /projects/:id
const getProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      user: req.session.userId
    });

    if (!project) {
      req.flash('error', 'Project not found.');
      return res.redirect('/dashboard');
    }

    const [payments, review] = await Promise.all([
      Payment.find({ project: project._id }).sort({ createdAt: -1 }),
      Review.findOne({ project: project._id })
    ]);

    res.render('user/project', {
      title: project.title,
      project,
      payments,
      review,
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load project.');
    res.redirect('/dashboard');
  }
};

// ===== ADMIN ROUTES =====

// @desc  Admin dashboard
// @route GET /admin/dashboard
const adminDashboard = async (req, res) => {
  try {
    const User = require('../models/User');

    const [
      totalUsers, totalProjects, completedProjects,
      inProgressProjects, totalPayments, recentProjects, recentUsers
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Project.countDocuments(),
      Project.countDocuments({ status: 'completed' }),
      Project.countDocuments({ status: 'in-progress' }),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Project.find().populate('user', 'name email').sort({ updatedAt: -1 }).limit(5),
      User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(5)
    ]);

    // Monthly revenue chart data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'captured', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const totalRevenue = totalPayments.length > 0 ? totalPayments[0].total / 100 : 0; // Convert from paise

    const Inquiry = require('../models/Inquiry');
    const pendingInquiries = await Inquiry.countDocuments({ status: 'pending' });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        totalProjects,
        completedProjects,
        inProgressProjects,
        totalRevenue,
        pendingInquiries
      },
      recentProjects,
      recentUsers,
      monthlyRevenue: JSON.stringify(monthlyRevenue)
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load admin dashboard.');
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {},
      recentProjects: [],
      recentUsers: [],
      monthlyRevenue: '[]'
    });
  }
};

// @desc  Get all projects (admin)
// @route GET /admin/projects
const adminGetProjects = async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/projects', {
      title: 'Manage Projects',
      projects,
      currentPage: parseInt(page),
      totalPages,
      status: status || '',
      total
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load projects.');
    res.redirect('/admin/dashboard');
  }
};

// @desc  Get single project (admin)
// @route GET /admin/projects/:id
const adminGetProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('user', 'name email phone');
    if (!project) {
      req.flash('error', 'Project not found.');
      return res.redirect('/admin/projects');
    }

    const payments = await Payment.find({ project: project._id }).sort({ createdAt: -1 });
    const review = await Review.findOne({ project: project._id }).populate('user', 'name');

    res.render('admin/project-detail', {
      title: `Project: ${project.title}`,
      project,
      payments,
      review
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load project.');
    res.redirect('/admin/projects');
  }
};

// @desc  Update project (admin)
// @route POST /admin/projects/:id/update
const adminUpdateProject = async (req, res) => {
  try {
    const { status, progress, adminNotes, githubLink, liveLink, price, deadline } = req.body;
    const project = await Project.findById(req.params.id).populate('user');

    if (!project) {
      req.flash('error', 'Project not found.');
      return res.redirect('/admin/projects');
    }

    const prevStatus = project.status;

    const updateData = {
      status,
      progress: parseInt(progress) || project.progress,
      adminNotes,
      githubLink,
      liveLink
    };

    if (price) updateData.price = parseFloat(price);
    if (deadline) updateData.deadline = new Date(deadline);

    // Set timestamps based on status
    if (status === 'in-progress' && prevStatus !== 'in-progress') {
      updateData.startedAt = new Date();
    }
    if (status === 'completed' && prevStatus !== 'completed') {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    }

    await Project.findByIdAndUpdate(project._id, updateData);

    // ── Email notifications (non-blocking) ──────────────────────────────
    if (project.user) {
      const updatedProject = { ...project.toObject(), ...updateData };
      if (status === 'in-progress' && prevStatus !== 'in-progress') {
        sendProjectStarted(project.user, updatedProject)
          .catch(e => console.error('Project-started email error:', e.message));
      }
      if (status === 'completed' && prevStatus !== 'completed') {
        sendProjectCompleted(project.user, updatedProject)
          .catch(e => console.error('Project-completed email error:', e.message));
      }
    }

    req.flash('success', 'Project updated successfully.');
    res.redirect(`/admin/projects/${project._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update project.');
    res.redirect(`/admin/projects/${req.params.id}`);
  }
};

// @desc  Upload project files (admin)
// @route POST /admin/projects/:id/files
const adminUploadFiles = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      req.flash('error', 'Project not found.');
      return res.redirect('/admin/projects');
    }

    if (!req.files || req.files.length === 0) {
      req.flash('error', 'No files selected.');
      return res.redirect(`/admin/projects/${project._id}`);
    }

    const newFiles = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/projects/${file.filename}`,
      size: file.size
    }));

    await Project.findByIdAndUpdate(project._id, {
      $push: { files: { $each: newFiles } }
    });

    req.flash('success', `${newFiles.length} file(s) uploaded successfully.`);
    res.redirect(`/admin/projects/${project._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'File upload failed.');
    res.redirect(`/admin/projects/${req.params.id}`);
  }
};

// @desc  Add milestone (admin)
// @route POST /admin/projects/:id/milestone
const adminAddMilestone = async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    await Project.findByIdAndUpdate(req.params.id, {
      $push: { milestones: { title, description, dueDate: dueDate ? new Date(dueDate) : undefined } }
    });
    req.flash('success', 'Milestone added.');
    res.redirect(`/admin/projects/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Failed to add milestone.');
    res.redirect(`/admin/projects/${req.params.id}`);
  }
};

// @desc  Toggle milestone completion (admin)
// @route POST /admin/projects/:id/milestone/:milestoneId
const adminToggleMilestone = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    const milestone = project.milestones.id(req.params.milestoneId);
    if (milestone) {
      milestone.completed = !milestone.completed;
      milestone.completedAt = milestone.completed ? new Date() : undefined;
      await project.save();
    }
    res.redirect(`/admin/projects/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Failed to update milestone.');
    res.redirect(`/admin/projects/${req.params.id}`);
  }
};

// @desc  Get all users (admin)
// @route GET /admin/users
const adminGetUsers = async (req, res) => {
  try {
    const User = require('../models/User');
    const { page = 1 } = req.query;
    const limit = 15;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ role: 'user' }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments({ role: 'user' })
    ]);

    // Get project counts for each user
    const userIds = users.map(u => u._id);
    const projectCounts = await Project.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    projectCounts.forEach(pc => { countMap[pc._id.toString()] = pc.count; });

    const usersWithCounts = users.map(u => ({
      ...u.toObject(),
      projectCount: countMap[u._id.toString()] || 0
    }));

    res.render('admin/users', {
      title: 'Manage Users',
      users: usersWithCounts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load users.');
    res.redirect('/admin/dashboard');
  }
};

// @desc  Toggle user active status
// @route POST /admin/users/:id/toggle
const adminToggleUser = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.id);
    if (user) {
      user.isActive = !user.isActive;
      await user.save({ validateBeforeSave: false });
    }
    req.flash('success', `User ${user.isActive ? 'activated' : 'deactivated'}.`);
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Failed to update user.');
    res.redirect('/admin/users');
  }
};

module.exports = {
  userDashboard,
  getProject,
  adminDashboard,
  adminGetProjects,
  adminGetProject,
  adminUpdateProject,
  adminUploadFiles,
  adminAddMilestone,
  adminToggleMilestone,
  adminGetUsers,
  adminToggleUser
};
