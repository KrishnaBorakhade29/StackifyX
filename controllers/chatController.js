// controllers/chatController.js
const Message = require('../models/Message');
const Project = require('../models/Project');

// @desc  Get chat for a project
// @route GET /chat/:projectId
const getChat = async (req, res) => {
  try {
    const { projectId } = req.params;

    // For users, verify project ownership
    let project;
    if (req.session.userRole === 'admin') {
      project = await Project.findById(projectId).populate('user', 'name email');
    } else {
      project = await Project.findOne({ _id: projectId, user: req.session.userId });
    }

    if (!project) {
      req.flash('error', 'Project not found or access denied.');
      return res.redirect('/dashboard');
    }

    const messages = await Message.find({ project: projectId })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 })
      .limit(100);

    // Mark messages as read
    await Message.updateMany(
      { project: projectId, senderRole: req.session.userRole === 'admin' ? 'user' : 'admin', isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.render('chat/index', {
      title: `Chat - ${project.title}`,
      project,
      messages,
      projectId,
      currentUserId: req.session.userId,
      userRole: req.session.userRole
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load chat.');
    res.redirect('/dashboard');
  }
};

// @desc  Send a message (REST fallback)
// @route POST /chat/:projectId/send
const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const { projectId } = req.params;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const message = await Message.create({
      project: projectId,
      sender: req.session.userId,
      senderRole: req.session.userRole,
      content: content.trim()
    });

    await message.populate('sender', 'name');

    res.json({ success: true, message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// @desc  Get messages (for polling or API)
// @route GET /chat/:projectId/messages
const getMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { after } = req.query;

    const filter = { project: projectId };
    if (after) filter.createdAt = { $gt: new Date(after) };

    const messages = await Message.find(filter)
      .populate('sender', 'name role')
      .sort({ createdAt: 1 })
      .limit(50);

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// @desc  Get unread message count
// @route GET /chat/unread
const getUnreadCount = async (req, res) => {
  try {
    const userProjects = await Project.find({ user: req.session.userId }).select('_id');
    const projectIds = userProjects.map(p => p._id);

    const count = await Message.countDocuments({
      project: { $in: projectIds },
      senderRole: 'admin',
      isRead: false
    });

    res.json({ success: true, count });
  } catch (err) {
    res.json({ success: false, count: 0 });
  }
};

module.exports = { getChat, sendMessage, getMessages, getUnreadCount };
