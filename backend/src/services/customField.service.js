const CustomFieldDefinition = require('../models/customFieldDefinition.model');
const Employee = require('../models/employee.model');

class CustomFieldService {
  async getDefinitions(tenantId, entityType) {
    return CustomFieldDefinition.find({ tenantId, entityType }).sort({
      createdAt: 1,
    });
  }

  async createDefinition(tenantId, data) {
    const existingCount = await CustomFieldDefinition.countDocuments({
      tenantId,
      entityType: data.entityType,
    });
    if (existingCount >= 50) {
      throw new Error('Maximum of 50 custom fields allowed per entity type.');
    }

    const newDef = new CustomFieldDefinition({
      ...data,
      tenantId,
    });
    return newDef.save();
  }

  async updateDefinition(tenantId, id, updateData) {
    const definition = await CustomFieldDefinition.findOne({
      _id: id,
      tenantId,
    });
    if (!definition) throw new Error('Custom field definition not found');

    if (updateData.fieldType && updateData.fieldType !== definition.fieldType) {
      // Check if any entity has this field populated
      let hasData = false;
      if (definition.entityType === 'Employee') {
        const count = await Employee.countDocuments({
          tenantId,
          [`customData.${definition.fieldKey}`]: { $exists: true, $ne: null },
        });
        hasData = count > 0;
      }

      if (hasData) {
        throw new Error(
          'Cannot change fieldType because data already exists for this field.',
        );
      }
    }

    Object.assign(definition, updateData);
    return definition.save();
  }

  async deleteDefinition(tenantId, id) {
    const result = await CustomFieldDefinition.findOneAndDelete({
      _id: id,
      tenantId,
    });
    if (!result) throw new Error('Custom field definition not found');
    return result;
  }

  async validateCustomData(entityType, tenantId, customData) {
    if (!customData || typeof customData !== 'object') return {};

    const definitions = await CustomFieldDefinition.find({
      tenantId,
      entityType,
    });
    const defMap = new Map(definitions.map((d) => [d.fieldKey, d]));

    const errors = {};
    const validatedData = {};

    // Check required fields
    for (const def of definitions) {
      const value = customData[def.fieldKey];
      if (
        def.validationRules?.required &&
        (value === undefined || value === null || value === '')
      ) {
        errors[def.fieldKey] = `${def.label} is required.`;
      }
    }

    // Validate provided fields
    for (const [key, value] of Object.entries(customData)) {
      const def = defMap.get(key);
      if (!def) continue; // Ignore undefined custom fields

      if (value === undefined || value === null || value === '') {
        continue; // Skip further validation if empty and not required (already handled)
      }

      switch (def.fieldType) {
        case 'text':
          if (typeof value !== 'string') {
            errors[key] = `${def.label} must be text.`;
          } else if (
            def.validationRules?.maxLength &&
            value.length > def.validationRules.maxLength
          ) {
            errors[key] =
              `${def.label} cannot exceed ${def.validationRules.maxLength} characters.`;
          }
          break;
        case 'number': {
          const num = Number(value);
          if (isNaN(num)) {
            errors[key] = `${def.label} must be a number.`;
          } else {
            if (
              def.validationRules?.min !== undefined &&
              num < def.validationRules.min
            ) {
              errors[key] =
                `${def.label} cannot be less than ${def.validationRules.min}.`;
            }
            if (
              def.validationRules?.max !== undefined &&
              num > def.validationRules.max
            ) {
              errors[key] =
                `${def.label} cannot exceed ${def.validationRules.max}.`;
            }
          }
          break;
        }
        case 'date':
          if (isNaN(Date.parse(value))) {
            errors[key] = `${def.label} must be a valid date.`;
          }
          break;
        case 'dropdown':
          if (!def.options.includes(value)) {
            errors[key] = `${value} is not a valid option for ${def.label}.`;
          }
          break;
      }

      if (!errors[key]) {
        validatedData[key] = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      const error = new Error('Custom validation failed');
      error.isCustomValidation = true;
      error.fieldErrors = errors;
      throw error;
    }

    return validatedData;
  }
}

module.exports = new CustomFieldService();
