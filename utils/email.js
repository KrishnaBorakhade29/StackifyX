// utils/email.js

const nodemailer = require('nodemailer');
const https = require('https');

// ============================================================
// EMAIL PROVIDER
// ============================================================

const useBrevo = () => {
  return !!process.env.BREVO_API_KEY;
};


// ============================================================
// GMAIL CONFIG CHECK
// ============================================================

const smtpReady = () => {

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {

    console.warn(
      '⚠️ Gmail SMTP: EMAIL_USER or EMAIL_PASS missing.'
    );

    return false;
  }

  return true;
};


// ============================================================
// BREVO CONFIG CHECK
// ============================================================

const brevoReady = () => {

  if (!process.env.BREVO_API_KEY) {

    console.warn(
      '⚠️ Brevo: BREVO_API_KEY missing.'
    );

    return false;
  }

  if (!process.env.BREVO_SENDER_EMAIL) {

    console.warn(
      '⚠️ Brevo: BREVO_SENDER_EMAIL missing.'
    );

    return false;
  }

  return true;
};


// ============================================================
// SEND USING BREVO
// ============================================================

const sendViaBrevo = ({ to, subject, html }) => {

  return new Promise((resolve, reject) => {

    const payload = JSON.stringify({

      sender: {
        name:
          process.env.BREVO_SENDER_NAME ||
          'StackifyX',

        email:
          process.env.BREVO_SENDER_EMAIL
      },

      to: [
        {
          email: to
        }
      ],

      subject,

      htmlContent: html
    });


    const options = {

      hostname: 'api.brevo.com',

      path: '/v3/smtp/email',

      method: 'POST',

      headers: {

        'Content-Type':
          'application/json',

        'api-key':
          process.env.BREVO_API_KEY,

        'Content-Length':
          Buffer.byteLength(payload)
      }
    };


    const request =
      https.request(
        options,
        (response) => {

          let body = '';

          response.on(
            'data',
            chunk => {
              body += chunk;
            }
          );


          response.on(
            'end',
            () => {

              if (
                response.statusCode >= 200 &&
                response.statusCode < 300
              ) {

                let data;

                try {
                  data = JSON.parse(body);
                } catch {
                  data = {};
                }


                console.log(
                  `📧 Brevo sent → ${to}`
                );


                resolve(data);

              } else {

                reject(
                  new Error(
                    `Brevo API ${response.statusCode}: ${body}`
                  )
                );
              }
            }
          );
        }
      );


    request.on(
      'error',
      reject
    );


    request.setTimeout(
      15000,
      () => {

        request.destroy();

        reject(
          new Error(
            'Brevo request timeout'
          )
        );
      }
    );


    request.write(payload);

    request.end();
  });
};


// ============================================================
// SEND USING GMAIL SMTP
// ============================================================

const sendViaSmtp = async ({
  to,
  subject,
  html
}) => {

  const transporter =
    nodemailer.createTransport({

      host:
        process.env.EMAIL_HOST ||
        'smtp.gmail.com',

      port:
        parseInt(
          process.env.EMAIL_PORT,
          10
        ) || 587,

      secure: false,

      auth: {

        user:
          process.env.EMAIL_USER,

        pass:
          process.env.EMAIL_PASS
      },

      tls: {

        rejectUnauthorized: true
      },

      connectionTimeout: 10000,

      socketTimeout: 15000
    });


  const info =
    await transporter.sendMail({

      from:
        process.env.EMAIL_FROM ||
        `"StackifyX" <${process.env.EMAIL_USER}>`,

      to,

      subject,

      html
    });


  console.log(
    `📧 Gmail SMTP sent → ${to}`
  );


  console.log(
    `Message ID: ${info.messageId}`
  );


  return info;
};


// ============================================================
// MASTER EMAIL FUNCTION
// ============================================================

const sendEmail = async ({
  to,
  subject,
  html
}) => {

  try {

    if (useBrevo()) {

      if (!brevoReady()) {
        return;
      }

      await sendViaBrevo({
        to,
        subject,
        html
      });

      return;
    }


    if (!smtpReady()) {
      return;
    }


    await sendViaSmtp({
      to,
      subject,
      html
    });

  } catch (error) {

    console.error(
      `❌ Email FAILED → ${to}`
    );

    console.error(
      'Reason:',
      error.message
    );


    if (
      error.message?.includes('EAUTH') ||
      error.message?.includes('535')
    ) {

      console.error(
        'Gmail authentication failed.'
      );

      console.error(
        'Use a Gmail App Password.'
      );
    }


    if (
      error.message?.includes('Brevo') ||
      error.message?.includes('401')
    ) {

      console.error(
        'Check BREVO_API_KEY and BREVO_SENDER_EMAIL.'
      );
    }
  }
};


// ============================================================
// VERIFY EMAIL CONFIGURATION
// ============================================================

