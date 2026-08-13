# StackifyX

Project service platform — clients submit a project brief and budget, track build
progress on a live dashboard, chat directly with the builder, and pay by milestone
via Razorpay.

**Stack:** Node.js, Express, MongoDB (Mongoose), EJS, Socket.IO, Razorpay.

Full setup and MongoDB command reference: see `StackifyX_Setup_Database_Guide.pdf`.

## Quick start (VS Code)

```bash
npm install
cp .env.example .env      # then fill in MONGO_URI, EMAIL_*, RAZORPAY_* etc.
npm run dev                # nodemon, auto-restarts on save
```

App runs at http://localhost:3000. An admin account is auto-created on first boot
using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

## Scripts

- `npm run dev` — start with nodemon (development)
- `npm start` — start with node (production)
