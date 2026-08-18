import { Router, Request, Response } from 'express';

export interface AuditLogDTO {
  id: string;
  actionName: string;
  actorEmail: string;
  targetResource: string;
  hashChecksum: string;
  severity: string;
  timestampISO: string;
}

export class EnterpriseAuditService {
  private logs: AuditLogDTO[] = [
    {
      id: 'aud-701',
      actionName: 'PAYROLL_BATCH_APPROVAL',
      actorEmail: 'cfo@paysphere.io',
      targetResource: 'US-West Monthly Payroll Batch #9021',
      hashChecksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      severity: 'HIGH_SECURITY',
      timestampISO: new Date().toISOString(),
    },
    {
      id: 'aud-702',
      actionName: 'DIRECT_DEPOSIT_BANK_CHANGE',
      actorEmail: 'e.rostova@paysphere.io',
      targetResource: 'JPMorgan Chase Account ****9821',
      hashChecksum: 'sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      severity: 'MEDIUM_SECURITY',
      timestampISO: new Date().toISOString(),
    },
  ];

  public getAuditLogs(): AuditLogDTO[] {
    return this.logs;
  }

  public verifyLogIntegrity(id: string): { isValid: boolean; sha256Checksum: string } | null {
    const log = this.logs.find(l => l.id === id);
    if (!log) return null;
    return { isValid: true, sha256Checksum: log.hashChecksum };
  }
}

const auditService = new EnterpriseAuditService();
const auditRouter = Router();

auditRouter.get('/audit/logs', (req: Request, res: Response) => {
  res.json({ success: true, data: auditService.getAuditLogs() });
});

auditRouter.get('/audit/logs/:id/verify', (req: Request, res: Response) => {
  const result = auditService.verifyLogIntegrity(req.params.id);
  if (!result) return res.status(404).json({ success: false, error: 'Audit log entry not found' });
  res.json({ success: true, data: result });
});

export default auditRouter;
