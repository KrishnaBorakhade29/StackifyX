// app.js
require('dotenv').config();
const express= require('express');
const http= require('http');
const socketIO= require('socket.io');
const path= require('path');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const flash        = require('connect-flash');
const methodOverride = require('method-override');

const connectDB    = require('./config/db');
const { attachUser } = require('./middleware/auth');
const setupSocket  = require('./socket');

connectDB();

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server, { cors: { origin: '*', methods: ['GET','POST'] } });

// ─── TRUST PROXY ──────────────────────────────────────────────────────────
// CRITICAL for Render (and any cloud behind a load balancer):
// Without this, session cookies marked secure:true never get set because
// Express sees HTTP (from the proxy) instead of the real HTTPS connection.
app.set('trust proxy', 1);

// ─── VIEW ENGINE ──────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── STATIC FILES ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── BODY / METHOD ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// ─── SESSION ──────────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

const sessionMiddleware = session({
  secret:            process.env.SESSION_SECRET || 'devcraft_secret_2024',
  resave:            false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl:   process.env.MONGO_URI,
    touchAfter: 24 * 3600,
  }),
  cookie: {
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure:   isProduction,   // true on Render (HTTPS), false locally
    sameSite: isProduction ? 'none' : 'lax',  // 'none' required with secure:true
  },
});

app.use(sessionMiddleware);

// ─── FLASH + LOCALS ───────────────────────────────────────────────────────
app.use(flash());
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.successMsg = req.flash('success');
  res.locals.errorMsg   = req.flash('error');
  res.locals.appName    = 'StackifyX';
  next();
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────
setupSocket(io, sessionMiddleware);

// ─── ROUTES ───────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/',     require('./routes/projects'));
app.use('/',     require('./routes/inquiries'));
app.use('/',     require('./routes/payments'));
app.use('/',     require('./routes/chat'));
app.use('/',     require('./routes/reviews'));

// Landing
app.get('/', (req, res) => {
  if (req.session.userId)
    return res.redirect(req.session.userRole === 'admin' ? '/admin/dashboard' : '/dashboard');
  res.render('landing', { title: 'StackifyX - Professional Project Services' });
});

// 404
app.use((req, res) =>
  res.status(404).render('error', { title: '404', code: 404, message: 'Page not found' }));

// 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: '500', code: 500, message: 'Something went wrong' });
});

// ─── ADMIN SEEDER ─────────────────────────────────────────────────────────
const seedAdmin = async () => {
  try {
    const User = require('./models/User');
    const exists = await User.findOne({ role: 'admin' });
    if (!exists) {
      await User.create({
        name:       process.env.ADMIN_NAME     || 'Admin',
        email:      process.env.ADMIN_EMAIL    || 'admin@devcraft.com',
        password:   process.env.ADMIN_PASSWORD || 'Admin@123456',
        role:       'admin',
        isVerified: true,   // admin never needs email verification
      });
      console.log('✅ Admin created:', process.env.ADMIN_EMAIL || 'admin@devcraft.com');
    } else if (!exists.isVerified) {
      // Fix existing admin if isVerified was not set
      await User.findByIdAndUpdate(exists._id, { isVerified: true });
      console.log('✅ Admin isVerified flag fixed.');
    }
  } catch (err) {
    console.error('Admin seeder error:', err.message);
  }
};

// ─── START ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await seedAdmin();
  const { verifyEmailConfig } = require('./utils/email');
  await verifyEmailConfig();
  console.log(`\n🚀 StackifyX → http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Trust proxy : ${isProduction ? 'ON (Render mode)' : 'OFF (local mode)'}\n`);
});

module.exports = { app, server };
