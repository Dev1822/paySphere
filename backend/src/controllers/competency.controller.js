const Competency = require('../models/competency.model');
const Employee = require('../models/employee.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

const PROFICIENCY_RANK = { Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 };

/**
 * Get or create a competency profile for the authenticated user's employee record.
 *
 * If no profile exists yet, one is bootstrapped from the employee's department.
 * This is the self-service entry point — every employee can read their own profile.
 */
exports.getMyCompetency = async (req, res, next) => {
  try {
    const employee = await Employee.findOne(
      tenantFilter(req, { createdBy: req.userId }),
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    let profile = await Competency.findOne({
      employeeId: employee._id,
      tenantId: req.tenantId,
    });

    if (!profile) {
      profile = await Competency.create({
        employeeId: employee._id,
        department: employee.department || '',
        skills: [],
        createdBy: req.userId,
        tenantId: req.tenantId,
      });
    }

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a competency profile by employee ID.
 *
 * Used by managers reviewing their team and by HR running the skill matrix.
 */
exports.getCompetencyByEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const profile = await Competency.findOne(
      tenantFilter(req, { employeeId }),
    ).populate('employeeId', 'fullName role department');

    if (!profile) {
      return res.status(404).json({ message: 'Competency profile not found' });
    }

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a new skill entry to an employee's competency profile.
 *
 * Rejects duplicate skill names and validates the proficiency level. The
 * profile is created automatically if it does not exist yet.
 */
exports.addSkill = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { skillName, category, proficiency, yearsOfExperience, notes, assessedBy } = req.body;

    if (!skillName || !category || !proficiency) {
      return res.status(400).json({
        message: 'skillName, category, and proficiency are required',
      });
    }

    const validLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    if (!validLevels.includes(proficiency)) {
      return res.status(400).json({
        message: `proficiency must be one of: ${validLevels.join(', ')}`,
      });
    }

    let profile = await Competency.findOne(
      tenantFilter(req, { employeeId }),
    );

    if (!profile) {
      const employee = await Employee.findOne(
        tenantFilter(req, { _id: employeeId }),
      );
      profile = await Competency.create({
        employeeId,
        department: employee?.department || '',
        skills: [],
        createdBy: req.userId,
        tenantId: req.tenantId,
      });
    }

    const duplicate = profile.skills.find(
      (s) => s.skillName.toLowerCase() === skillName.trim().toLowerCase(),
    );
    if (duplicate) {
      return res.status(409).json({ message: `Skill "${skillName}" already exists. Use update instead.` });
    }

    profile.skills.push({
      skillName: skillName.trim(),
      category: category.trim(),
      proficiency,
      yearsOfExperience: Number(yearsOfExperience) || 0,
      notes: notes || '',
      assessedBy: assessedBy || 'Self',
      lastAssessedDate: new Date(),
    });

    await profile.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'COMPETENCY_SKILL_ADD',
      resourceType: 'Competency',
      resourceIds: [profile._id],
      details: { employeeId, skillName, proficiency },
      req,
    });

    logger.info('Skill added to competency profile', {
      userId: req.userId,
      employeeId,
      skillName,
    });

    res.status(201).json({ message: 'Skill added successfully', profile });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing skill entry on a competency profile.
 *
 * Matches by skill ID (the Mongoose subdocument _id) and applies only the
 * provided fields, preserving the rest.
 */
exports.updateSkill = async (req, res, next) => {
  try {
    const { employeeId, skillId } = req.params;
    const { proficiency, yearsOfExperience, notes, assessedBy, category } = req.body;

    const profile = await Competency.findOne(
      tenantFilter(req, { employeeId }),
    );
    if (!profile) {
      return res.status(404).json({ message: 'Competency profile not found' });
    }

    const skill = profile.skills.id(skillId);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    if (proficiency) {
      const validLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
      if (!validLevels.includes(proficiency)) {
        return res.status(400).json({
          message: `proficiency must be one of: ${validLevels.join(', ')}`,
        });
      }
      skill.proficiency = proficiency;
    }

    if (category !== undefined) skill.category = category.trim();
    if (yearsOfExperience !== undefined) skill.yearsOfExperience = Number(yearsOfExperience);
    if (notes !== undefined) skill.notes = notes;
    if (assessedBy !== undefined) skill.assessedBy = assessedBy;
    skill.lastAssessedDate = new Date();

    await profile.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'COMPETENCY_SKILL_UPDATE',
      resourceType: 'Competency',
      resourceIds: [profile._id],
      details: { employeeId, skillId, changes: Object.keys(req.body) },
      req,
    });

    res.status(200).json({ message: 'Skill updated successfully', profile });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a skill entry from a competency profile.
 */
exports.removeSkill = async (req, res, next) => {
  try {
    const { employeeId, skillId } = req.params;

    const profile = await Competency.findOne(
      tenantFilter(req, { employeeId }),
    );
    if (!profile) {
      return res.status(404).json({ message: 'Competency profile not found' });
    }

    const skill = profile.skills.id(skillId);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    profile.skills.pull(skillId);
    await profile.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'COMPETENCY_SKILL_REMOVE',
      resourceType: 'Competency',
      resourceIds: [profile._id],
      details: { employeeId, skillId, skillName: skill.skillName },
      req,
    });

    res.status(200).json({ message: 'Skill removed successfully', profile });
  } catch (error) {
    next(error);
  }
};

/**
 * Department-level skill matrix.
 *
 * Returns aggregated proficiency distributions per skill for a given
 * department. Useful for HR to identify training needs and hiring gaps.
 */
