/**
 * @fileoverview Internal Job Controller
 * @description Manages internal job postings, applications, and triggers seamless transfers upon hiring.
 * Issue: #1167
 */
const { InternalJob, InternalApplication } = require('../models/internalJob.model');
const Employee = require('../models/employee.model');
const { executeSeamlessTransfer } = require('../utils/transferEngine.utils');
const logger = require('../utils/logger');

exports.postJob = async (req, res, next) => {
    try {
        const { title, department, description, requiredSkills, resetProbation } = req.body;
        const job = await InternalJob.create({
            title,
            department,
            description,
            requiredSkills: requiredSkills || [],
            resetProbation,
            postedBy: req.userId
        });
        res.status(201).json({ message: 'Internal job posted', job });
    } catch (error) { next(error); }
};

exports.getOpenJobs = async (req, res, next) => {
    try {
        const jobs = await InternalJob.find({
            status: 'Open'
        })
            .populate('managerId', 'fullName')
            .sort({ createdAt: -1 });
        res.status(200).json({ jobs });
    } catch (error) { next(error); }
};

exports.applyToJob = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const application = await InternalApplication.create({
            jobId: req.params.jobId,
            applicantId: employee._id,
            coverLetter: req.body.coverLetter || ''
        });
        res.status(201).json({ message: 'Application submitted', application });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'You have already applied to this job.' });
        next(error);
    }
};

exports.getPipeline = async (req, res, next) => {
    try {
        const applications = await InternalApplication.find({
            jobId: req.params.jobId
        })
            .populate('applicantId', 'fullName department role email')
            .sort({ createdAt: -1 });
        res.status(200).json({ applications });
    } catch (error) { next(error); }
};

exports.updateApplicationStatus = async (req, res, next) => {
    try {
        const { status, hiringManagerNotes, interviewDate } = req.body;
        const app = await InternalApplication.findById(req.params.id);
        if (!app) return res.status(404).json({ message: 'Application not found' });

        app.status = status;
        if (hiringManagerNotes) app.hiringManagerNotes = hiringManagerNotes;
        if (interviewDate) app.interviewDate = new Date(interviewDate);

        // If hired, trigger the seamless transfer engine
        if (status === 'Hired') {
            const job = await InternalJob.findById(app.jobId);
            await executeSeamlessTransfer(app.applicantId, job, req.tenantId);

            app.transferredAt = new Date();
            job.status = 'Filled';
            job.closedAt = new Date();
            await job.save();
        }

        await app.save();
        res.status(200).json({ message: `Application updated to ${status}`, app });
    } catch (error) { next(error); }
};
