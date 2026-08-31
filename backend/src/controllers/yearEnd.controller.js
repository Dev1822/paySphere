/**
 * @fileoverview Year-End Controller
 * @description Manages W-2 aggregation, EFW2 magnetic media generation, and audit dashboards.
 * Issue: #1757
 */
const mongoose = require('mongoose');
const { YearEndProcessing, W2BoxData, MagneticMediaFile } = require('../models/yearEndProcessing.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model').PayrollUpdate; // Assuming exists
const {
    calculateW2Boxes, generateERRecord, generateRWRecord,
    generateRORecord, generateRTRecord
} = require('../utils/w2GenerationEngine.utils');
const logger = require('../utils/logger');

exports.triggerAggregation = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { taxYear } = req.body;

        let batch = await YearEndProcessing.findOne({
            taxYear
        }).session(session);
        if (batch && batch.status === 'Completed') {
            throw new Error('Year-end processing for this tax year is already completed.');
        }

        if (!batch) {
            batch = await YearEndProcessing.create([{
                taxYear,
                triggeredBy: req.userId
            }], { session });
            batch = batch[0];
        }

        batch.status = 'Aggregating';
        await batch.save({ session });

        // Fetch all employees and their YTD payroll data
        const employees = await Employee.find({}).session(session);

        // Mocking YTD aggregation from PayrollUpdate model
        // In production, this would be a complex $group aggregation pipeline
        const ytdMockData = employees.map(emp => ({
            employee: emp,
            grossWages: 85000 + Math.random() * 50000,
            preTaxDeductions: 5000 + Math.random() * 15000, // 401k, etc.
            federalTaxWithheld: 12000 + Math.random() * 8000,
            ssTaxWithheld: 5000 + Math.random() * 5000,
            medicareTaxWithheld: 1200 + Math.random() * 1500
        }));

        let totalWages = 0, totalFedTax = 0, totalSSWages = 0, totalMedWages = 0;

        for (const data of ytdMockData) {
            const boxes = calculateW2Boxes(data);

            await W2BoxData.findOneAndUpdate(
                {
                    employeeId: data.employee._id,
                    taxYear
                },
                { ...boxes, processingBatchId: batch._id },
                { upsert: true, session }
            );

            totalWages += boxes.box1_Wages;
            totalFedTax += boxes.box2_FederalTax;
            totalSSWages += boxes.box3_SSWages;
            totalMedWages += boxes.box5_MedicareWages;
        }

        batch.totalEmployeesProcessed = employees.length;
        batch.totalWages = totalWages;
        batch.totalFederalTax = totalFedTax;
        batch.totalSocialSecurityWages = totalSSWages;
        batch.totalMedicareWages = totalMedWages;
        batch.status = 'Completed';
        batch.completedAt = new Date();
        await batch.save({ session });

        await session.commitTransaction();
        logger.info(`[YearEnd] Aggregated W-2 data for ${employees.length} employees for tax year ${taxYear}`);
        res.status(200).json({ message: 'Year-end aggregation completed successfully', batch });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.generateMagneticMedia = async (req, res, next) => {
    try {
        const { taxYear } = req.body;
        const batch = await YearEndProcessing.findOne({
            taxYear,
            status: 'Completed'
        });
        if (!batch) return res.status(400).json({ message: 'Must complete aggregation before generating magnetic media.' });

        const w2Records = await W2BoxData.find({ processingBatchId: batch._id }).populate('employeeId');

        // Mock Employer Data
        const employerData = {
            ein: '12-3456789', controlNumber: '0001', name: 'PaySphere Global Inc',
            address1: '100 Corporate Blvd', city: 'New York', state: 'NY', zip: '10001',
            contactName: 'Jane Doe', contactPhone: '555-019-8372', contactEmail: 'payroll@paysphere.com'
        };

        let fileContent = generateERRecord(employerData, taxYear) + '\n';

        let roTotals = { box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0, box7: 0, box8: 0, box10: 0, box11: 0 };

        for (const rec of w2Records) {
            const emp = rec.employeeId;
            const rwRecord = generateRWRecord(
                {
                    ssn: emp.ssn || '999-99-9999', firstName: emp.firstName || 'John',
                    lastName: emp.lastName || 'Doe', address1: emp.address || '123 Main St',
                    city: emp.city || 'Anytown', state: emp.state || 'CA', zip: emp.zip || '90210',
                    has401k: rec.box12a_Code === 'D'
                },
                rec,
                taxYear
            );
            fileContent += rwRecord + '\n';

            roTotals.box1 += rec.box1_Wages;
            roTotals.box2 += rec.box2_FederalTax;
            roTotals.box3 += rec.box3_SSWages;
            roTotals.box4 += rec.box4_SSTax;
            roTotals.box5 += rec.box5_MedicareWages;
            roTotals.box6 += rec.box6_MedicareTax;
            roTotals.box10 += rec.box10_DependentCare;
        }

        fileContent += generateRORecord(roTotals, w2Records.length) + '\n';
        fileContent += generateRTRecord(roTotals, 1) + '\n'; // 1 RO record

        const fileName = `EFW2_W2_${taxYear}_${employerData.ein}.txt`;
        const mediaFile = await MagneticMediaFile.create({
            processingBatchId: batch._id,
            taxYear,
            fileName,
            fileContent,
            totalRWRecords: w2Records.length,
            totalWagesSubmitted: roTotals.box1,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'EFW2 Magnetic Media file generated', mediaFile });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const batches = await YearEndProcessing.find({}).sort({ taxYear: -1 });
        const files = await MagneticMediaFile.find({}).sort({ createdAt: -1 }).limit(10);

        // Fetch discrepancy flags
        const discrepancies = await W2BoxData.find({
            hasDiscrepancy: true
        })
            .populate('employeeId', 'fullName')
            .limit(50);

        res.status(200).json({ batches, files, discrepancies });
    } catch (error) { next(error); }
};

exports.downloadFile = async (req, res, next) => {
    try {
        const file = await MagneticMediaFile.findOne({
            _id: req.params.fileId
        });
        if (!file) return res.status(404).json({ message: 'File not found' });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
        res.send(file.fileContent);
    } catch (error) { next(error); }
};
