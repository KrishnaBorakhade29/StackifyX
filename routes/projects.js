// routes/projects.js
const express = require('express');
const router = express.Router();
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const { handleProjectUpload } = require('../middleware/upload');
const {
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
} = require('../controllers/projectController');

// User routes
router.get('/dashboard', ensureAuth, userDashboard);
router.get('/projects/:id', ensureAuth, getProject);

// Admin routes
router.get('/admin/dashboard', ensureAdmin, adminDashboard);
router.get('/admin/projects', ensureAdmin, adminGetProjects);
router.get('/admin/projects/:id', ensureAdmin, adminGetProject);
router.post('/admin/projects/:id/update', ensureAdmin, adminUpdateProject);
router.post('/admin/projects/:id/files', ensureAdmin, handleProjectUpload, adminUploadFiles);
router.post('/admin/projects/:id/milestone', ensureAdmin, adminAddMilestone);
router.post('/admin/projects/:id/milestone/:milestoneId', ensureAdmin, adminToggleMilestone);
router.get('/admin/users', ensureAdmin, adminGetUsers);
router.post('/admin/users/:id/toggle', ensureAdmin, adminToggleUser);

module.exports = router;
