// server/routes/webhookRoutes.ts

import { Router, Request, Response } from 'express';
import { registerWebhook } from '../services/webhookService';

const router = Router();

router.post('/webhooks', async (req: Request, res: Response) => {
    try {
        const { url, event_type } = req.body;
        const userId = (req as any).user?.id || 'mock-user-id';

        if (!url || !['payroll.generated', 'employee.hired'].includes(event_type)) {
            return res.status(400).json({ error: 'Invalid URL or event type.' });
        }

        const subscription = await registerWebhook(userId, url, event_type);
        return res.status(201).json({
            message: 'Webhook registered successfully',
            subscription: {
                id: subscription.id,
                url: subscription.url,
                event_type: subscription.event_type,
                secret: subscription.secret, // Returned once for verification setup
            },
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
