const multer = require('multer');

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max — single source of truth

/**
 * The CSV importer's uploader.
 *
 * Default export, because it is what every existing caller means by "upload".
 * Memory storage: a CSV is parsed straight out of the buffer and never needs to
 * land on disk.
 */
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// --- Expense receipts (#719) ----------------------------------------------
//
// Receipts are attachments rather than parser input. They stay in memory until
// the expense controller has validated the claim and explicitly uploads each
// attachment to S3. This prevents application-local disk storage, which is not
// durable across horizontally scaled instances.

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

/** Real receipts are photos or scans. Nothing here is executable. */
const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RECEIPT_SIZE,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (RECEIPT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Receipts must be a JPEG, PNG, WebP, HEIC image or a PDF'));
    }
  },
});

upload.MAX_FILE_SIZE = MAX_FILE_SIZE;

// Named exports hang off the default one, because `module.exports = upload` is
// what the CSV callers already destructure `MAX_FILE_SIZE` from and changing
// that shape would break them.
upload.receiptUpload = receiptUpload;
upload.MAX_RECEIPT_SIZE = MAX_RECEIPT_SIZE;
upload.RECEIPT_MIME_TYPES = RECEIPT_MIME_TYPES;

module.exports = upload;
