// utils/email.js
//
// ┌─────────────────────────────────────────────────────────────┐
// │  LOCAL   → Gmail SMTP (Nodemailer)  — already works ✅      │
// │  RENDER  → Brevo HTTP API           — no domain needed ✅   │
// └─────────────────────────────────────────────────────────────┘
//
// WHY BREVO ON RENDER?
//   Render blocks all outbound SMTP ports (25, 465, 587) on free tier.
//   Gmail SMTP will NEVER work on Render — it's a hard network block.
//   Brevo uses HTTPS (port 443) which is never blocked anywhere.
//   Brevo free plan: 300 emails/day, 9000/month — NO domain needed,
//   just verify your email address once in the Brevo dashboard.
//
// SETUP (one-time, ~5 minutes):
//   1. Go to https://app.brevo.com  →  Sign up free
//   2. Settings → Senders & IP → Add your Gmail as a Sender
//   3. Verify it via the email Brevo sends you
//   4. Settings → SMTP & API → API Keys → Generate an API key
//   5. Add to Render dashboard → Environment:
//        BREVO_API_KEY     = xkeysib-xxxxxxxxxxxxxxxx
//        BREVO_SENDER_NAME = StackifyX
//        BREVO_SENDER_EMAIL= your_gmail@gmail.com   ← must be verified in Brevo

const nodemailer = require('nodemailer');
const https      = require('https');   // built-in — no extra install needed

// ─── Which provider? ──────────────────────────────────────────────────────
// Uses Brevo if BREVO_API_KEY is set OR if running in production.
// Falls back to Gmail SMTP for local development.
const useBrevo = () =>
  !!process.env.BREVO_API_KEY;

// ─── Credential guards ────────────────────────────────────────────────────
const smtpReady = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Gmail SMTP: EMAIL_USER or EMAIL_PASS missing — email skipped.');
    return false;
  }
  return true;
};

const brevoReady = () => {
  if (!process.env.BREVO_API_KEY) {
    console.warn('⚠️  Brevo: BREVO_API_KEY missing — email skipped.');
    console.warn('   → Sign up free at https://app.brevo.com and add the key to Render env vars.');
    return false;
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    console.warn('⚠️  Brevo: BREVO_SENDER_EMAIL missing — email skipped.');
    return false;
  }
  return true;
};

// ─── Send via Brevo HTTPS API (Render / production) ───────────────────────
const sendViaBrevo = ({ to, subject, html }) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: {
        name:  process.env.BREVO_SENDER_NAME  || 'StackifyX',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    const options = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'api-key':        process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = JSON.parse(body);
          console.log(`📧 Brevo sent → ${to} [messageId: ${data.messageId}]`);
          resolve(data);
        } else {
          reject(new Error(`Brevo API ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Brevo request timeout'));
    });
    req.write(payload);
    req.end();
  });
};

// ─── Send via Gmail SMTP (local development) ──────────────────────────────
const sendViaSmtp = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
    socketTimeout:     15000,
  });

  const info = await transporter.sendMail({
    from:    `"StackifyX" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to, subject, html,
  });
  console.log(`📧 Gmail SMTP sent → ${to} [id: ${info.messageId}]`);
};

// ─── Master send (never throws — email failure never crashes a request) ───
const sendEmail = async ({ to, subject, html }) => {
  try {
    if (useBrevo()) {
      if (!brevoReady()) return;
      await sendViaBrevo({ to, subject, html });
    } else {
      if (!smtpReady()) return;
      await sendViaSmtp({ to, subject, html });
    }
  } catch (err) {
    console.error(`❌ Email FAILED → ${to}`);
    console.error('   Reason:', err.message);

    // Helpful hints
    if (err.message?.includes('EAUTH') || err.message?.includes('535')) {
      console.error('   Gmail fix: use an App Password (not your login password).');
      console.error('   Path: Google Account → Security → 2FA → App Passwords');
    }
    if (err.message?.includes('Brevo') || err.message?.includes('401')) {
      console.error('   Brevo fix: check BREVO_API_KEY and BREVO_SENDER_EMAIL in Render env vars.');
      console.error('   Sender email must be verified at: https://app.brevo.com → Senders & IP');
    }
  }
};

