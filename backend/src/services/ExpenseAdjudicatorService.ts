import { Types } from 'mongoose';
const ExpenseClaim = require('../models/expenseClaim.model');
const { ExpensePolicy } = require('../models/expensePolicy.model');
const ExpenseCategory = require('../models/expenseCategory.model');
const ComplianceConfig = require('../models/complianceConfig.model');
const { verifyExpenseClaim } = require('./expenseVerification');

export class ExpenseAdjudicatorService {
  /**
   * Run automated adjudication for a given expense claim.
   * This includes OCR stub matching, policy evaluation,
   * risk score calculation, and auto-approval.
   *
   * @param claimId - The ID of the expense claim
   * @returns The adjudicated and updated expense claim
   */
  public static async adjudicateClaim(claimId: string): Promise<any> {
    let claim = await ExpenseClaim.findById(claimId);
    if (!claim) {
      throw new Error(`ExpenseClaim not found: ${claimId}`);
    }

    // 1. OCR Extraction Stub (Simulating data extraction)
    // If no OCR metadata exists, we mock it. In a real scenario, this comes from an OCR service.
    if (!claim.ocrMetadata || Object.keys(claim.ocrMetadata).length === 0) {
      // Stub: Randomize a mismatch occasionally, but default to mostly exact matches
      const isMismatch = Math.random() > 0.8;
      claim.ocrMetadata = {
        extractedAmount: isMismatch ? claim.amount * 1.1 : claim.amount,
        extractedDate: claim.expenseDate,
        extractedCurrency: claim.currency,
      };
    }

    // 2. Base verification (from existing logic: duplicates, OCR mismatches, monthly limits)
    claim = await verifyExpenseClaim(claim);

    // 3. Adjudicator specific checks and Risk Score Calculation
    let riskScore = 0;
    const policyViolations: string[] = [];

    // Duplicate check
    if (
      claim.isPossibleFraud &&
      claim.fraudDetails.includes('Duplicate receipt')
    ) {
      riskScore += 50;
      policyViolations.push('Duplicate Receipt Detected');
    }

    // OCR amount mismatch
    if (
      claim.isPossibleFraud &&
      claim.fraudDetails.includes('OCR amount mismatch')
    ) {
      riskScore += 30;
      policyViolations.push('Amount Mismatch between Claim and Receipt');
    }

    // OCR date mismatch
    if (
      claim.isPossibleFraud &&
      claim.fraudDetails.includes('OCR date mismatch')
    ) {
      riskScore += 20;
      policyViolations.push('Date Mismatch between Claim and Receipt');
    }

    // Monthly Limit Exceeded
    if (
      claim.isPossibleFraud &&
      claim.fraudDetails.includes('exceeding category limit')
    ) {
      riskScore += 40;
      policyViolations.push('Exceeds Monthly Policy Limit');
    }

    // Per Claim Limit Exceeded
    if (
      claim.isPossibleFraud &&
      claim.fraudDetails.includes('exceeds category limit per claim')
    ) {
      riskScore += 40;
      policyViolations.push('Out of Policy Amount (Per Claim Limit)');
    }

    // Additional Policy Checks
    const policy = await ExpensePolicy.findOne({ tenantId: claim.tenantId });
    if (policy) {
      const categoryDoc = await ExpenseCategory.findById(claim.categoryId);
      const categoryName = categoryDoc ? categoryDoc.name : '';
      const categoryLimit = policy.categories.find(
        (c: any) => c.category === categoryName,
      );

      if (categoryLimit) {
        // Receipt Required check
        if (
          categoryLimit.requiresReceipt &&
          claim.amount > categoryLimit.receiptThreshold
        ) {
          if (!claim.receipts || claim.receipts.length === 0) {
            riskScore += 60;
            policyViolations.push('Missing Required Receipt');
          }
        }

        // Weekend Allowed check
        if (!categoryLimit.weekendAllowed) {
          const expenseDate = new Date(claim.expenseDate);
          const day = expenseDate.getDay();
          if (day === 0 || day === 6) {
            riskScore += 30;
            policyViolations.push('Weekend Expense Not Allowed for Category');
          }
        }
      }

      // Check complianceConfig for tenant valid deductor context (optional extra validation)
      const compliance = await ComplianceConfig.findOne({
        tenantId: claim.tenantId,
      });
      if (!compliance || !compliance.pan) {
        // Minor flag if tenant compliance is misconfigured
        riskScore += 10;
        policyViolations.push('Tenant Compliance Configuration Missing');
      }

      // 4. Auto-Approval Logic
      const threshold = policy.autoApprovalThreshold || 20; // Ensure fallback
      claim.fraudRiskScore = Math.min(riskScore, 100);
      claim.policyViolations = policyViolations;

      if (claim.fraudRiskScore < 20 && claim.amount <= threshold) {
        claim.status = 'approved';
      } else {
        claim.status = 'pending_approval';
      }
    } else {
      // Default behavior if no policy exists
      claim.fraudRiskScore = Math.min(riskScore, 100);
      claim.policyViolations = policyViolations;
      claim.status =
        claim.fraudRiskScore < 20 ? 'approved' : 'pending_approval';
    }

    await claim.save();
    return claim;
  }
}
