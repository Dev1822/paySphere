/**
 * @fileoverview OKR Controller
 * @description Manages OKR creation, cascading hierarchies, and weekly check-ins.
 * Issue: #1168
 */
const { Objective, CheckIn } = require('../models/okr.model');
const Employee = require('../models/employee.model');
const { cascadeProgressUpdate } = require('../utils/okrAggregator.utils');

exports.createObjective = async (req, res, next) => {
    try {
        const { title, description, type, parentId, department, cycle, keyResults } = req.body;

        // If Individual OKR, ownerId is the logged-in user's employee profile
        // If Company/Dept, ownerId might be the department head or CEO (passed in body or resolved)
        let ownerId = req.body.ownerId;
        if (type === 'Individual') {
            const emp = await Employee.findOne({
                userId: req.userId
            });
            ownerId = emp._id;
        }

        const objective = await Objective.create({
            title,
            description,
            type,
            parentId,
            department,
            cycle,
            ownerId,
            keyResults: keyResults || []
        });

        // If this is a child objective, trigger parent recalculation
        if (parentId) {
            await cascadeProgressUpdate(parentId, req.tenantId);
        }

        res.status(201).json({ message: 'Objective created', objective });
    } catch (error) { next(error); }
};

exports.logCheckIn = async (req, res, next) => {
    try {
        const { objectiveId, keyResultId, newValue, notes, blockedBy } = req.body;

        const objective = await Objective.findOne({
            _id: objectiveId
        });
        if (!objective) return res.status(404).json({ message: 'Objective not found' });

        const kr = objective.keyResults.id(keyResultId);
        if (!kr) return res.status(404).json({ message: 'Key Result not found' });

        const previousValue = kr.currentValue;
        kr.currentValue = Number(newValue);
        await objective.save();

        // Log the check-in history
        await CheckIn.create({
            objectiveId,
            keyResultId,
            updatedBy: req.userId,
            previousValue,
            newValue: Number(newValue),
            notes,
            blockedBy
        });

        // Cascade the progress update up the tree
        await cascadeProgressUpdate(objectiveId, req.tenantId);

        res.status(200).json({ message: 'Check-in logged and progress cascaded', objective });
    } catch (error) { next(error); }
};

exports.getMyOkrs = async (req, res, next) => {
    try {
        const emp = await Employee.findOne({
            userId: req.userId
        });
        const okrs = await Objective.find({
            ownerId: emp._id
        })
            .populate('parentId', 'title')
            .sort({ createdAt: -1 });
        res.status(200).json({ okrs });
    } catch (error) { next(error); }
};

exports.getCompanyTree = async (req, res, next) => {
    try {
        const { cycle } = req.query;
        const query = {};
        if (cycle) query.cycle = cycle;

        const allObjectives = await Objective.find(query)
            .populate('ownerId', 'fullName department')
            .lean();

        // Build tree structure in memory
        const map = {};
        allObjectives.forEach(o => { map[o._id] = { ...o, children: [] }; });

        const tree = [];
        allObjectives.forEach(o => {
            if (o.parentId && map[o.parentId]) {
                map[o.parentId].children.push(map[o._id]);
            } else {
                tree.push(map[o._id]);
            }
        });

        res.status(200).json({ tree });
    } catch (error) { next(error); }
};
