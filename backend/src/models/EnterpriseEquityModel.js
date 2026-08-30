"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseEquityModel = void 0;
class EnterpriseEquityModel {
    grantId;
    granteeId;
    granteeName;
    grantType;
    totalSharesGranted;
    strikePriceUSD;
    fairMarketValueUSD;
    cliffDurationMonths;
    totalVestingMonths;
    tranches;
    isApprovedByBoard;
    createdAt;
    constructor(data) {
        this.grantId = data.grantId || `eq_${Math.random().toString(36).substr(2, 9)}`;
        this.granteeId = data.granteeId || 'usr_emp_101';
        this.granteeName = data.granteeName || 'Key Employee';
        this.grantType = data.grantType || 'ISO';
        this.totalSharesGranted = data.totalSharesGranted || 50000;
        this.strikePriceUSD = data.strikePriceUSD || 1.50;
        this.fairMarketValueUSD = data.fairMarketValueUSD || 18.50;
        this.cliffDurationMonths = data.cliffDurationMonths || 12;
        this.totalVestingMonths = data.totalVestingMonths || 48;
        this.tranches = data.tranches || [];
        this.isApprovedByBoard = data.isApprovedByBoard ?? true;
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() {
        return {
            grantId: this.grantId,
            granteeId: this.granteeId,
            granteeName: this.granteeName,
            grantType: this.grantType,
            totalSharesGranted: this.totalSharesGranted,
            strikePriceUSD: this.strikePriceUSD,
            fairMarketValueUSD: this.fairMarketValueUSD,
            cliffDurationMonths: this.cliffDurationMonths,
            totalVestingMonths: this.totalVestingMonths,
            tranches: this.tranches,
            isApprovedByBoard: this.isApprovedByBoard,
            createdAt: this.createdAt,
        };
    }
}
exports.EnterpriseEquityModel = EnterpriseEquityModel;
//# sourceMappingURL=EnterpriseEquityModel.js.map