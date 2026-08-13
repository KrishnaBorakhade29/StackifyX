// middleware/upload.js - Multer file upload configuration
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage config for project files
const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/projects');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `project-${uniqueSuffix}${ext}`);
  }
});

// Storage config for inquiry attachments
const inquiryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/inquiries');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `inquiry-${uniqueSuffix}${ext}`);
  }
});

// File filter - allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|zip|rar|txt|ppt|pptx|mp4|mp3/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('File type not supported'));
  }
};

// Upload instances
const uploadProjectFiles = multer({
  storage: projectStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
}).array('files', 10);

const uploadInquiryFiles = multer({
  storage: inquiryStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).array('attachments', 5);

// Middleware wrappers with error handling
const handleProjectUpload = (req, res, next) => {
  uploadProjectFiles(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.flash('error', `Upload error: ${err.message}`);
      return res.redirect('back');
    } else if (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    next();
  });
};

const handleInquiryUpload = (req, res, next) => {
  uploadInquiryFiles(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.flash('error', `Upload error: ${err.message}`);
      return res.redirect('back');
    } else if (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    next();
  });
};

module.exports = { handleProjectUpload, handleInquiryUpload };
