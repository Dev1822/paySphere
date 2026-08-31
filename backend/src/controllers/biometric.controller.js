/**
 * @fileoverview Biometric Controller
 * @description Manages device registration, webhook ingestion, and manual reconciliation.
 * Issue: #1002
 */
const { BiometricDevice, RawPunchLog } = require('../models/biometric.model');
const { processDailySync } = require('../services/deviceSyncDaemon');
const logger = require('../utils/logger');

/**
 * POST /api/biometric/devices
 * Registers a new physical biometric device.
 */
exports.registerDevice = async (req, res, next) => {
    try {
        const { deviceName, deviceSerial, deviceIp, location } = req.body;

        const device = await BiometricDevice.create({
            deviceName,
            deviceSerial,
            deviceIp,
            location
        });

        res.status(201).json({ message: 'Device registered successfully', device });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Device serial number already registered.' });
        next(error);
    }
};

/**
 * POST /api/biometric/webhook/punch
 * Webhook endpoint for physical devices to push real-time punch logs.
 * (In production, this would be secured via device-specific API keys or IP whitelisting).
 */
exports.ingestPunch = async (req, res, next) => {
    try {
        const { externalEmployeeId, timestamp, punchType, verificationType } = req.body;
        const device = req.device;

        // Update last ping
        device.lastPingAt = new Date();
        await device.save();

        // Create raw log
        const punchLog = await RawPunchLog.create({
            tenantId: device.tenantId,
            deviceId: device._id,
            externalEmployeeId: String(externalEmployeeId),
            timestamp: new Date(timestamp),
            punchType: punchType || 'UNKNOWN',
            deviceIp: req.ip || device.deviceIp,
            verificationType: verificationType || 'Fingerprint'
        });

        const { detectAnomalyAndAlert } = require('../services/attendanceAnomaly');
        detectAnomalyAndAlert(punchLog).catch(err => {
            logger.error('Failed to run attendance anomaly detection', { error: err.message });
        });

        res.status(200).json({ message: 'Punch ingested' });
    } catch (error) { next(error); }
};

/**
 * GET /api/biometric/logs
 * Fetches raw punch logs, optionally filtered by status (e.g., Flagged).
 */
exports.getLogs = async (req, res, next) => {
    try {
        const { status, date } = req.query;
        const query = {};

        if (status) query.status = status;

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.timestamp = { $gte: start, $lte: end };
        }

        const logs = await RawPunchLog.find(query)
            .populate('deviceId', 'deviceName location')
            .sort({ timestamp: -1 })
            .limit(500);

        res.status(200).json({ logs });
    } catch (error) { next(error); }
};

/**
 * POST /api/biometric/reconcile
 * Manually triggers the sync daemon for a specific date.
 */
exports.triggerReconciliation = async (req, res, next) => {
    try {
        const { date } = req.body;
        const targetDate = date ? new Date(date) : new Date();

        const result = await processDailySync(req.tenantId, targetDate);
        res.status(200).json({ message: 'Reconciliation complete', result });
    } catch (error) { next(error); }
};
