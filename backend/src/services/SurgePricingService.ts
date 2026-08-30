import { OpenShift } from '../models/shiftMarketplace.model';
import logger from '../utils/logger';
import { getIo } from '../sockets/shiftMarketplace.socket';

const UPDATE_INTERVAL_MS = 60000; // Run every minute

export class SurgePricingService {
  private timer: NodeJS.Timeout | null = null;

  start() {
    if (this.timer) return;
    logger.info('Starting SurgePricingService for dynamic shift bidding');
    this.timer = setInterval(
      () => this.evaluateSurgePricing(),
      UPDATE_INTERVAL_MS,
    );
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async evaluateSurgePricing() {
    try {
      // Find all open shifts expiring in the future
      const now = new Date();
      const openShifts = await OpenShift.find({
        status: 'Open',
        expiresAt: { $gt: now },
      });

      for (const shift of openShifts) {
        let newMultiplier = shift.premiumMultiplier || 1.0;

        // 1. Evaluate proximity to start time
        // Shift start time needs to be constructed from date and startTime string
        const shiftStart = new Date(shift.date);
        const [h, m] = shift.startTime.split(':').map(Number);
        shiftStart.setHours(h, m, 0, 0);

        const hoursUntilStart =
          (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilStart <= 2 && hoursUntilStart > 0) {
          // If within 2 hours of start time, bump multiplier by 0.5 up to max of 3.0
          // E.g., at 2h -> 1.5, at 1h -> 2.0, at 0.5h -> 2.5
          const urgencyBump = (2 - hoursUntilStart) * 0.5;
          newMultiplier = Math.max(newMultiplier, 1.0 + urgencyBump);
        }

        // 2. Evaluate unit acuity if applicable
        if (
          ['Emergency', 'ICU', 'neurocriticalCare', 'pediatricICU'].includes(
            shift.requiredDepartment,
          )
        ) {
          // Simulate fetching acuity. Assuming `emergencyTriageService` could provide this.
          // For now, if requiredDepartment is high acuity, apply an extra bump.
          newMultiplier += 0.2;
        }

        // Cap at 3.0
        newMultiplier = Math.min(newMultiplier, 3.0);

        // Precision round to 2 decimals
        newMultiplier = Math.round(newMultiplier * 100) / 100;

        if (newMultiplier !== shift.premiumMultiplier) {
          shift.premiumMultiplier = newMultiplier;
          await shift.save();

          logger.info(
            `Surge pricing updated for shift ${shift._id}: x${newMultiplier}`,
          );

          // Broadcast to connected clients
          const io = getIo();
          if (io) {
            io.to(`tenant:${shift.tenantId}`).emit('shift_price_updated', {
              shiftId: shift._id,
              premiumMultiplier: newMultiplier,
              nextUpdateInSeconds: 60,
            });
          }
        }
      }
    } catch (error: any) {
      logger.error('Error in SurgePricingService', { error: error.message });
    }
  }
}

export default new SurgePricingService();
