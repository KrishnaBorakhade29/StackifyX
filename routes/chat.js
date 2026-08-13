// routes/chat.js
const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const { getChat, sendMessage, getMessages, getUnreadCount } = require('../controllers/chatController');

router.get('/chat/:projectId', ensureAuth, getChat);
router.post('/chat/:projectId/send', ensureAuth, sendMessage);
router.get('/chat/:projectId/messages', ensureAuth, getMessages);
router.get('/chat/unread/count', ensureAuth, getUnreadCount);

module.exports = router;
