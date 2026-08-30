const { processGeofencedPunch, enqueueBiometricSync } = require('../services/attendanceGateway.service');

exports.punch = async (req, res, next) => {
  try {
    const { employeeId, latitude, longitude, deviceFingerprint } = req.body;
    const tenantId = req.tenantId;

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required' });
    }
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const record = await processGeofencedPunch({
      tenantId,
      employeeId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      deviceFingerprint,
      userId: req.userId,
    });

    res.status(200).json({
      message: 'Punch recorded successfully',
      record,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

exports.syncBiometric = async (req, res, next) => {
  try {
    const { employeeId, year, month, logs } = req.body;
    const tenantId = req.tenantId;

    if (!employeeId || !year || !month || !logs) {
      return res.status(400).json({ error: 'employeeId, year, month, and logs are required' });
    }

    const result = await enqueueBiometricSync({
      tenantId,
      employeeId,
      year: Number(year),
      month: Number(month),
      logs,
    });

    res.status(202).json({
      message: 'Biometric logs queued for sync',
      jobId: result.jobId,
    });
  } catch (error) {
    next(error);
  }
};
