/**
 * @fileoverview AST Rule Evaluator Service
 * @description Evaluates Abstract Syntax Trees (AST) and dynamic string rule expressions for
 * conditional workflow edge branching and policy evaluation against arbitrary entity contexts.
 */

'use strict';

const logger = require('../utils/logger');

class ASTEvaluator {
  /**
   * Safely resolve nested property values from context object (e.g. "payroll.amount" -> context.payroll.amount)
   * @param {string} path Key path
   * @param {object} context Data dictionary
   * @returns {any}
   */
  static _getValueFromContext(path, context) {
    if (!path || !context) return undefined;
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Recursively evaluate an AST node against execution context.
   *
   * @param {object} node AST Node object
   * @param {object} context Execution environment dictionary
   * @returns {any} Evaluated result
   */
  static evaluate(node, context = {}) {
    if (!node || typeof node !== 'object') return false;

    switch (node.type) {
      case 'Literal':
        return node.value;

      case 'Identifier':
        return this._getValueFromContext(node.name, context);

      case 'UnaryExpression': {
        const argumentValue = this.evaluate(node.argument, context);
        if (node.operator === '!') return !argumentValue;
        if (node.operator === '-') return -Number(argumentValue);
        return argumentValue;
      }

      case 'BinaryExpression': {
        const left = this.evaluate(node.left, context);
        const right = this.evaluate(node.right, context);

        switch (node.operator) {
          case '==':
            return left == right;
          case '===':
            return left === right;
          case '!=':
            return left != right;
          case '!==':
            return left !== right;
          case '>':
            return Number(left) > Number(right);
          case '<':
            return Number(left) < Number(right);
          case '>=':
            return Number(left) >= Number(right);
          case '<=':
            return Number(left) <= Number(right);
          case 'in':
            return Array.isArray(right) ? right.includes(left) : false;
          case 'contains':
            return Array.isArray(left)
              ? left.includes(right)
              : String(left).includes(String(right));
          default:
            logger.warn(
              `Unsupported binary operator in AST Evaluator: ${node.operator}`,
            );
            return false;
        }
      }

      case 'LogicalExpression': {
        if (node.operator === '&&') {
          return (
            Boolean(this.evaluate(node.left, context)) &&
            Boolean(this.evaluate(node.right, context))
          );
        }
        if (node.operator === '||') {
          return (
            Boolean(this.evaluate(node.left, context)) ||
            Boolean(this.evaluate(node.right, context))
          );
        }
        return false;
      }

      default:
        logger.warn(`Unknown AST node type: ${node.type}`);
        return false;
    }
  }

  /**
   * Helper to construct and evaluate a simple rule object.
   * Format: { field: "amount", operator: ">=", value: 10000 }
   *
   * @param {object|string} rule
   * @param {object} context
   * @returns {boolean}
   */
  static evaluateRule(rule, context = {}) {
    if (!rule) return true; // Empty rule passes by default

    if (typeof rule === 'object' && rule.type) {
      return Boolean(this.evaluate(rule, context));
    }

    if (typeof rule === 'object' && rule.field && rule.operator) {
      const astNode = {
        type: 'BinaryExpression',
        operator: rule.operator,
        left: { type: 'Identifier', name: rule.field },
        right: { type: 'Literal', value: rule.value },
      };
      return Boolean(this.evaluate(astNode, context));
    }

    return true;
  }
}

module.exports = ASTEvaluator;
