/**
 * @fileoverview Database Archival and Purge Job
 * @description Monthly cron job to compress and archive payroll/audit/attendance records older than 7 years to AWS S3 Glacier.
 * Issue: #1846
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const PayrollUpdate = require('../models/payroll.model');
const AuditLog = require('../models/auditLog.model');
const Attendance = require('../models/attendance.model');
const { uploadToGlacier } = require('../utils/s3Archiver');
const logger = require('../utils/logger');

/**
 * Automates database archival and purge of historical payroll records.
 * Packages data older than 7 years into a ZIP file, uploads it to S3 Glacier,
 * and deletes the active MongoDB documents to reclaim space.
 */
async function runDatabaseArchivalJob() {
  const years = parseInt(process.env.ARCHIVAL_THRESHOLD_YEARS, 10) || 7;
  const cutoffDate = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  logger.info('Starting automated database archival job...', { cutoffDate, years });

  const archiveDir = path.join(__dirname, '../../archives');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const archiveFileName = `archival-${timestamp}.zip`;
  const archiveFilePath = path.join(archiveDir, archiveFileName);

  // 1. Fetch matching historical records
  const payrollQuery = { createdAt: { $lt: cutoffDate } };
  const auditQuery = { createdAt: { $lt: cutoffDate } };
  const attendanceQuery = { createdAt: { $lt: cutoffDate } };

  const [payrolls, auditLogs, attendances] = await Promise.all([
    PayrollUpdate.find(payrollQuery).lean(),
    AuditLog.find(auditQuery).lean(),
    Attendance.find(attendanceQuery).lean(),
  ]);

  const totalCount = payrolls.length + auditLogs.length + attendances.length;
  if (totalCount === 0) {
    logger.info('No historical database records found to archive.');
    return { success: true, archivedCount: 0 };
  }

  logger.info(`Found ${totalCount} records to archive.`, {
    payrolls: payrolls.length,
    auditLogs: auditLogs.length,
    attendances: attendances.length,
  });

  // 2. Compress documents into a ZIP archive
  const output = fs.createWriteStream(archiveFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const archivePromise = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(output);

  archive.append(JSON.stringify(payrolls, null, 2), { name: 'payroll.json' });
  archive.append(JSON.stringify(auditLogs, null, 2), { name: 'audit_logs.json' });
  archive.append(JSON.stringify(attendances, null, 2), { name: 'attendance.json' });

  await archive.finalize();
  await archivePromise;

  const fileStats = fs.statSync(archiveFilePath);
  logger.info('Historical data archive ZIP created successfully.', { 
    filePath: archiveFilePath, 
    sizeBytes: fileStats.size 
  });

  // 3. Upload to AWS S3 Glacier
  const s3Bucket = process.env.ARCHIVAL_S3_BUCKET || process.env.BACKUP_S3_BUCKET;
  let isUploaded = false;

  if (s3Bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const fileBuffer = fs.readFileSync(archiveFilePath);
      const s3Key = `archives/${archiveFileName}`;
      
      await uploadToGlacier(s3Bucket, s3Key, fileBuffer);
      logger.info('Archive ZIP successfully uploaded to cold storage Glacier.');
      
      // Clean up local ZIP file
      fs.unlinkSync(archiveFilePath);
      isUploaded = true;
    } catch (err) {
      logger.error('AWS S3 Glacier upload failed. Local archive preserved.', { error: err.message });
      throw err;
    }
  } else {
    logger.warn('Glacier S3 bucket credentials missing. Retaining archive locally.', {
      localFilePath: archiveFilePath
    });
  }

  // 4. Payroll and audit records are historical records and must remain
  // available for reporting and audit purposes. Only attendance is eligible
  // for physical removal here because finalized payroll snapshots contain the
  // attendance-derived values needed to reproduce historical payroll.
  logger.info(
    'Historical payroll and audit records retained after archival.',
    {
      payrollsRetained: payrolls.length,
      auditLogsRetained: auditLogs.length,
    },
  );

  const attendancePurged = await Attendance.deleteMany(attendanceQuery);

  logger.info('Attendance purge completed successfully.', {
    attendancesPurged: attendancePurged.deletedCount,
  });

  return {
    success: true,
    archivedCount: totalCount,
    uploadedToS3: isUploaded,
    purged: {
      payrolls: 0,
      auditLogs: 0,
      attendances: attendancePurged.deletedCount,
    },
    retained: {
      payrolls: payrolls.length,
      auditLogs: auditLogs.length,
    },
  };}

module.exports = { runDatabaseArchivalJob };