exports.getDepartmentSkillMatrix = async (req, res, next) => {
  try {
    const { department } = req.query;
    const filter = tenantFilter(req);
    if (department) {
      filter.department = department;
    }

    const profiles = await Competency.find(filter).populate(
      'employeeId',
      'fullName role department',
    );

    const skillMap = {};

    for (const profile of profiles) {
      for (const skill of profile.skills) {
        const key = skill.skillName.toLowerCase();
        if (!skillMap[key]) {
          skillMap[key] = {
            skillName: skill.skillName,
            category: skill.category,
            employees: [],
            proficiencyCounts: { Beginner: 0, Intermediate: 0, Advanced: 0, Expert: 0 },
            avgYearsOfExperience: 0,
            totalYears: 0,
          };
        }
        const entry = skillMap[key];
        entry.employees.push({
          employeeId: profile.employeeId?._id,
          name: profile.employeeId?.fullName,
          role: profile.employeeId?.role,
          proficiency: skill.proficiency,
          yearsOfExperience: skill.yearsOfExperience,
        });
        entry.proficiencyCounts[skill.proficiency] += 1;
        entry.totalYears += skill.yearsOfExperience;
      }
    }

    // Compute averages
    const matrix = Object.values(skillMap).map((entry) => ({
      skillName: entry.skillName,
      category: entry.category,
      totalEmployees: entry.employees.length,
      avgYearsOfExperience:
        entry.employees.length > 0
          ? Math.round((entry.totalYears / entry.employees.length) * 10) / 10
          : 0,
      proficiencyDistribution: entry.proficiencyCounts,
      employees: entry.employees,
    }));

    // Sort by total employees descending
    matrix.sort((a, b) => b.totalEmployees - a.totalEmployees);

    res.status(200).json({
      totalSkills: matrix.length,
      totalEmployees: profiles.length,
      matrix,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Skill gap analysis for a given employee.
 *
 * Compares the employee's skills against the department average proficiency
 * and lists skills where they fall below the average or have no entry at all.
 */
exports.getSkillGapAnalysis = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findOne(
      tenantFilter(req, { _id: employeeId }),
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const profile = await Competency.findOne(
      tenantFilter(req, { employeeId }),
    );
    if (!profile) {
      return res.status(404).json({ message: 'Competency profile not found' });
    }

    // Get all profiles in the same department for comparison
    const deptProfiles = await Competency.find(
      tenantFilter(req, { department: employee.department || profile.department }),
    );

    // Build department skill averages
    const deptSkillStats = {};
    for (const dp of deptProfiles) {
      for (const skill of dp.skills) {
        const key = skill.skillName.toLowerCase();
        if (!deptSkillStats[key]) {
          deptSkillStats[key] = {
            skillName: skill.skillName,
            category: skill.category,
            totalProficiency: 0,
            count: 0,
          };
        }
        deptSkillStats[key].totalProficiency += PROFICIENCY_RANK[skill.proficiency] || 0;
        deptSkillStats[key].count += 1;
      }
    }

    // Compute department averages
    const deptAverages = {};
    for (const [key, stats] of Object.entries(deptSkillStats)) {
      deptAverages[key] = {
        skillName: stats.skillName,
        category: stats.category,
        avgProficiencyRank: Math.round((stats.totalProficiency / stats.count) * 10) / 10,
        avgProficiencyLabel:
          Object.entries(PROFICIENCY_RANK).find(
            ([, v]) => v >= Math.round(stats.totalProficiency / stats.count),
          )?.[0] || 'Beginner',
        employeeCount: stats.count,
      };
    }

    // Compare employee against department
    const employeeSkillMap = {};
    for (const skill of profile.skills) {
      employeeSkillMap[skill.skillName.toLowerCase()] = skill;
    }

    const gaps = [];
    const strengths = [];

    for (const [key, deptStat] of Object.entries(deptAverages)) {
      const empSkill = employeeSkillMap[key];
      if (!empSkill) {
        gaps.push({
          skillName: deptStat.skillName,
          category: deptStat.category,
          type: 'missing',
          departmentAvgProficiency: deptStat.avgProficiencyLabel,
          departmentAvgRank: deptStat.avgProficiencyRank,
          employeeProficiency: null,
          gapSize: deptStat.avgProficiencyRank,
        });
      } else {
        const empRank = PROFICIENCY_RANK[empSkill.proficiency] || 0;
        const diff = deptStat.avgProficiencyRank - empRank;
        if (diff > 0.5) {
          gaps.push({
            skillName: deptStat.skillName,
            category: deptStat.category,
            type: 'below_average',
            departmentAvgProficiency: deptStat.avgProficiencyLabel,
            departmentAvgRank: deptStat.avgProficiencyRank,
            employeeProficiency: empSkill.proficiency,
            gapSize: Math.round(diff * 10) / 10,
          });
        } else {
          strengths.push({
            skillName: deptStat.skillName,
            category: deptStat.category,
            employeeProficiency: empSkill.proficiency,
            departmentAvgProficiency: deptStat.avgProficiencyLabel,
          });
        }
      }
    }

    // Sort gaps by gap size descending
    gaps.sort((a, b) => b.gapSize - a.gapSize);

    res.status(200).json({
      employee: {
        id: employee._id,
        name: employee.fullName,
        department: employee.department,
      },
      totalGaps: gaps.length,
      totalStrengths: strengths.length,
      gaps,
      strengths,
    });
  } catch (error) {
    next(error);
  }
};
