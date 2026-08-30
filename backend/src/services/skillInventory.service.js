const SkillTaxonomy = require('../models/skillTaxonomy.model');
const EmployeeSkill = require('../models/employeeSkill.model');
const CompetencyFramework = require('../models/competencyFramework.model');
const Employee = require('../models/employee.model');
const NotificationService = require('./notification.service');
const { getStartOfDay, addDays } = require('../utils/dates');

class SkillInventoryService {
  /**
   * Add a new skill to the taxonomy
   */
  async createSkillTaxonomy(data, tenantId, createdBy) {
    const skill = new SkillTaxonomy({
      ...data,
      tenantId,
      createdBy,
    });
    return await skill.save();
  }

  /**
   * Get all skills in taxonomy for a tenant
   */
  async getSkillTaxonomy(tenantId) {
    return await SkillTaxonomy.find({ tenantId, isDeleted: false });
  }

  /**
   * Add a skill to an employee
   */
  async addEmployeeSkill(employeeId, data, tenantId, createdBy) {
    const isManager = data.source === 'manager_endorsed';
    const status = isManager ? 'approved' : 'pending_endorsement';

    const employeeSkill = new EmployeeSkill({
      ...data,
      employeeId,
      tenantId,
      createdBy,
      status,
    });

    const savedSkill = await employeeSkill.save();

    if (!isManager) {
      // Notify manager for endorsement
      const employee = await Employee.findById(employeeId);
      if (employee && employee.managerId) {
        await NotificationService.sendNotification({
          userId: employee.managerId,
          title: 'Skill Endorsement Request',
          body: `${employee.fullName} has self-assessed a new skill and requested your endorsement.`,
          type: 'SKILL_ENDORSEMENT',
          tenantId,
        });
      }
    }

    return savedSkill;
  }

  /**
   * Endorse a pending skill
   */
  async endorseEmployeeSkill(skillId, tenantId, managerId) {
    const skill = await EmployeeSkill.findOneAndUpdate(
      { _id: skillId, tenantId },
      { status: 'approved', source: 'manager_endorsed' },
      { new: true },
    );

    if (skill) {
      // Notify employee that skill was endorsed
      const employee = await Employee.findById(skill.employeeId);
      if (employee && employee.createdBy) {
        await NotificationService.sendNotification({
          userId: employee.createdBy,
          title: 'Skill Endorsed',
          body: `Your manager has endorsed your skill.`,
          type: 'SKILL_ENDORSED',
          tenantId,
        });
      }
    }

    return skill;
  }

  /**
   * Get a team's skill matrix
   */
  async getTeamSkillMatrix(managerId, tenantId) {
    const directReports = await Employee.find({
      managerId,
      tenantId,
      isDeleted: false,
      isActive: true,
    });
    const employeeIds = directReports.map((emp) => emp._id);

    const skills = await EmployeeSkill.find({
      employeeId: { $in: employeeIds },
      tenantId,
      isDeleted: false,
    }).populate('skillId', 'name category');

    const matrix = {};
    for (const report of directReports) {
      matrix[report._id] = {
        employee: { id: report._id, name: report.fullName, role: report.role },
        skills: skills.filter(
          (s) => s.employeeId.toString() === report._id.toString(),
        ),
      };
    }

    return Object.values(matrix);
  }

  /**
   * Get skill gap analysis for an employee based on their role
   */
  async getSkillGapAnalysis(employeeId, tenantId) {
    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId,
      isDeleted: false,
    });
    if (!employee || !employee.role) {
      return { hasRole: false, gaps: [] };
    }

    const framework = await CompetencyFramework.findOne({
      role: employee.role,
      tenantId,
      isDeleted: false,
    }).populate('requiredSkills.skillId', 'name category');

    if (!framework) {
      return { hasFramework: false, gaps: [] };
    }

    const employeeSkills = await EmployeeSkill.find({
      employeeId,
      tenantId,
      status: 'approved',
      isDeleted: false,
    });

    const skillMap = employeeSkills.reduce((map, skill) => {
      map[skill.skillId.toString()] = skill.proficiencyLevel;
      return map;
    }, {});

    const gaps = framework.requiredSkills.map((reqSkill) => {
      const currentLevel = skillMap[reqSkill.skillId._id.toString()] || 0;
      return {
        skill: reqSkill.skillId,
        requiredLevel: reqSkill.minProficiencyLevel,
        currentLevel,
        gap: Math.max(0, reqSkill.minProficiencyLevel - currentLevel),
      };
    });

    return {
      role: employee.role,
      hasFramework: true,
      gaps,
    };
  }
}

module.exports = new SkillInventoryService();
