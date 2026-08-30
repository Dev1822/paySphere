const crypto = require('crypto');
const ResponseEnvelope = require('../utils/responseEnvelope');

/**
 * Middleware that intercepts res.json to automatically wrap responses in a standard envelope.
 * Injects correlationId and processingTime in the meta object.
 */
const responseEnvelopeMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const originalJson = res.json;

  // Attach correlation ID to request if not already present
  req.correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  const startTime = Date.now();

  res.json = function (body) {
    // If the body is already enveloped (e.g. by an error handler or explicitly), send it as-is
    if (
      body &&
      Object.prototype.hasOwnProperty.call(body, 'success') &&
      (Object.prototype.hasOwnProperty.call(body, 'data') ||
        Object.prototype.hasOwnProperty.call(body, 'error'))
    ) {
      if (body.success) {
        body.meta = {
          ...body.meta,
          correlationId: req.correlationId,
          processingTimeMs: Date.now() - startTime,
        };
      }
      return originalJson.call(this, body);
    }

    // Default to success true if status code is < 400
    const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

    let envelopedBody;
    if (isSuccess) {
      envelopedBody = ResponseEnvelope.success(body, {
        correlationId: req.correlationId,
        processingTimeMs: Date.now() - startTime,
      });
    } else {
      // If it's an error and not enveloped, try to extract error details
      const message = body && body.message ? body.message : 'An error occurred';
      const code = body && body.code ? body.code : null;
      const details = body && body.details ? body.details : null;
      envelopedBody = ResponseEnvelope.error(message, code, details);
    }

    return originalJson.call(this, envelopedBody);
  };

  next();
};

module.exports = responseEnvelopeMiddleware;
