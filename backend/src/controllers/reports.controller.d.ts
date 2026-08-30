import type { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    userId?: string;
    tenantId?: string;
    user?: any;
}
declare const getAnalytics: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
declare const downloadPDFReport: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
declare const exportExcelReport: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
declare const downloadPayslipsZip: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
declare const getTurnoverMetrics: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
declare const generateCustomReport: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
declare const reportsController: {
    getAnalytics: typeof getAnalytics;
    downloadPDFReport: typeof downloadPDFReport;
    exportExcelReport: typeof exportExcelReport;
    downloadPayslipsZip: typeof downloadPayslipsZip;
    getTurnoverMetrics: typeof getTurnoverMetrics;
    generateCustomReport: typeof generateCustomReport;
};
export = reportsController;
//# sourceMappingURL=reports.controller.d.ts.map