/**
 * Migration: Add integrity chain to existing audit records
 * Issue #1905
 */
'use strict';

const auditIntegrity = require('../services/auditIntegrity.service');

async function up(db) {
  const collection = db.collection('auditlogs');

  // Add fields to schema
  await collection.updateMany(
    { recordHash: { $exists: false } },
    {
      $set: {
        recordHash: null,
        previousHash: null,
        hashChainValid: true
      }
    }
  );

  // Calculate hashes for existing records
  // Group by tenant, resourceType, resourceId and calculate in order
  const groups = await collection.aggregate([
    {
      $group: {
        _id: {
          tenantId: '$tenantId',
          resourceType: '$resourceType',
          resourceId: '$resourceId'
        }
      }
    }
  ]).toArray();

  for (const group of groups) {
    const records = await collection
      .find(group._id)
      .sort({ createdAt: 1 })
      .toArray();

    let previousHash = null;

    for (const record of records) {
      const recordHash = auditIntegrity.calculateRecordHash(record, previousHash);

      await collection.updateOne(
        { _id: record._id },
        {
          $set: {
            recordHash,
            previousHash
          }
        }
      );

      previousHash = recordHash;
    }
  }

  // Create index on recordHash
  await collection.createIndex({ recordHash: 1 });
}

async function down(db) {
  const collection = db.collection('auditlogs');

  // Remove integrity fields
  await collection.updateMany(
    {},
    {
      $unset: {
        recordHash: 1,
        previousHash: 1,
        hashChainValid: 1
      }
    }
  );

  // Drop index
  await collection.dropIndex('recordHash_1');
}

module.exports = { up, down };