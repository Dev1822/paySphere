/**
 * Migration: Add import recovery and duplicate tracking fields
 * Issue #1903
 */

async function up(db) {
  await db.collection('employeeimports').updateMany(
    {},
    {
      $set: {
        processedBatches: [],
        lastProcessedBatch: -1,
        duplicateRows: [],
        duplicateCount: 0,
        successfulRows: 0,
        batchSize: 100,
        jobQueueId: null
      }
    }
  );
}

async function down(db) {
  await db.collection('employeeimports').updateMany(
    {},
    {
      $unset: {
        processedBatches: 1,
        lastProcessedBatch: 1,
        duplicateRows: 1,
        duplicateCount: 1,
        successfulRows: 1,
        batchSize: 1,
        jobQueueId: 1
      }
    }
  );
}

module.exports = { up, down };