// ─── Startup check ─────────────────────────────────────────────────────────
const verifyEmailConfig = async () => {
  if (useBrevo()) {
    if (!brevoReady()) return false;
    console.log('✅ Email provider : Brevo HTTP API  (works on Render ✓)');
    console.log(`   Sender email   : ${process.env.BREVO_SENDER_EMAIL}`);
    return true;
  } else {
    if (!smtpReady()) return false;
    try {
      const t = nodemailer.createTransport({
        host:  process.env.EMAIL_HOST || 'smtp.gmail.com',
        port:  parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth:  { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        tls:   { rejectUnauthorized: false },
      });
      await t.verify();
      console.log('✅ Email provider : Gmail SMTP  (local ✓)');
      return true;
    } catch (err) {
      console.error('❌ Gmail SMTP failed:', err.message);
      if (err.code === 'EAUTH')
        console.error('   Use a Gmail App Password, not your login password.');
      return false;
    }
  }
};

// ─── HTML base template ───────────────────────────────────────────────────
const base = (content, title) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:#07070f;color:#e2e8f0}
.wrap{max-width:600px;margin:40px auto;background:#111118;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.07)}
.hdr{background:linear-gradient(135deg,#63b3ed,#a78bfa);padding:44px 36px;text-align:center}
.hdr h1{color:#fff;font-size:26px;font-weight:800;margin-bottom:6px}
.hdr p{color:rgba(255,255,255,.75);font-size:14px}
.bdy{padding:40px 36px}
.bdy p{color:#94a3b8;line-height:1.75;margin-bottom:16px;font-size:15px}
.badge{display:inline-block;padding:6px 16px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:24px}
.bs{background:#064e3b;color:#10b981}
.bi{background:#0c4a6e;color:#38bdf8}
.bw{background:#3b0764;color:#c084fc}
.br{background:#450a0a;color:#fca5a5}
.ic{background:#1a1a26;border-radius:12px;padding:20px 24px;margin:20px 0;border-left:4px solid #63b3ed}
.ic h3{color:#e2e8f0;font-size:16px;font-weight:700;margin-bottom:6px}
.ic p{color:#8888aa;font-size:14px;margin:0;line-height:1.6}
.btn{display:inline-block;background:linear-gradient(135deg,#63b3ed,#a78bfa);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:24px}
.divider{height:1px;background:rgba(255,255,255,.07);margin:28px 0}
.ftr{background:#0c0c14;padding:28px 36px;text-align:center}
.ftr p{color:#475569;font-size:13px;line-height:1.6}
.ftr strong{color:#63b3ed}
</style></head>
<body><div class="wrap">
<div class="hdr">
<img src="https://stackifyx.onrender.com/stackifyx-logo.jpg" alt="StackifyX" style="width:52px;height:52px;border-radius:12px;background:#fff;padding:3px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
<h1>StackifyX</h1>
<p>Your Personal Project Service Platform</p>
</div>
<div class="bdy">${content}</div>
<div class="ftr">
  <p>© ${new Date().getFullYear()} <strong>StackifyX</strong>. All rights reserved.</p>
  <p style="margin-top:6px">If you didn't expect this email, you can safely ignore it.</p>
</div></div></body></html>`;

// ─── Email functions ──────────────────────────────────────────────────────
const sendWelcome = (user) => sendEmail({
  to: user.email,
  subject: '🎉 Welcome to StackifyX!',
  html: base(`
    <span class="badge bw">👋 Welcome aboard</span>
    <p>Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
    <p>Your account is ready! Submit project requests, track progress live, and chat directly with our StackifyX team.</p>
    <div class="ic">
      <h3>🚀 Get started in 3 steps</h3>
      <p>1. Submit a project inquiry with your requirements &amp; budget<br>
         2. We review and accept within 24 hours<br>
         3. Track progress and chat with us anytime</p>
    </div>
    <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" class="btn">Go to Dashboard →</a>
  `, 'Welcome'),
});

const sendInquiryAccepted = (user, inquiry) => sendEmail({
  to: user.email,
  subject: `✅ Inquiry accepted — ${inquiry.title}`,
  html: base(`
    <span class="badge bs">✓ Accepted</span>
    <p>Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
    <p>Great news! We reviewed your inquiry and we're excited to move forward.</p>
    <div class="ic">
      <h3>📋 ${inquiry.title}</h3>
      <p>${inquiry.description.substring(0,180)}${inquiry.description.length>180?'…':''}</p>
    </div>
    <p style="font-size:13px;color:#64748b">Budget: ₹${Number(inquiry.budget).toLocaleString('en-IN')} &nbsp;|&nbsp; Category: ${inquiry.category} &nbsp;|&nbsp; Timeline: ${inquiry.timeline}</p>
    <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" class="btn">View Dashboard →</a>
  `, 'Inquiry Accepted'),
});

const sendProjectStarted = (user, project) => sendEmail({
  to: user.email,
  subject: `🚀 Development started — ${project.title}`,
  html: base(`
    <span class="badge bi">🚀 Started</span>
    <p>Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
    <p>Development on your project has officially kicked off! Track live progress from your dashboard.</p>
    <div class="ic">
      <h3>🏗️ ${project.title}</h3>
      <p>Deadline: <strong style="color:#63b3ed">${project.deadline ? new Date(project.deadline).toLocaleDateString('en-IN',{dateStyle:'long'}) : 'TBD'}</strong><br>
         Price: <strong style="color:#63b3ed">₹${Number(project.price).toLocaleString('en-IN')}</strong></p>
    </div>
    <a href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project._id}" class="btn">Track Your Project →</a>
  `, 'Project Started'),
});

const sendProjectCompleted = (user, project) => sendEmail({
  to: user.email,
  subject: `🎉 Project complete — ${project.title}`,
  html: base(`
    <span class="badge bs">🎉 Complete</span>
    <p>Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
    <p>Your project is done and ready for delivery! Head to your dashboard to download all files.</p>
    <div class="ic">
      <h3>✅ ${project.title}</h3>
      <p>All deliverables uploaded. Please leave a review — it really helps us!</p>
    </div>
    <a href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project._id}" class="btn">View &amp; Download →</a>
  `, 'Project Completed'),
});

const sendPasswordReset = (user, resetURL) => sendEmail({
  to: user.email,
  subject: '🔐 Reset your StackifyX password',
  html: base(`
    <span class="badge br">🔐 Password Reset</span>
    <p>Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
    <p>We received a request to reset your password. This link expires in <strong style="color:#e2e8f0">30 minutes</strong>.</p>
    <div class="ic">
      <h3>⚠️ Didn't request this?</h3>
      <p>If you didn't ask for a reset, ignore this email — your password won't change.</p>
    </div>
    <a href="${resetURL}" class="btn">Reset My Password →</a>
    <div class="divider"></div>
    <p style="font-size:12px;color:#64748b;word-break:break-all">Or copy: ${resetURL}</p>
  `, 'Reset Password'),
});

module.exports = {
  verifyEmailConfig,
  sendWelcome,
  sendInquiryAccepted,
  sendProjectStarted,
  sendProjectCompleted,
  sendPasswordReset,
};

// ─── 6. Email Verification ────────────────────────────────────────────────
const sendVerificationEmail = (user, verifyURL) => sendEmail({
  to: user.email,
  subject: '📧 Verify your StackifyX email',
  html: base(`
    <span class="badge bi">📧 Verify Email</span>
    <p>Hi <strong style="color:#e2e8f0">${user.name}</strong>,</p>
    <p>Thanks for signing up! Please verify your email address to activate your account. This link expires in <strong style="color:#e2e8f0">24 hours</strong>.</p>
    <a href="${verifyURL}" class="btn">Verify My Email →</a>
    <div class="divider"></div>
    <p style="font-size:12px;color:#64748b;word-break:break-all">Or copy this link:<br>${verifyURL}</p>
    <p style="font-size:12px;color:#64748b;margin-top:12px">Didn't sign up? You can safely ignore this email.</p>
  `, 'Verify Your Email'),
});

module.exports.sendVerificationEmail = sendVerificationEmail;
