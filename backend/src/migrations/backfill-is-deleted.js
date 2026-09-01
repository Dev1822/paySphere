/**
 * Migration Script: Backfill `isDeleted: true` for soft-deleted records.
 * 
 * Issue: The soft delete plugin relies on `isDeleted: true` to filter out records.
 * However, some older controllers manually set `deletedAt = new Date()` without setting `isDeleted = true`.
 * This script finds all records with a `deletedAt` date but a missing or false `isDeleted` flag,
 * and updates them to correctly reflect the soft-deleted state.
 * 
 * Usage: Execute this script using Node.js connected to your MongoDB instance.
 */

const mongoose = require('mongoose');

// Add your MongoDB connection string if not running within the app context
// mongoose.connect(process.env.MONGODB_URI);

async function up() {
  console.log('Starting migration to backfill `isDeleted: true`...');

  // Get all registered models or explicitly list them if running standalone
  const models = mongoose.modelNames();
  
  let totalUpdated = 0;

  for (const modelName of models) {
    const Model = mongoose.model(modelName);
    
    // Check if the model's schema has the deletedAt and isDeleted paths
    if (Model.schema.path('deletedAt') && Model.schema.path('isDeleted')) {
      try {
        const result = await Model.updateMany(
          { 
            deletedAt: { $ne: null }, 
            isDeleted: { $ne: true } 
          },
          { 
            $set: { isDeleted: true } 
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`Updated ${result.modifiedCount} records in ${modelName}`);
          totalUpdated += result.modifiedCount;
        }
      } catch (err) {
        console.error(`Error updating ${modelName}:`, err);
      }
    }
  }

  console.log(`Migration complete. Total records updated: ${totalUpdated}`);
}

// To run this standalone, uncomment the following:
// up().then(() => mongoose.disconnect()).catch(console.error);

module.exports = { up };
