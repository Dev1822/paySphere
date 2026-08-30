// server/services/webhookService.ts

import axios from 'axios';
import crypto from 'crypto';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface WebhookSubscription {
    id: string;
    user_id: string;
    url: string;
    event_type: 'payroll.generated' | 'employee.hired';
    secret: string;
}

/**
 * Dispatches a webhook payload to all registered URLs subscribed to the specific event.
 */
export async function dispatchWebhook(eventType: 'payroll.generated' | 'employee.hired', payload: object): Promise<void> {
    const client = await pool.connect();
    try {
        const result = await client.query<WebhookSubscription>(
            `SELECT * FROM webhook_subscriptions WHERE event_type = $1`,
            [eventType]
        );

        const dispatchPromises = result.rows.map(async (sub) => {
            const body = JSON.stringify({
                event: eventType,
                timestamp: new Date().toISOString(),
                data: payload,
            });

            const signature = crypto
                .createHmac('sha256', sub.secret)
                .update(body)
                .digest('hex');

            try {
                await axios.post(sub.url, body, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-PaySphere-Signature': signature,
                        'X-PaySphere-Event': eventType,
                    },
                    timeout: 5000,
                });
            } catch (err: any) {
                console.error(`Failed to dispatch webhook to ${sub.url}:`, err.message);
            }
        });

        await Promise.allSettled(dispatchPromises);
    } finally {
        client.release();
    }
}

/**
 * Registers a new webhook subscription endpoint.
 */
export async function registerWebhook(userId: string, url: string, eventType: 'payroll.generated' | 'employee.hired'): Promise<WebhookSubscription> {
    const client = await pool.connect();
    const secret = crypto.randomBytes(32).toString('hex');
    try {
        const res = await client.query<WebhookSubscription>(
            `INSERT INTO webhook_subscriptions (user_id, url, event_type, secret)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, url, eventType, secret]
        );
        return res.rows[0];
    } finally {
        client.release();
    }
}
