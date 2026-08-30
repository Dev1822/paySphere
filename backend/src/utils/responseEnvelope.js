class ResponseEnvelope {
  static success(data = null, meta = null) {
    const envelope = {
      success: true,
      data,
    };
    if (meta) {
      envelope.meta = meta;
    }
    return envelope;
  }

  static error(message, code = null, details = null) {
    const envelope = {
      success: false,
      error: {
        message,
      },
    };
    if (code) {
      envelope.error.code = code;
    }
    if (details) {
      envelope.error.details = details;
    }
    return envelope;
  }
}

module.exports = ResponseEnvelope;
