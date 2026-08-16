// controllers/authController.js

const crypto = require('crypto');
const User = require('../models/User');
const { google } = require('googleapis');
const { validationResult } = require('express-validator');

const {
  sendWelcome,
  sendPasswordReset,
  sendVerificationEmail,
} = require('../utils/email');


// ============================================================
// GOOGLE OAUTH CONFIGURATION
// ============================================================

console.log('GOOGLE CALLBACK URL:', process.env.GOOGLE_CALLBACK_URL);

const googleOAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const googleScopes = [
  'openid',
  'profile',
  'email'
];


// ============================================================
// HELPERS
// ============================================================

const hashToken = (raw) =>
  crypto.createHash('sha256').update(raw).digest('hex');

const rawToken = () =>
  crypto.randomBytes(32).toString('hex');


// ============================================================
// REGISTER
// ============================================================

const getRegister = (req, res) =>
  res.render('auth/register', {
    title: 'Create Account',
    errors: [],
    formData: {}
  });


const postRegister = async (req, res) => {

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      title: 'Create Account',
      errors: errors.array(),
      formData: req.body
    });
  }

  const {
    name,
    email,
    password,
    phone
  } = req.body;

  try {

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({
      email: normalizedEmail
    });

    if (existing) {

      if (!existing.isVerified) {

        return res.render('auth/register', {
          title: 'Create Account',
          errors: [{
            msg:
              'Account exists but email not verified. ' +
              '<a href="/auth/resend-verification?email=' +
              encodeURIComponent(email) +
              '" style="color:var(--accent-blue)">' +
              'Resend verification email →</a>'
          }],
          formData: req.body
        });
      }

      return res.render('auth/register', {
        title: 'Create Account',
        errors: [{
          msg: 'An account with this email already exists.'
        }],
        formData: req.body
      });
    }


    // Generate email verification token
    const token = rawToken();

    const hashedTok = hashToken(token);

    const verifyURL =
      `${process.env.APP_URL || 'http://localhost:3000'}` +
      `/auth/verify-email/${token}`;


    // Create normal account
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone,

      isVerified: false,

      emailVerifyToken: hashedTok,

      emailVerifyExpires:
        Date.now() + 24 * 60 * 60 * 1000
    });


    // Temporary verification debug
    console.log(
      '🔎 VERIFICATION DEBUG - CREATED USER'
    );

    console.log({
      email: user.email,
      isVerified: user.isVerified,
      emailVerifyExpires: user.emailVerifyExpires,
      now: new Date(),
      expiresInMinutes:
        Math.floor(
          (user.emailVerifyExpires.getTime() - Date.now()) / 60000
        )
    });


    // Send verification email
    try {

      const emailInfo =
        await sendVerificationEmail(
          user,
          verifyURL
        );

      console.log(
        '✅ Verification email completed:',
        emailInfo?.messageId || 'No message ID'
      );

    } catch (e) {

      console.error(
        '❌ Verify email error:',
        e
      );
    }


    res.render('auth/check-email', {
      title: 'Check Your Email',
      email: user.email,
      name: user.name
    });

  } catch (err) {

    console.error(
      'Registration error:',
      err
    );

    res.render('auth/register', {
      title: 'Create Account',
      errors: [{
        msg: 'Registration failed. Please try again.'
      }],
      formData: req.body
    });
  }
};


// ============================================================
// VERIFY EMAIL
// ============================================================

const verifyEmail = async (req, res) => {

  const hashed =
    hashToken(req.params.token);


  // Temporary verification debug
  console.log(
    '🔎 VERIFICATION DEBUG - VERIFY REQUEST'
  );

  console.log({
    now: new Date(),
    tokenReceived: !!req.params.token,
    tokenLength: req.params.token?.length
  });


  try {

    const user =
      await User.findOne({
        emailVerifyToken: hashed,

        emailVerifyExpires: {
          $gt: Date.now()
        }
      })
      .select(
        '+emailVerifyToken +emailVerifyExpires'
      );


    // Temporary verification debug
    console.log(
      '🔎 VERIFICATION DEBUG - LOOKUP RESULT'
    );

    console.log({
      found: !!user,
      email: user?.email,
      isVerified: user?.isVerified,
      emailVerifyExpires:
        user?.emailVerifyExpires,
      now: new Date(),
      expiresInMinutes:
        user?.emailVerifyExpires
          ? Math.floor(
              (
                user.emailVerifyExpires.getTime() -
                Date.now()
              ) / 60000
            )
          : null
    });


    if (!user) {

      return res.render(
        'auth/verify-result',
        {
          title: 'Verification Failed',
          success: false,
          message:
            'This verification link is invalid or has expired.'
        }
      );
    }


    user.isVerified = true;

    user.emailVerifyToken = undefined;

    user.emailVerifyExpires = undefined;


    await user.save({
      validateBeforeSave: false
    });


    try {

      const emailInfo =
        await sendWelcome(user);

      console.log(
        '✅ Welcome email completed:',
        emailInfo?.messageId || 'No message ID'
      );

    } catch (e) {

      console.error(
        '❌ Welcome email error:',
        e
      );
    }


    res.render(
      'auth/verify-result',
      {
        title: 'Email Verified!',
        success: true,
        message:
          'Your email has been verified. You can now sign in.'
      }
    );

  } catch (err) {

    console.error(
      'Verify email error:',
      err
    );

    res.render(
      'auth/verify-result',
      {
        title: 'Verification Failed',
        success: false,
        message:
          'Something went wrong. Please try again.'
      }
    );
  }
};


