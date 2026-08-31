/**
 * @fileoverview Wellness Controller
 * @description Manages challenges, activity logging, and payroll injections.
 * Issue: #1365
 */
const { WellnessChallenge, TeamRoster, ActivityLog } = require('../models/wellness.model');
const Employee = require('../models/employee.model');
const { normalizeMetrics, calculateLeaderboardAndBonuses, generatePayrollInjections } = require('../utils/wellnessScoring.utils');

exports.createChallenge = async (req, res, next) => {
    try {
        const challenge = await WellnessChallenge.create({
            ...req.body,
            createdBy: req.userId
        });
        res.status(201).json({ message: 'Challenge created', challenge });
    } catch (error) { next(error); }
};

exports.createTeam = async (req, res, next) => {
    try {
        const { challengeId, teamName, memberIds } = req.body;
        const team = await TeamRoster.create({
            challengeId,
            teamName,
            members: memberIds
        });
        res.status(201).json({ message: 'Team created', team });
    } catch (error) { next(error); }
};

exports.logActivity = async (req, res, next) => {
    try {
        const { challengeId, teamId, date, metricValue, source } = req.body;
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const challenge = await WellnessChallenge.findById(challengeId);
        if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

        const normalizedPoints = normalizeMetrics(challenge.type, metricValue);

        const log = await ActivityLog.findOneAndUpdate(
            { challengeId, employeeId: employee._id, date: new Date(date) },
            { metricValue, source, teamId },
            { upsert: true, new: true }
        );

        // Update team score
        await TeamRoster.findByIdAndUpdate(teamId, { $inc: { totalScore: normalizedPoints } });

        res.status(200).json({ message: 'Activity logged', log, pointsEarned: normalizedPoints });
    } catch (error) { next(error); }
};

exports.getLeaderboard = async (req, res, next) => {
    try {
        const { challengeId } = req.params;
        const teams = await TeamRoster.find({
            challengeId
        }).populate('members', 'fullName');
        const challenge = await WellnessChallenge.findById(challengeId);

        const leaderboard = calculateLeaderboardAndBonuses(teams, challenge.rewardPoolAmount);
        res.status(200).json({ leaderboard });
    } catch (error) { next(error); }
};

exports.processPayrollInjection = async (req, res, next) => {
    try {
        const { challengeId } = req.params;
        const teams = await TeamRoster.find({
            challengeId
        }).populate('members', '_id');
        const challenge = await WellnessChallenge.findById(challengeId);

        const leaderboard = calculateLeaderboardAndBonuses(teams, challenge.rewardPoolAmount);
        const injections = generatePayrollInjections(leaderboard, teams);

        // In a real system, this would push to the PayrollUpdate model or an external payroll API
        challenge.status = 'Completed';
        await challenge.save();

        res.status(200).json({ message: 'Payroll injections generated', injections });
    } catch (error) { next(error); }
};