const verifyEmailConfig = async () => {

  if (useBrevo()) {

    if (!brevoReady()) {
      return false;
    }


    console.log(
      '✅ Email provider: Brevo HTTP API'
    );


    console.log(
      `Sender: ${process.env.BREVO_SENDER_EMAIL}`
    );


    return true;
  }


  if (!smtpReady()) {
    return false;
  }


  try {

    const transporter =
      nodemailer.createTransport({

        host:
          process.env.EMAIL_HOST ||
          'smtp.gmail.com',

        port:
          parseInt(
            process.env.EMAIL_PORT,
            10
          ) || 587,

        secure: false,

        auth: {

          user:
            process.env.EMAIL_USER,

          pass:
            process.env.EMAIL_PASS
        },

        tls: {

          rejectUnauthorized: false
        }
      });


    await transporter.verify();


    console.log(
      '✅ Email provider: Gmail SMTP'
    );


    return true;

  } catch (error) {

    console.error(
      '❌ Gmail SMTP failed:',
      error.message
    );


    return false;
  }
};


// ============================================================
// EMAIL BASE TEMPLATE
// ============================================================

const base = (
  content,
  title
) => `<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>${title}</title>

<style>

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  background: #f4f7fb;

  color: #1e293b;

  padding: 20px;
}

.wrap {
  max-width: 600px;

  margin: 30px auto;

  background: #ffffff;

  border-radius: 16px;

  overflow: hidden;

  border: 1px solid #e2e8f0;
}

.hdr {
  background:
    linear-gradient(
      135deg,
      #63b3ed,
      #a78bfa
    );

  padding: 36px 30px;

  text-align: center;
}

.hdr h1 {
  color: #ffffff;

  font-size: 26px;

  font-weight: 800;

  margin-bottom: 6px;
}

.hdr p {
  color: rgba(255,255,255,.85);

  font-size: 14px;
}

.bdy {
  padding: 36px 30px;
}

.bdy p {
  color: #475569;

  line-height: 1.7;

  margin-bottom: 16px;

  font-size: 15px;
}

.badge {
  display: inline-block;

  padding: 6px 14px;

  border-radius: 50px;

  font-size: 11px;

  font-weight: 700;

  text-transform: uppercase;

  letter-spacing: .08em;

  margin-bottom: 20px;
}

.bs {
  background: #dcfce7;

  color: #15803d;
}

.bi {
  background: #e0f2fe;

  color: #0369a1;
}

.bw {
  background: #f3e8ff;

  color: #7e22ce;
}

.br {
  background: #fee2e2;

  color: #b91c1c;
}

.ic {
  background: #f8fafc;

  border-radius: 12px;

  padding: 20px;

  margin: 20px 0;

  border-left:
    4px solid #63b3ed;
}

.ic h3 {
  color: #1e293b;

  font-size: 16px;

  font-weight: 700;

  margin-bottom: 8px;
}

.ic p {
  color: #64748b;

  font-size: 14px;

  margin: 0;

  line-height: 1.6;
}

.btn {
  display: inline-block;

  background:
    linear-gradient(
      135deg,
      #63b3ed,
      #a78bfa
    );

  color: #ffffff !important;

  padding: 14px 28px;

  border-radius: 10px;

  text-decoration: none;

  font-weight: 700;

  font-size: 15px;

  margin-top: 10px;
}

.divider {
  height: 1px;

  background: #e2e8f0;

  margin: 28px 0;
}

.ftr {
  background: #f8fafc;

  padding: 24px 30px;

  text-align: center;
}

.ftr p {
  color: #94a3b8;

  font-size: 12px;

  line-height: 1.6;
}

.ftr strong {
  color: #63b3ed;
}

</style>

</head>

<body>

<div class="wrap">

<div class="hdr">

<img
  src="https://stackifyx.onrender.com/stackifyx-logo.jpg"
  alt="StackifyX"
  width="52"
  height="52"
  style="
    width:52px;
    height:52px;
    border-radius:12px;
    background:#fff;
    padding:3px;
    margin-bottom:12px;
  "
>

<h1>StackifyX</h1>

<p>
Your Personal Project Service Platform
</p>

</div>

<div class="bdy">

${content}

</div>

<div class="ftr">

<p>
© ${new Date().getFullYear()}
<strong>StackifyX</strong>.
All rights reserved.
</p>

<p style="margin-top:6px">
If you didn't expect this email,
you can safely ignore it.
</p>

</div>

</div>

</body>

</html>`;


// ============================================================
// WELCOME EMAIL
// ============================================================

const sendWelcome = (user) => {

  return sendEmail({

    to: user.email,

    subject:
      'Welcome to StackifyX',

    html: base(`

<span class="badge bw">
Welcome aboard
</span>

<p>
Hi
<strong>
${user.name}
</strong>,
</p>

<p>
Your StackifyX account is ready.
You can submit project requests,
track progress and communicate
with our team.
</p>

<div class="ic">

<h3>
Get started in 3 steps
</h3>

<p>
1. Submit a project inquiry with your requirements and budget.<br>
2. We review your request.<br>
3. Track your project from your dashboard.
</p>

</div>

<a
  href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard"
  class="btn"
>
Go to Dashboard →
</a>

`, 'Welcome to StackifyX')

  });
};


