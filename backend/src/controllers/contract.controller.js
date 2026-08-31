/**
 * @fileoverview Contract Controller
 * @description Handles template management, contract issuance, magic link verification, and acceptance.
 * Issue: #984
 */
const mongoose = require('mongoose');
const { Worker } = require('worker_threads');
const path = require('path');
const { ContractTemplate, IssuedContract } = require('../models/contract.model');
const logger = require('../utils/logger');

/**
 * Populates an HTML template with candidate-specific variables.
 * @param {string} html - The raw HTML template
 * @param {Object} variables - Key-value pairs of data to inject
 * @returns {string} Populated HTML
 */
function populateTemplate(html, variables) {
    let populated = html;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        populated = populated.replace(regex, value || '');
    }
    return populated;
}

/**
 * POST /api/contracts/issue
 * HR issues a new contract to a candidate, generating a magic link and PDF.
 */
exports.issueContract = async (req, res, next) => {
    try {
        const { templateId, candidateName, candidateEmail, variables } = req.body;

        const template = await ContractTemplate.findOne({
            _id: templateId
        });
        if (!template) return res.status(404).json({ message: 'Template not found' });

        const populatedHtml = populateTemplate(template.htmlContent, variables);
        const magicToken = IssuedContract.generateMagicToken();
        const magicTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Generate PDF via worker thread
        const pdfWorker = new Worker(path.join(__dirname, '../workers/contractPdf.worker.js'));

        const pdfPromise = new Promise((resolve, reject) => {
            pdfWorker.postMessage({
                type: 'GENERATE_CONTRACT_PDF',
                payload: { populatedHtml, candidateName, companyName: variables.companyName }
            });

            pdfWorker.on('message', (result) => {
                if (result.success) resolve(result.pdfData);
                else reject(new Error(result.error));
            });
            pdfWorker.on('error', reject);
        });

        let pdfBuffer;
        try {
            pdfBuffer = await pdfPromise;
        } catch (pdfError) {
            logger.error('PDF generation failed, issuing contract without PDF attachment', { error: pdfError.message });
            pdfBuffer = null;
        } finally {
            pdfWorker.terminate();
        }

        // In a real app, upload pdfBuffer to S3/Cloudinary and get the URL.
        // For this implementation, we'll mock the URL.
        const mockPdfUrl = pdfBuffer ? `/mock-storage/contract-${magicToken}.pdf` : '';

        const contract = await IssuedContract.create({
            templateId,
            candidateName,
            candidateEmail,
            populatedHtml,
            pdfUrl: mockPdfUrl,
            magicToken,
            magicTokenExpiresAt,
            status: 'Sent'
        });

        // Generate the magic link URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const magicLink = `${frontendUrl}/contract/view/${magicToken}`;

        // TODO: Send email with magicLink to candidateEmail via email.service.js

        res.status(201).json({
            message: 'Contract issued and magic link generated',
            contractId: contract._id,
            magicLink // Returned for testing/demo purposes; in prod, only sent via email
        });
    } catch (error) { next(error); }
};

/**
 * GET /api/contracts/public/:token
 * Public endpoint for candidates to view their offer letter.
 */
exports.viewPublicContract = async (req, res, next) => {
    try {
        const contract = await IssuedContract.findOne({ magicToken: req.params.token });

        if (!contract) return res.status(404).json({ message: 'Invalid or expired contract link' });
        if (contract.status === 'Expired' || contract.magicTokenExpiresAt < new Date()) {
            return res.status(410).json({ message: 'This offer link has expired' });
        }

        // Mark as viewed if first time
        if (contract.status === 'Sent') {
            contract.status = 'Viewed';
            await contract.save();
        }

        // Return safe public fields (do not return magicToken or internal IDs)
        res.status(200).json({
            candidateName: contract.candidateName,
            populatedHtml: contract.populatedHtml,
            pdfUrl: contract.pdfUrl,
            status: contract.status,
            expiresAt: contract.magicTokenExpiresAt
        });
    } catch (error) { next(error); }
};

/**
 * POST /api/contracts/public/:token/accept
 * Candidate digitally accepts the offer.
 */
exports.acceptContract = async (req, res, next) => {
    try {
        const contract = await IssuedContract.findOne({ magicToken: req.params.token });

        if (!contract || contract.magicTokenExpiresAt < new Date()) {
            return res.status(410).json({ message: 'This offer link has expired' });
        }
        if (contract.status === 'Accepted') {
            return res.status(400).json({ message: 'This offer has already been accepted' });
        }

        contract.status = 'Accepted';
        contract.acceptedAt = new Date();
        contract.ipAddressAccepted = req.ip || req.headers['x-forwarded-for'] || 'Unknown';
        await contract.save();

        // Trigger onboarding workflow (e.g., create Employee record in Draft state)
        // eventBus.emit('CANDIDATE_ACCEPTED_OFFER', { contractId: contract._id, tenantId: contract.tenantId });

        res.status(200).json({ message: 'Offer accepted successfully. Welcome to the team!' });
    } catch (error) { next(error); }
};
