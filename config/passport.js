const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function(passport) {

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,

        clientSecret: process.env.GOOGLE_CLIENT_SECRET,

        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },

      async (accessToken, refreshToken, profile, done) => {
        try {

          const googleId = profile.id;

          const email =
            profile.emails &&
            profile.emails[0]
              ? profile.emails[0].value.toLowerCase()
              : null;

          if (!email) {
            return done(null, false, {
              message: 'Google account does not provide an email address.'
            });
          }

          const name =
            profile.displayName ||
            (
              profile.name
                ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim()
                : 'Google User'
            );

          // 1. Find user by Google ID
          let user = await User.findOne({ googleId });

          if (user) {
            return done(null, user);
          }

          // 2. If Google ID doesn't exist,
          //    check whether this email already exists
          user = await User.findOne({ email });

          if (user) {

            // Connect existing account with Google
            user.googleId = googleId;
            user.isVerified = true;

            await user.save();

            return done(null, user);
          }

          // 3. Create completely new Google account
          user = await User.create({
            name,
            email,
            googleId,
            isVerified: true,
            role: 'user',
            lastLogin: new Date()
          });

          return done(null, user);

        } catch (error) {
          console.error('Google Strategy Error:', error);
          return done(error, null);
        }
      }
    )
  );


  // Store only user ID in the session
  passport.serializeUser((user, done) => {
    done(null, user._id.toString());
  });


  // Retrieve user from MongoDB
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);

      if (!user) {
        return done(null, false);
      }

      done(null, user);

    } catch (error) {
      done(error, null);
    }
  });

};