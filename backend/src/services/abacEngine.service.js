const AccessPolicy = require('../models/accessPolicy.model');
const PolicyAttachment = require('../models/policyAttachment.model');
const logger = require('../utils/logger');

function getAttributeValue(obj, path) {
  if (!obj || typeof path !== 'string') return undefined;
  return path.split('.').reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : undefined;
  }, obj);
}

function evaluateCondition(condition, contextData) {
  const { attribute, operator, value } = condition;
  const attributeValue = getAttributeValue(contextData, attribute);

  let targetValue = value;
  // If the target value is a string starting with '$', resolve it from context
  if (typeof value === 'string' && value.startsWith('$')) {
    targetValue = getAttributeValue(contextData, value.substring(1));
  }

  // toString() is used for ID comparisons (e.g. ObjectId)
  const safeStr = (val) =>
    val !== null && val !== undefined ? val.toString() : val;
  const attrStr = safeStr(attributeValue);
  const targetStr = safeStr(targetValue);

  switch (operator) {
    case 'equals':
      return attrStr === targetStr;
    case 'not_equals':
      return attrStr !== targetStr;
    case 'in':
      return (
        Array.isArray(targetValue) &&
        targetValue.some((v) => safeStr(v) === attrStr)
      );
    case 'not_in':
      return (
        Array.isArray(targetValue) &&
        !targetValue.some((v) => safeStr(v) === attrStr)
      );
    case 'exists':
      return attributeValue !== undefined && attributeValue !== null;
    case 'greater_than':
      return Number(attributeValue) > Number(targetValue);
    case 'less_than':
      return Number(attributeValue) < Number(targetValue);
    default:
      return false;
  }
}

/**
 * Evaluate if a user can perform an action on a resource.
 * @param {object} user - The requesting user object.
 * @param {string} action - The action string (e.g. 'employee:write').
 * @param {string} resourceName - The name of the resource (e.g. 'Employee').
 * @param {object} resourceData - The attributes of the target resource.
 * @param {object} context - Additional contextual information.
 * @returns {Promise<boolean>}
 */
async function evaluateAccess(
  user,
  action,
  resourceName,
  resourceData = {},
  context = {},
) {
  try {
    if (!user) return false;

    const principalIds = [user._id];

    // user.role could be populated or just an ObjectId
    if (user.role) {
      if (typeof user.role === 'object' && user.role._id) {
        principalIds.push(user.role._id);
      } else {
        principalIds.push(user.role);
      }
    }

    const attachments = await PolicyAttachment.find({
      principalId: { $in: principalIds },
    }).populate('policyId');

    const policies = attachments
      .map((att) => att.policyId)
      .filter((policy) => policy != null);

    const contextData = {
      subject: user,
      resource: resourceData,
      context,
    };

    let allowed = false;

    for (const policy of policies) {
      if (!policy.actions.includes(action) && !policy.actions.includes('*'))
        continue;
      if (
        !policy.resources.includes(resourceName) &&
        !policy.resources.includes('*')
      )
        continue;

      let conditionsMet = true;
      if (policy.conditions && policy.conditions.length > 0) {
        conditionsMet = policy.conditions.every((condition) =>
          evaluateCondition(condition, contextData),
        );
      }

      if (conditionsMet) {
        if (policy.effect === 'deny') {
          return false; // Explicit deny overrides any allows
        }
        if (policy.effect === 'allow') {
          allowed = true;
        }
      }
    }

    return allowed;
  } catch (error) {
    logger.error('ABAC Engine Evaluation Error', {
      error: error.message,
      action,
      user: user?._id,
    });
    return false; // Default to deny on error
  }
}

module.exports = {
  evaluateAccess,
  evaluateCondition,
  getAttributeValue,
};
