export interface AuditMetadataDTO {
  clientIp: string;
  userAgent: string;
  mfaVerified: boolean;
}

export class EnterpriseAuditModel {
  public logId: string;
  public actionType: string;
  public actorUserId: string;
  public actorEmail: string;
  public targetEntityId: string;
  public payloadDigestSHA256: string;
  public metadata: AuditMetadataDTO;
  public isImmutableSigned: boolean;
  public createdAtISO: string;

  constructor(data: Partial<EnterpriseAuditModel>) {
    this.logId = data.logId || `aud_${Math.random().toString(36).substr(2, 9)}`;
    this.actionType = data.actionType || 'GENERIC_AUDIT_EVENT';
    this.actorUserId = data.actorUserId || 'usr_admin_001';
    this.actorEmail = data.actorEmail || 'admin@paysphere.io';
    this.targetEntityId = data.targetEntityId || 'res_payroll_01';
    this.payloadDigestSHA256 = data.payloadDigestSHA256 || 'sha256:00000000000000000000000000000000';
    this.metadata = data.metadata || {
      clientIp: '127.0.0.1',
      userAgent: 'PaySphere Enterprise Client',
      mfaVerified: true,
    };
    this.isImmutableSigned = data.isImmutableSigned ?? true;
    this.createdAtISO = data.createdAtISO || new Date().toISOString();
  }

  public toJSON() {
    return {
      logId: this.logId,
      actionType: this.actionType,
      actorUserId: this.actorUserId,
      actorEmail: this.actorEmail,
      targetEntityId: this.targetEntityId,
      payloadDigestSHA256: this.payloadDigestSHA256,
      metadata: this.metadata,
      isImmutableSigned: this.isImmutableSigned,
      createdAtISO: this.createdAtISO,
    };
  }
}
