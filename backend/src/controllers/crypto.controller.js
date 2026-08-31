const { CryptoPayoutBatch } = require('../models/cryptoPayroll.model');
const cryptoPayoutWorker = require('../workers/cryptoPayout.worker');
const { CryptoPayrollService } = require('../services/CryptoPayrollService');
const cryptoService = new CryptoPayrollService();

/**
 * GET /api/crypto/wallets
 * Returns the list of wallets configured in the system.
 */
exports.getWallets = async (req, res, next) => {
  try {
    const wallets = cryptoService.getWallets();
    res.status(200).json({ success: true, data: wallets });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/crypto/disburse-batch
 * Initiates an on-chain batch payout to stablecoin addresses.
 */
exports.disburseCryptoBatch = async (req, res, next) => {
  try {
    const { walletId, tokenSymbol, tokenAddress, recipients } = req.body;

    if (!walletId || !tokenAddress || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Invalid payout parameters' });
    }

    // Create the batch database record
    const batch = await CryptoPayoutBatch.create({
      walletId,
      tokenSymbol: tokenSymbol || 'USDC-SPL',
      tokenAddress,
      recipients,
      status: 'Pending'
    });

    // Delegate execution to the transaction worker asynchronously
    cryptoPayoutWorker.processPayoutBatch(batch._id).catch(err => {
      console.error('Failed to trigger background payout execution', err);
    });

    res.status(201).json({
      message: 'Cryptocurrency disbursement batch initiated',
      batchId: batch._id,
      status: batch.status
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/crypto/payout-logs
 * Fetches transaction history for cryptocurrency disbursements.
 */
exports.getPayoutLogs = async (req, res, next) => {
  try {
    const logs = await CryptoPayoutBatch.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
