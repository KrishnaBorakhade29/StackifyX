// socket.js - Socket.IO real-time chat handler
const Message = require('./models/Message');
const Project = require('./models/Project');

const setupSocket = (io, sessionMiddleware) => {
  // Use session middleware with socket
  io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
  });

  // Auth check for socket connections
  io.use((socket, next) => {
    if (socket.request.session && socket.request.session.userId) {
      socket.userId = socket.request.session.userId.toString();
      socket.userRole = socket.request.session.userRole;
      next();
    } else {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.userId} (${socket.userRole})`);

    // Join project room
    socket.on('join-project', async (projectId) => {
      try {
        // Verify access
        let project;
        if (socket.userRole === 'admin') {
          project = await Project.findById(projectId);
        } else {
          project = await Project.findOne({ _id: projectId, user: socket.userId });
        }

        if (!project) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`project-${projectId}`);
        socket.currentProject = projectId;
        console.log(`📍 User ${socket.userId} joined room project-${projectId}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle new message
    socket.on('send-message', async (data) => {
      try {
        const { projectId, content } = data;

        if (!content || !content.trim()) return;
        if (!socket.currentProject || socket.currentProject !== projectId) return;

        const message = await Message.create({
          project: projectId,
          sender: socket.userId,
          senderRole: socket.userRole,
          content: content.trim()
        });

        await message.populate('sender', 'name role');

        // Emit to all in room
        io.to(`project-${projectId}`).emit('new-message', {
          _id: message._id,
          content: message.content,
          senderRole: message.senderRole,
          sender: message.sender,
          createdAt: message.createdAt,
          isRead: false
        });
      } catch (err) {
        console.error('Socket message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(`project-${data.projectId}`).emit('user-typing', {
        userId: socket.userId,
        role: socket.userRole
      });
    });

    socket.on('stop-typing', (data) => {
      socket.to(`project-${data.projectId}`).emit('user-stop-typing');
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
  });
};

module.exports = setupSocket;
