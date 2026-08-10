const multer = require("multer");

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max — single source of truth

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const LOGO_MAX_FILE_SIZE = 300 * 1024; // 300KB max

const logoUpload = multer({
  storage,
  limits: {
    fileSize: LOGO_MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg") {
      cb(null, true);
    } else {
      cb(new Error("Only PNG and JPEG image files are allowed"));
    }
  },
});

upload.MAX_FILE_SIZE = MAX_FILE_SIZE;
logoUpload.MAX_FILE_SIZE = LOGO_MAX_FILE_SIZE;

upload.logoUpload = logoUpload;
upload.upload = upload;

module.exports = upload;