// ============================================================
// RESEND VERIFICATION EMAIL
// ============================================================

const resendVerification = async (req, res) => {

  const email =
    req.query.email ||
    req.body.email;

  try {

    const user =
      await User.findOne({
        email: email?.toLowerCase().trim()
      })
      .select(
        '+emailVerifyToken +emailVerifyExpires'
      );


    if (!user || user.isVerified) {

      return res.render(
        'auth/check-email',
        {
          title: 'Check Your Email',
          email,
          name: '',
          alreadyVerified: user?.isVerified
        }
      );
    }


    const token = rawToken();

    const hashed = hashToken(token);

    const verifyURL =
      `${process.env.APP_URL || 'http://localhost:3000'}` +
      `/auth/verify-email/${token}`;


    user.emailVerifyToken = hashed;

    user.emailVerifyExpires =
      Date.now() + 24 * 60 * 60 * 1000;


    await user.save({
      validateBeforeSave: false
    });


    try {

      const emailInfo =
        await sendVerificationEmail(
          user,
          verifyURL
        );

      console.log(
        '✅ Resend verification email completed:',
        emailInfo?.messageId || 'No message ID'
      );

    } catch (e) {

      console.error(
        '❌ Resend verify error:',
        e
      );
    }


    res.render(
      'auth/check-email',
      {
        title: 'Check Your Email',
        email: user.email,
        name: user.name
      }
    );

  } catch (err) {

    console.error(
      'Resend verification error:',
      err
    );

    req.flash(
      'error',
      'Failed to resend. Please try again.'
    );

    res.redirect('/auth/login');
  }
};


// ============================================================
// LOGIN
// ============================================================

const getLogin = (req, res) =>
  res.render('auth/login', {
    title: 'Login',
    errors: [],
    formData: {}
  });


const postLogin = async (req, res) => {

  const errors = validationResult(req);

  if (!errors.isEmpty()) {

    return res.render('auth/login', {
      title: 'Login',
      errors: errors.array(),
      formData: req.body
    });
  }


  const {
    email,
    password
  } = req.body;


  try {

    const user =
      await User.findOne({
        email: email.toLowerCase().trim()
      })
      .select('+password');


    if (
      !user ||
      !user.password ||
      !(await user.comparePassword(password))
    ) {

      return res.render('auth/login', {
        title: 'Login',
        errors: [{
          msg: 'Invalid email or password.'
        }],
        formData: req.body
      });
    }


    if (!user.isActive) {

      return res.render('auth/login', {
        title: 'Login',
        errors: [{
          msg:
            'Your account has been deactivated. Contact support.'
        }],
        formData: req.body
      });
    }


    if (!user.isVerified) {

      return res.render('auth/login', {
        title: 'Login',
        errors: [{
          msg:
            `Email not verified. <a href="/auth/resend-verification?email=${encodeURIComponent(email)}" style="color:var(--accent-blue);font-weight:600;">Resend verification email →</a>`
        }],
        formData: req.body
      });
    }


    user.lastLogin = new Date();

    await user.save({
      validateBeforeSave: false
    });


    req.session.userId = user._id;

    req.session.userRole = user.role;


    req.flash(
      'success',
      `Welcome back, ${user.name}!`
    );


    res.redirect(
      user.role === 'admin'
        ? '/admin/dashboard'
        : '/dashboard'
    );

  } catch (err) {

    console.error(
      'Login error:',
      err
    );

    res.render('auth/login', {
      title: 'Login',
      errors: [{
        msg:
          'Login failed. Please try again.'
      }],
      formData: req.body
    });
  }
};


