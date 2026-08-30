/**
 * @fileoverview Centralized Error Handling Middleware
 * @description Catches all errors thrown by the application, casts Mongoose/JWT
 * errors into standardized AppErrors, and formats a consistent JSON response.
 *
 * Issue: #730
 */

const logger = require('../utils/logger');
const { AppError } = require('../utils/apiError');
const ResponseFormatter = require('../utils/responseFormatter');

/**
 * Handles Mongoose CastError (invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handles Mongoose duplicate key errors (Code 11000)
 */
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 409);
};

/**
 * Handles Mongoose validation errors
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handles expired JWT tokens
 */
const handleJWTExpiredError = () => {
  return new AppError('Your session has expired. Please log in again.', 401);
};

/**
 * Handles invalid JWT signatures/tokens
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.status || 'error',
      details: err,
      stack: err.stack,
    },
  });
};

/**
 * Formats the error response for Production environments
 * Hides stack traces and internal details for operational errors
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res
      .status(err.statusCode)
      .json(ResponseFormatter.error(err.message, null, err.status || 'error'));
  }
  // Programming or other unknown error: don't leak details
  else {
    // Log detailed error for developers
    logger.error('ERROR 💥', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    // Send generic message to client
    res
      .status(500)
      .json(
        ResponseFormatter.error(
          'Something went very wrong!',
          null,
          'internal_server_error',
        ),
      );
  }
};

/**
 * Global Error Handling Middleware
 * Must have exactly 4 parameters for Express to recognize it as an error handler
 */

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // Create a copy to avoid mutating the original error object
    let error = { ...err, message: err.message, name: err.name };

    // Cast specific database/auth errors into standardized AppErrors
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = globalErrorHandler;
