export type AssetStatus = 'active' | 'in维修' | 'retired' | 'lost' | 'on_loan' | 'available';
export type AssetCategory = 'laptop' | 'monitor' | 'phone' | 'tablet' | 'server' | 'peripheral' | 'furniture' | 'software_license';
export type Condition = 'excellent' | 'good' | 'fair' | 'poor';
export interface IAsset {
    id: string;
    tagNumber: string;
    name: string;
    category: AssetCategory;
    model: string;
    serialNumber: string;
    purchaseDate: string;
    purchasePrice: number;
    currentValue: number;
    depreciationRate: number;
    status: AssetStatus;
    condition: Condition;
    assignedTo: string | null;
    department: string;
    location: string;
    office: string;
    warrantyExpiry: string;
    lastMaintenanceDate: string | null;
    nextMaintenanceDate: string | null;
    notes: string;
}
export interface IAssetRequest {
    id: string;
    requestNumber: string;
    employeeId: string;
    employeeName: string;
    department: string;
    assetType: AssetCategory;
    justification: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'approved' | 'fulfilled' | 'denied';
    requestedAt: string;
    fulfilledAt: string | null;
}
export interface ISoftwareLicense {
    id: string;
    softwareName: string;
    vendor: string;
    licenseKey: string;
    totalSeats: number;
    usedSeats: number;
    expiryDate: string;
    cost: number;
    autoRenew: boolean;
    status: 'active' | 'expiring' | 'expired';
}
export declare function createMockAssets(): IAsset[];
export declare function createMockSoftwareLicenses(): ISoftwareLicense[];
export declare function createMockAssetRequests(): IAssetRequest[];
export declare function computeAssetsByCategory(assets: IAsset[]): Array<{
    category: AssetCategory;
    count: number;
    totalValue: number;
}>;
export declare function computeAssetsByOffice(assets: IAsset[]): Array<{
    office: string;
    count: number;
    totalValue: number;
}>;
export declare function computeDepreciationSummary(assets: IAsset[]): {
    totalPurchasePrice: number;
    totalCurrentValue: number;
    totalDepreciation: number;
    avgDepreciationRate: number;
};
//# sourceMappingURL=EnterpriseAssetModel.d.ts.map