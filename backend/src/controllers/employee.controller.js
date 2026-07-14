const Employee = require("../models/employee.model");
const User = require("../models/user.model");

// ADD EMPLOYEE
exports.addEmployee = async (req, res) => {
  try {
    const { fullName, role, monthlySalary, overtimeRate } = req.body;

    if (!fullName || !monthlySalary) {
      return res.status(400).json({ message: "Full name and monthly salary are required" });
    }

    // Get the user's company name
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const employee = new Employee({
      fullName,
      role: role || "",
      monthlySalary,
      overtimeRate: overtimeRate || 0,
      companyName: user.companyName,
      createdBy: req.userId,
    });

    await employee.save();

    res.status(201).json({ message: "Employee added successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET ALL EMPLOYEES (for the logged-in user's company)
exports.getEmployees = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const totalEmployees = await Employee.countDocuments({
      createdBy: req.userId,
    });

    const employees = await Employee.find({
      createdBy: req.userId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalEmployees / limit);

    res.status(200).json({
      employees,
      currentPage: page,
      totalPages,
      totalEmployees,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET RECENTLY ADDED EMPLOYEES (last 5)
exports.getRecentEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ createdBy: req.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({ employees });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