// ============================================================
// GOOGLE LOGIN
// ============================================================

const googleLogin = (req, res) => {

  try {

    const state =
      crypto.randomBytes(32).toString('hex');

    req.session.googleOAuthState = state;

    const authorizationUrl =
      googleOAuth2Client.generateAuthUrl({

        access_type: 'online',

        scope: googleScopes,

        state,

        prompt: 'select_account',

        include_granted_scopes: true
      });

    // IMPORTANT:
    // Explicitly save the session before redirecting to Google.
    req.session.save((err) => {

      if (err) {

        console.error(
          'Google OAuth session save error:',
          err
        );

        req.flash(
          'error',
          'Unable to start Google sign in. Please try again.'
        );

        return res.redirect('/auth/login');
      }

      res.redirect(authorizationUrl);
    });

  } catch (err) {

    console.error(
      'Google login start error:',
      err
    );

    req.flash(
      'error',
      'Unable to connect with Google. Please try again.'
    );

    res.redirect('/auth/login');
  }
};

  


// ============================================================
// GOOGLE CALLBACK
// ============================================================

const googleCallback = async (req, res) => {

  try {

    if (req.query.error) {

      console.error(
        'Google OAuth error:',
        req.query.error
      );

      req.flash(
        'error',
        'Google sign in was cancelled.'
      );

      return res.redirect('/auth/login');
    }


    const savedState =
      req.session.googleOAuthState;

    const returnedState =
      req.query.state;


    if (
      !savedState ||
      !returnedState ||
      savedState !== returnedState
    ) {

      console.error(
        'Google OAuth state mismatch.'
      );

      return res.status(400).send(
        'Invalid Google authentication request.'
      );
    }


    delete req.session.googleOAuthState;


    const { tokens } =
      await googleOAuth2Client.getToken(
        req.query.code
      );


    googleOAuth2Client.setCredentials(
      tokens
    );


    const oauth2 =
      google.oauth2({
        auth: googleOAuth2Client,
        version: 'v2'
      });


    const {
      data: googleUser
    } = await oauth2.userinfo.get();


    if (
      !googleUser ||
      !googleUser.email
    ) {

      req.flash(
        'error',
        'Google did not return a valid email address.'
      );

      return res.redirect('/auth/login');
    }


    const googleId =
      googleUser.id;

    const email =
      googleUser.email.toLowerCase().trim();

    const name =
      googleUser.name ||
      googleUser.given_name ||
      'Google User';

    const picture =
      googleUser.picture || '';


    let user =
      await User.findOne({
        googleId
      });


    if (!user) {

      user =
        await User.findOne({
          email
        });
    }


    if (user) {

      if (!user.googleId) {

        user.googleId = googleId;

        user.authProvider = 'google';
      }


      user.isVerified = true;


      if (!user.name && name) {
        user.name = name;
      }


      if (user.profilePicture === undefined) {
        // Do nothing
      } else {
        user.profilePicture = picture;
      }


      user.lastLogin = new Date();


      await user.save({
        validateBeforeSave: false
      });

    } else {

      user = await User.create({

        name,

        email,

        googleId,

        authProvider: 'google',

        isVerified: true,

        isActive: true,

        lastLogin: new Date()
      });
    }


    if (!user.isActive) {

      req.flash(
        'error',
        'Your account has been deactivated. Contact support.'
      );

      return res.redirect('/auth/login');
    }


    req.session.userId =
      user._id;

    req.session.userRole =
      user.role;


    req.session.save((err) => {

      if (err) {

        console.error(
          'Session save error:',
          err
        );

        return res.redirect(
          '/auth/login'
        );
      }


      req.flash(
        'success',
        `Welcome, ${user.name}!`
      );


      res.redirect(
        user.role === 'admin'
          ? '/admin/dashboard'
          : '/dashboard'
      );
    });

  } catch (err) {

    console.error(
      'Google authentication error:',
      err
    );

    req.flash(
      'error',
      'Google sign in failed. Please try again.'
    );

    res.redirect('/auth/login');
  }
};


// ============================================================
// LOGOUT
// ============================================================

const logout = (req, res) =>
  req.session.destroy(() =>
    res.redirect('/auth/login')
  );


// ============================================================
// FORGOT PASSWORD
// ============================================================

const getForgotPassword = (req, res) =>
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    error: null,
    success: null
  });


