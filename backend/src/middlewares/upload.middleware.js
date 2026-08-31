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

// --- Magic Number Validation (#2090) --------------------------------------
//
// Multer's fileFilter only looks at the client-provided Content-Type header.
// To prevent executable scripts disguised as PDFs/images, we inspect the
// buffer's magic numbers (file signature) after Multer processes the upload.

const validateMagicNumbers = (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files || files.length === 0) return next();

  for (const file of files) {
    if (!file.buffer || file.buffer.length < 4) {
      return res.status(400).json({ message: 'File is empty or corrupted' });
    }

    const hex = file.buffer.toString('hex', 0, 4).toUpperCase();
    
    // Magic Numbers for allowed receipt mime types:
    // JPEG: FF D8 FF
    // PNG: 89 50 4E 47
    // PDF: 25 50 44 46 (%PDF)
    // WebP: 52 49 46 46 (RIFF) - next 4 bytes are size, then 57 45 42 50 (WEBP)
    // HEIC: 00 00 00 (size) then 66 74 79 70 (ftyp)

    let isValid = false;
    
    if (file.mimetype === 'image/jpeg' && hex.startsWith('FFD8FF')) {
      isValid = true;
    } else if (file.mimetype === 'image/png' && hex === '89504E47') {
      isValid = true;
    } else if (file.mimetype === 'application/pdf' && hex === '25504446') {
      isValid = true;
    } else if (file.mimetype === 'image/webp' && hex === '52494646') {
      // Check for WEBP at byte offset 8
      if (file.buffer.length >= 12 && file.buffer.toString('hex', 8, 12).toUpperCase() === '57454250') {
        isValid = true;
      }
    } else if (file.mimetype === 'image/heic') {
      // Check for 'ftyp' at byte offset 4
      if (file.buffer.length >= 8 && file.buffer.toString('hex', 4, 8).toUpperCase() === '66747970') {
        isValid = true;
      }
    }

    if (!isValid) {
      return res.status(415).json({ message: 'File content does not match its extension or is unsupported' });
    }
  }
  
  next();
};

// Named exports hang off the default one, because `module.exports = upload` is
// what the CSV callers already destructure `MAX_FILE_SIZE` from and changing
// that shape would break them.
upload.receiptUpload = receiptUpload;
upload.MAX_RECEIPT_SIZE = MAX_RECEIPT_SIZE;
upload.RECEIPT_MIME_TYPES = RECEIPT_MIME_TYPES;
upload.validateMagicNumbers = validateMagicNumbers;

module.exports = upload;
