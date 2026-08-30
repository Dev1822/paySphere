const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const logger = require('../utils/logger');

let io;

/**
 * Initializes the shiftMarketplace socket namespace to broadcast surge pricing updates.
 */
exports.init = (server) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error(
      'JWT_SECRET is not set. Refusing to start the shiftMarketplace socket server.',
    );
    return;
  }

  io = socketIo(server, {
    path: '/socket.io-shift', // Distinct path if needed, or share the global io
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id)
        .select('_id tenantId isActive')
        .lean();
      if (!user || !user.isActive)
        return next(new Error('Authentication error'));

      socket.identity = {
        userId: String(user._id),
        tenantId: String(user.tenantId || decoded.tenantId),
      };
      return next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const { tenantId } = socket.identity;
    socket.join(`tenant:${tenantId}`);

    socket.on('disconnect', () => {
      // Disconnect handling
    });
  });

  return io;
};

exports.getIo = () => io;