const postForgotPassword = async (req, res) => {

  const { email } = req.body;

  const successMsg =
    "If that email is registered and verified, you'll receive a reset link shortly.";


  if (!email?.trim()) {

    return res.render(
      'auth/forgot-password',
      {
        title: 'Forgot Password',
        success: null,
        error:
          'Please enter your email address.'
      }
    );
  }


  try {

    const user =
      await User.findOne({
        email:
          email.toLowerCase().trim()
      })
      .select('+password');


    if (
      !user ||
      !user.isVerified
    ) {

      return res.render(
        'auth/forgot-password',
        {
          title: 'Forgot Password',
          error: null,
          success: successMsg
        }
      );
    }

    const token = rawToken();

    const hashed =
      hashToken(token);

    const resetURL =
      `${process.env.APP_URL || 'http://localhost:3000'}` +
      `/auth/reset-password/${token}`;


    user.resetPasswordToken =
      hashed;

    user.resetPasswordExpires =
      Date.now() + 30 * 60 * 1000;


    await user.save({
      validateBeforeSave: false
    });


    try {

      const emailInfo =
        await sendPasswordReset(
          user,
          resetURL
        );

      console.log(
        '✅ Password reset email completed:',
        emailInfo?.messageId || 'No message ID'
      );

    } catch (e) {

      console.error(
        '❌ Reset email error:',
        e
      );
    }


    res.render(
      'auth/forgot-password',
      {
        title: 'Forgot Password',
        error: null,
        success: successMsg
      }
    );

  } catch (err) {

    console.error(
      'Forgot password error:',
      err
    );

    res.render(
      'auth/forgot-password',
      {
        title: 'Forgot Password',
        success: null,
        error:
          'Something went wrong. Please try again.'
      }
    );
  }
};


// ============================================================
// RESET PASSWORD
// ============================================================

const getResetPassword = async (req, res) => {

  const hashed =
    hashToken(req.params.token);

  try {

    const user =
      await User.findOne({
        resetPasswordToken: hashed,

        resetPasswordExpires: {
          $gt: Date.now()
        }
      });


    if (!user) {

      return res.render(
        'auth/reset-password',
        {
          title: 'Reset Password',
          token: null,
          error:
            'Link is invalid or expired.',
          success: null
        }
      );
    }


    res.render(
      'auth/reset-password',
      {
        title: 'Reset Password',
        token: req.params.token,
        error: null,
        success: null
      }
    );

  } catch (err) {

    console.error(
      'Get reset password error:',
      err
    );

    res.render(
      'auth/reset-password',
      {
        title: 'Reset Password',
        token: null,
        error:
          'Something went wrong.',
        success: null
      }
    );
  }
};


const postResetPassword = async (req, res) => {

  const {
    password,
    confirmPassword
  } = req.body;

  const hashed =
    hashToken(req.params.token);


  if (
    !password ||
    password.length < 6
  ) {

    return res.render(
      'auth/reset-password',
      {
        title: 'Reset Password',
        token: req.params.token,
        error:
          'Minimum 6 characters.',
        success: null
      }
    );
  }


  if (
    password !== confirmPassword
  ) {

    return res.render(
      'auth/reset-password',
      {
        title: 'Reset Password',
        token: req.params.token,
        error:
          'Passwords do not match.',
        success: null
      }
    );
  }


  try {

    const user =
      await User.findOne({
        resetPasswordToken: hashed,

        resetPasswordExpires: {
          $gt: Date.now()
        }
      })
      .select(
        '+password +resetPasswordToken +resetPasswordExpires'
      );


    if (!user) {

      return res.render(
        'auth/reset-password',
        {
          title: 'Reset Password',
          token: null,
          error:
            'Link is invalid or expired.',
          success: null
        }
      );
    }


    user.password = password;

    user.resetPasswordToken =
      undefined;

    user.resetPasswordExpires =
      undefined;


    await user.save();


    req.flash(
      'success',
      '✅ Password reset! Please sign in.'
    );


    res.redirect(
      '/auth/login'
    );

  } catch (err) {

    console.error(
      'Reset password error:',
      err
    );

    res.render(
      'auth/reset-password',
      {
        title: 'Reset Password',
        token: req.params.token,
        error:
          'Failed to reset. Try again.',
        success: null
      }
    );
  }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  getRegister,
  postRegister,

  verifyEmail,
  resendVerification,

  getLogin,
  postLogin,

  googleLogin,
  googleCallback,

  logout,

  getForgotPassword,
  postForgotPassword,

  getResetPassword,
  postResetPassword
};