// ============================================================
// EMAIL VERIFICATION
// ============================================================

const sendVerificationEmail = (
  user,
  verifyURL
) => {

  return sendEmail({

    to: user.email,

    subject:
      'Verify your StackifyX email',

    html: base(`

<span class="badge bi">
Verify Email
</span>

<p>
Hi
<strong>
${user.name}
</strong>,
</p>

<p>
Thanks for signing up with StackifyX.
Please verify your email address
to activate your account.
</p>

<p>
This verification link expires in
<strong>
24 hours
</strong>.
</p>

<a
  href="${verifyURL}"
  class="btn"
>
Verify My Email →
</a>

<div class="divider"></div>

<p
  style="
    font-size:12px;
    color:#64748b;
    word-break:break-all;
  "
>
Or copy this link:
<br>
${verifyURL}
</p>

<p
  style="
    font-size:12px;
    color:#64748b;
  "
>
Didn't sign up?
You can safely ignore this email.
</p>

`, 'Verify Your Email')

  });
};


// ============================================================
// INQUIRY ACCEPTED
// ============================================================

const sendInquiryAccepted = (
  user,
  inquiry
) => {

  const description =
    inquiry.description || '';


  return sendEmail({

    to: user.email,

    subject:
      `Inquiry accepted - ${inquiry.title}`,

    html: base(`

<span class="badge bs">
Accepted
</span>

<p>
Hi
<strong>
${user.name}
</strong>,
</p>

<p>
Great news!
We reviewed your inquiry
and we're excited to move forward.
</p>

<div class="ic">

<h3>
${inquiry.title}
</h3>

<p>
${description.substring(0, 180)}
${description.length > 180 ? '...' : ''}
</p>

</div>

<p>
Budget:
<strong>
₹${Number(inquiry.budget || 0).toLocaleString('en-IN')}
</strong>
</p>

<p>
Category:
<strong>
${inquiry.category || 'N/A'}
</strong>
</p>

<a
  href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard"
  class="btn"
>
View Dashboard →
</a>

`, 'Inquiry Accepted')

  });
};


// ============================================================
// PROJECT STARTED
// ============================================================

const sendProjectStarted = (
  user,
  project
) => {

  return sendEmail({

    to: user.email,

    subject:
      `Development started - ${project.title}`,

    html: base(`

<span class="badge bi">
Started
</span>

<p>
Hi
<strong>
${user.name}
</strong>,
</p>

<p>
Development on your project
has officially started.
</p>

<div class="ic">

<h3>
${project.title}
</h3>

<p>
Deadline:
<strong>
${
  project.deadline
    ? new Date(project.deadline)
        .toLocaleDateString(
          'en-IN',
          { dateStyle: 'long' }
        )
    : 'TBD'
}
</strong>
</p>

<p>
Price:
<strong>
₹${Number(project.price || 0).toLocaleString('en-IN')}
</strong>
</p>

</div>

<a
  href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project._id}"
  class="btn"
>
Track Your Project →
</a>

`, 'Project Started')

  });
};


// ============================================================
// PROJECT COMPLETED
// ============================================================

const sendProjectCompleted = (
  user,
  project
) => {

  return sendEmail({

    to: user.email,

    subject:
      `Project complete - ${project.title}`,

    html: base(`

<span class="badge bs">
Complete
</span>

<p>
Hi
<strong>
${user.name}
</strong>,
</p>

<p>
Your project is complete
and ready for delivery.
</p>

<div class="ic">

<h3>
${project.title}
</h3>

<p>
All deliverables have been uploaded.
Please visit your dashboard
to download the files.
</p>

</div>

<a
  href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project._id}"
  class="btn"
>
View Project →
</a>

`, 'Project Completed')

  });
};


// ============================================================
// PASSWORD RESET
// ============================================================

const sendPasswordReset = (
  user,
  resetURL
) => {

  return sendEmail({

    to: user.email,

    subject:
      'Reset your StackifyX password',

    html: base(`

<span class="badge br">
Password Reset
</span>

<p>
Hi
<strong>
${user.name}
</strong>,
</p>

<p>
We received a request to reset
your StackifyX password.
</p>

<p>
This link expires in
<strong>
30 minutes
</strong>.
</p>

<div class="ic">

<h3>
Didn't request this?
</h3>

<p>
If you didn't request a password reset,
you can safely ignore this email.
Your password will not change.
</p>

</div>

<a
  href="${resetURL}"
  class="btn"
>
Reset My Password →
</a>

<div class="divider"></div>

<p
  style="
    font-size:12px;
    word-break:break-all;
    color:#64748b;
  "
>
Or copy this link:
<br>
${resetURL}
</p>

`, 'Reset Password')

  });
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  verifyEmailConfig,

  sendWelcome,

  sendVerificationEmail,

  sendInquiryAccepted,

  sendProjectStarted,

  sendProjectCompleted,

  sendPasswordReset
};