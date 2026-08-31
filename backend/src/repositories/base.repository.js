const mongoose = require('mongoose');
const TenantContextService = require('../services/tenantContext.service');
const QueryValidatorService = require('../services/queryValidator.service');

/**
 * Tenant-aware base repository enforcing tenant scoping on all queries
 */
class BaseRepository {
  constructor(model, entityType = 'entity') {
    if (!model) {
      throw new Error('Mongoose model is required to instantiate BaseRepository');
    }
    this.model = model;
    this.entityType = entityType;
  }

  /**
   * Fetch documents matching filter (tenant-scoped)
   */
  async find(filter = {}, options = {}) {
    this._validateTenantScope(filter);
    
    let query = this.model.find(filter);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options.skip !== undefined) {
      query = query.skip(options.skip);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query;
  }

  /**
   * Fetch single document (tenant-scoped)
   */
  async findOne(filter = {}, options = {}) {
    this._validateTenantScope(filter);
    
    let query = this.model.findOne(filter);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query;
  }

  /**
   * Fetch document by ID (tenant validation required via context)
   */
  async findById(id, options = {}) {
    TenantContextService.requireTenantContext();
    
    let query = this.model.findById(id);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    // Validate tenant ownership after retrieval
    query = query.then(doc => {
      if (doc && doc.tenantId) {
        TenantContextService.validateTenantOwnership(doc.tenantId);
      }
      return doc;
    });
    
    return query;
  }

  /**
   * Create document with automatic tenant scoping
   */
  async create(data) {
    const context = TenantContextService.requireTenantContext();
    
    // Ensure tenant context is applied
    const scopedData = {
      ...data,
      tenantId: context.tenantId,
    };
    
    const doc = new this.model(scopedData);
    return doc.save();
  }

  /**
   * Update document by ID (tenant-scoped)
   */
  async updateById(id, updateData, options = {}) {
    TenantContextService.requireTenantContext();
    
    // Fetch to validate tenant ownership
    const existing = await this.model.findById(id);
    if (existing) {
      TenantContextService.validateTenantOwnership(existing.tenantId);
    }
    
    const opt = { new: true, runValidators: true, ...options };
    return this.model.findByIdAndUpdate(id, updateData, opt);
  }

  /**
   * Delete document (tenant-scoped)
   */
  async deleteById(id, options = {}) {
    TenantContextService.requireTenantContext();
    
    const existing = await this.model.findById(id);
    if (existing) {
      TenantContextService.validateTenantOwnership(existing.tenantId);
    }
    
    return this.model.findByIdAndDelete(id, options);
  }

  /**
   * Validate filter includes required tenant scope
   */
  _validateTenantScope(filter) {
    if (!filter.hasOwnProperty('tenantId')) {
      const context = TenantContextService.getTenantContext();
      throw new Error(
        `${this.entityType} queries must include tenantId filter. ` +
        `Context: ${context ? 'available' : 'missing'}`
      );
    }
  }
}

module.exports = BaseRepository;