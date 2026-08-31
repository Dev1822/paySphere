/**
 * @fileoverview Alumni Controller
 * @description Manages alumni profiles, exit data, and boomerang rehire reconciliation.
 * Issue: #1366
 */
const { AlumniProfile, BoomerangRehire } = require('../models/alumni.model');
const Employee = require('../models/employee.model');
const { calculateCombinedTenure, isEligibleForRehire, shouldRestoreVesting } = require('../utils/tenureReconciliation.utils');

exports.createAlumniProfile = async (req, res, next) => {
    try {
        const { employeeId, exitDate, exitReason, exitInterviewSummary } = req.body;
        const employee = await Employee.findOne({
            _id: employeeId
        });
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const previousTenureDays = Math.floor((new Date(exitDate) - new Date(employee.joiningDate)) / (1000 * 60 * 60 * 24));

        const alumni = await AlumniProfile.create({
            originalEmployeeId: employee._id,
            fullName: employee.fullName,
            email: employee.email,
            nationalId: employee.nationalId || employee.pan || '',
            originalJoinDate: employee.joiningDate,
            exitDate: new Date(exitDate),
            totalPreviousTenureDays: previousTenureDays,
            exitDepartment: employee.department,
            exitRole: employee.role,
            exitReason,
            isEligibleForRehire: isEligibleForRehire(exitReason),
            exitInterviewSummary
        });

        // Mark original employee as inactive
        employee.isActive = false;
        employee.exitDate = new Date(exitDate);
        await employee.save();

        res.status(201).json({ message: 'Alumni profile created', alumni });
    } catch (error) { next(error); }
};

exports.searchAlumni = async (req, res, next) => {
    try {
        const { query } = req.query;
        const searchRegex = new RegExp(query, 'i');

        const alumni = await AlumniProfile.find({
            $or: [
                { fullName: searchRegex },
                { email: searchRegex },
                { nationalId: searchRegex }
            ]
        }).limit(20);

        res.status(200).json({ alumni });
    } catch (error) { next(error); }
};

exports.processBoomerangRehire = async (req, res, next) => {
    try {
        const { alumniProfileId, newEmployeeId } = req.body;

        const alumni = await AlumniProfile.findOne({
            _id: alumniProfileId
        });
        if (!alumni) return res.status(404).json({ message: 'Alumni profile not found' });
        if (!alumni.isEligibleForRehire) return res.status(400).json({ message: 'Alumni is not eligible for rehire.' });

        const newEmployee = await Employee.findOne({
            _id: newEmployeeId
        });
        if (!newEmployee) return res.status(404).json({ message: 'New employee record not found' });

        // Calculate combined tenure
        const tenureData = calculateCombinedTenure(
            alumni.originalJoinDate,
            alumni.exitDate,
            newEmployee.joiningDate,
            new Date()
        );

        // Determine vesting restoration
        const gapYears = (new Date(newEmployee.joiningDate) - new Date(alumni.exitDate)) / (1000 * 60 * 60 * 24 * 365.25);
        const restoreVesting = shouldRestoreVesting(alumni.totalPreviousTenureDays / 365.25, gapYears);

        // Create reconciliation record
        const rehire = await BoomerangRehire.create({
            alumniProfileId: alumni._id,
            newEmployeeId: newEmployee._id,
            combinedTenureDays: tenureData.totalDays,
            restoredLeaveTier: tenureData.leaveTier,
            restoredVestingSchedule: restoreVesting,
            processedBy: req.userId
        });

        // Update new employee record with restored benefits
        newEmployee.leaveTier = tenureData.leaveTier;
        newEmployee.originalJoinDate = alumni.originalJoinDate; // Preserve original start date for tenure displays
        newEmployee.isBoomerangRehire = true;
        await newEmployee.save();

        // Update alumni profile
        alumni.isRehired = true;
        alumni.rehireEmployeeId = newEmployee._id;
        alumni.rehireDate = newEmployee.joiningDate;
        await alumni.save();

        res.status(200).json({ message: 'Boomerang rehire processed successfully', rehire, tenureData });
    } catch (error) { next(error); }
};
