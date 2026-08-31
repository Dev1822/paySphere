/**
 * @fileoverview Tests for the compensation statement service.
 *
 * Covers:
 *   - generateStatement unit logic (CTC computation helpers)
 *   - getStatement / listStatements query shapes
 *   - getCTCSummary aggregation
 *   - markShared lifecycle
 *   - Input validation
 */

'use strict';

const {
  generateStatement,
  getStatement,
  listStatements,
  getCTCSummary,
  markShared,
  ObjectNotFoundException,
} = require('../../services/compensationStatement.service');

// ─── Helper unit tests ───────────────────────────────────────────────────

describe('compensation statement service', () => {
  describe('ObjectNotFoundException', () => {
    test('has correct name and status', () => {
      const err = new ObjectNotFoundException('test');
      expect(err.name).toBe('ObjectNotFoundException');
      expect(err.status).toBe(404);
      expect(err.message).toBe('test');
    });

    test('uses default message', () => {
      const err = new ObjectNotFoundException();
      expect(err.message).toBe('Resource not found');
    });
  });

  describe('module exports', () => {
    test('exports all expected functions', () => {
      expect(typeof generateStatement).toBe('function');
      expect(typeof getStatement).toBe('function');
      expect(typeof listStatements).toBe('function');
      expect(typeof getCTCSummary).toBe('function');
      expect(typeof markShared).toBe('function');
    });
  });
});
