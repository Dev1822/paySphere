const asyncContext = require('../../utils/asyncContext');
const { MissingTenantError, isUsableTenantId } = require('../../utils/tenantScope');

/**
 * Mongoose Query Pre-Hook Plugin for automatic Row-Level Security (RLS).
 * Intercepts all queries on models that have a `tenantId` field and ensures
 * they are scoped to the `tenantId` present in the AsyncLocalStorage context.
 */
function tenantEnforcementPlugin(schema) {
  // Only apply to schemas that actually have a tenantId field
  if (!schema.paths.tenantId) {
    return;
  }

  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'update',
    'updateOne',
    'updateMany',
    'delete',
    'deleteOne',
    'deleteMany',
    'count',
    'countDocuments',
    'estimatedDocumentCount',
    'findOneAndDelete',
    'findOneAndRemove',
    'findOneAndReplace',
    'remove'
  ];

  // Intercept standard queries
  schema.pre(queryMethods, function () {
    const context = asyncContext.getStore();

    if (context && context.bypass === true) {
      return;
    }

    if (!context || !isUsableTenantId(context.tenantId)) {
      throw new MissingTenantError('Database query attempted without a tenant context.');
    }

    this.where({ tenantId: context.tenantId });
  });

  // Intercept aggregation pipelines
  schema.pre('aggregate', function () {
    const context = asyncContext.getStore();

    if (context && context.bypass === true) {
      return;
    }

    if (!context || !isUsableTenantId(context.tenantId)) {
      throw new MissingTenantError('Database aggregation attempted without a tenant context.');
    }

    // Append $match at the beginning of the pipeline
    this.pipeline().unshift({ $match: { tenantId: context.tenantId } });
  });

  // Intercept document creation
  schema.pre('save', function (next) {
    const context = asyncContext.getStore();
    
    if (context && context.bypass === true) {
      return next();
    }

    if (!context || !isUsableTenantId(context.tenantId)) {
      return next(new MissingTenantError('Database save attempted without a tenant context.'));
    }

    if (!this.tenantId) {
      this.tenantId = context.tenantId;
    }
    next();
  });

  schema.pre('insertMany', function (next, docs) {
    const context = asyncContext.getStore();
    
    if (context && context.bypass === true) {
      return next();
    }

    if (!context || !isUsableTenantId(context.tenantId)) {
      return next(new MissingTenantError('Database insertMany attempted without a tenant context.'));
    }

    if (Array.isArray(docs)) {
      docs.forEach(doc => {
        if (!doc.tenantId) {
          doc.tenantId = context.tenantId;
        }
      });
    }
    next();
  });
}

module.exports = tenantEnforcementPlugin;
