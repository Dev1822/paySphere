/**
 * @fileoverview Fleet Controller
 * @description Manages vehicle inventory, trip logging, and maintenance scheduling.
 * Issue: #1206
 */
const { Vehicle, TripLog, MaintenanceSchedule } = require('../models/fleet.model');
const Employee = require('../models/employee.model');
const { checkMaintenanceNeeds, detectFuelAnomaly } = require('../utils/maintenanceScheduler.utils');
const logger = require('../utils/logger');

exports.addVehicle = async (req, res, next) => {
    try {
        const vehicle = await Vehicle.create({
            ...req.body
        });
        res.status(201).json({ message: 'Vehicle added to fleet', vehicle });
    } catch (error) { next(error); }
};

exports.getFleet = async (req, res, next) => {
    try {
        const vehicles = await Vehicle.find({})
            .populate('assignedTo', 'fullName')
            .sort({ status: 1 });

        // Run anomaly detection for all vehicles in parallel
        const fleetHealth = await Promise.all(vehicles.map(async (v) => {
            const anomaly = await detectFuelAnomaly(v._id, req.tenantId);
            return { ...v.toObject(), fuelAnomaly: anomaly };
        }));

        res.status(200).json({ vehicles: fleetHealth });
    } catch (error) { next(error); }
};

exports.assignVehicle = async (req, res, next) => {
    try {
        const { vehicleId, employeeId } = req.body;
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

        vehicle.assignedTo = employeeId;
        vehicle.status = 'Assigned';
        await vehicle.save();

        res.status(200).json({ message: 'Vehicle assigned', vehicle });
    } catch (error) { next(error); }
};

exports.logTrip = async (req, res, next) => {
    try {
        const { vehicleId, date, startOdometer, endOdometer, fuelAddedLiters, fuelCost, fuelReceiptUrl, purpose, notes } = req.body;

        const vehicle = await Vehicle.findOne({
            _id: vehicleId
        });
        if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

        if (endOdometer < startOdometer) {
            return res.status(400).json({ message: 'End odometer cannot be less than start odometer.' });
        }

        const distanceKm = endOdometer - startOdometer;
        const driver = await Employee.findOne({
            userId: req.userId
        });

        const log = await TripLog.create({
            vehicleId,
            driverId: driver._id,
            date: new Date(date),
            startOdometer,
            endOdometer,
            distanceKm,
            fuelAddedLiters: fuelAddedLiters || 0,
            fuelCost: fuelCost || 0,
            fuelReceiptUrl: fuelReceiptUrl || '',
            purpose,
            notes
        });

        // Update vehicle current odometer
        vehicle.currentOdometer = Math.max(vehicle.currentOdometer, endOdometer);
        await vehicle.save();

        // Check maintenance triggers
        const maintenanceCheck = await checkMaintenanceNeeds(vehicle, vehicle.currentOdometer);
        if (maintenanceCheck.needsService) {
            logger.warn(`[Fleet] Vehicle ${vehicle.licensePlate} requires maintenance: ${maintenanceCheck.reason}`);
            // In production, emit event to notify Fleet Admin
        }

        res.status(201).json({ message: 'Trip logged', log, maintenanceAlert: maintenanceCheck.needsService ? maintenanceCheck.reason : null });
    } catch (error) { next(error); }
};

exports.getTripLogs = async (req, res, next) => {
    try {
        const { vehicleId } = req.query;
        const query = {};
        if (vehicleId) query.vehicleId = vehicleId;

        const logs = await TripLog.find(query)
            .populate('driverId', 'fullName')
            .populate('vehicleId', 'licensePlate model')
            .sort({ date: -1 })
            .limit(100);

        res.status(200).json({ logs });
    } catch (error) { next(error); }
};
