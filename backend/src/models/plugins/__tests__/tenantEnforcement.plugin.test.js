const mongoose = require('mongoose');
const tenantEnforcementPlugin = require('../tenantEnforcement.plugin');
const asyncContext = require('../../../utils/asyncContext');
const { MissingTenantError } = require('../../../utils/tenantScope');

describe('Tenant Enforcement Mongoose Plugin', () => {
  let mockSchema;
  let registeredHooks;

  beforeEach(() => {
    jest.clearAllMocks();
    
    registeredHooks = {};
    
    mockSchema = {
      paths: {
        tenantId: {} // Simulates that the schema has a tenantId field
      },
      pre: jest.fn((methods, callback) => {
        if (Array.isArray(methods)) {
          methods.forEach(method => {
            if (!registeredHooks[method]) registeredHooks[method] = [];
            registeredHooks[method].push(callback);
          });
        } else {
          if (!registeredHooks[methods]) registeredHooks[methods] = [];
          registeredHooks[methods].push(callback);
        }
      })
    };
  });

  describe('Initialization', () => {
    it('should register hooks if schema has a tenantId path', () => {
      tenantEnforcementPlugin(mockSchema);
      
      expect(mockSchema.pre).toHaveBeenCalled();
      
      const expectedMethods = [
        'find', 'findOne', 'findOneAndUpdate', 'update', 'updateOne',
        'updateMany', 'delete', 'deleteOne', 'deleteMany', 'count',
        'countDocuments', 'estimatedDocumentCount', 'findOneAndDelete',
        'findOneAndRemove', 'findOneAndReplace', 'remove', 'aggregate',
        'save', 'insertMany'
      ];

      expectedMethods.forEach(method => {
        expect(registeredHooks[method]).toBeDefined();
        expect(registeredHooks[method].length).toBeGreaterThan(0);
      });
    });

    it('should NOT register hooks if schema lacks a tenantId path', () => {
      const globalSchema = {
        paths: {
          // No tenantId path here
          name: {}
        },
        pre: jest.fn()
      };

      tenantEnforcementPlugin(globalSchema);
      expect(globalSchema.pre).not.toHaveBeenCalled();
    });
  });

  describe('Query Interception (find, update, delete, etc)', () => {
    let mockQueryContext;

    beforeEach(() => {
      tenantEnforcementPlugin(mockSchema);
      mockQueryContext = {
        where: jest.fn().mockReturnThis()
      };
    });

    const triggerQueryHook = () => {
      // Execute the first registered hook for 'find'
      const hook = registeredHooks['find'][0];
      return hook.call(mockQueryContext);
    };

    it('should inject tenantId into the query when present in context', () => {
      const mockTenantId = new mongoose.Types.ObjectId().toString();
      
      asyncContext.run({ tenantId: mockTenantId }, () => {
        triggerQueryHook();
        
        expect(mockQueryContext.where).toHaveBeenCalledWith({ tenantId: mockTenantId });
      });
    });

    it('should throw MissingTenantError if no context exists', () => {
      // Not running inside asyncContext.run()
      expect(() => {
        triggerQueryHook();
      }).toThrow(MissingTenantError);
      
      expect(() => {
        triggerQueryHook();
      }).toThrow('Database query attempted without a tenant context.');
    });

    it('should throw MissingTenantError if context exists but lacks tenantId', () => {
      asyncContext.run({ someOtherProp: true }, () => {
        expect(() => {
          triggerQueryHook();
        }).toThrow(MissingTenantError);
      });
    });

    it('should throw MissingTenantError if tenantId is the string "undefined"', () => {
      asyncContext.run({ tenantId: 'undefined' }, () => {
        expect(() => {
          triggerQueryHook();
        }).toThrow(MissingTenantError);
      });
    });

    it('should bypass enforcement if bypass flag is true', () => {
      asyncContext.run({ bypass: true }, () => {
        triggerQueryHook();
        
        expect(mockQueryContext.where).not.toHaveBeenCalled();
      });
    });

    it('should bypass enforcement even without tenantId if bypass is true', () => {
      asyncContext.run({ tenantId: null, bypass: true }, () => {
        triggerQueryHook(); // Should not throw
        expect(mockQueryContext.where).not.toHaveBeenCalled();
      });
    });
  });

  describe('Aggregation Interception', () => {
    let mockAggregateContext;
    let pipelineArray;

    beforeEach(() => {
      tenantEnforcementPlugin(mockSchema);
      pipelineArray = [];
      mockAggregateContext = {
        pipeline: jest.fn(() => pipelineArray)
      };
    });

    const triggerAggregateHook = () => {
      const hook = registeredHooks['aggregate'][0];
      return hook.call(mockAggregateContext);
    };

    it('should prepend a $match stage for the tenantId to the pipeline', () => {
      const mockTenantId = new mongoose.Types.ObjectId().toString();
      pipelineArray = [{ $group: { _id: '$department' } }];
      
      asyncContext.run({ tenantId: mockTenantId }, () => {
        triggerAggregateHook();
        
        expect(mockAggregateContext.pipeline).toHaveBeenCalled();
        expect(pipelineArray).toHaveLength(2);
        expect(pipelineArray[0]).toEqual({ $match: { tenantId: mockTenantId } });
        expect(pipelineArray[1]).toEqual({ $group: { _id: '$department' } });
      });
    });

    it('should throw MissingTenantError if no context exists during aggregation', () => {
      expect(() => {
        triggerAggregateHook();
      }).toThrow(MissingTenantError);
      expect(() => {
        triggerAggregateHook();
      }).toThrow('Database aggregation attempted without a tenant context.');
    });

    it('should bypass enforcement if bypass flag is true during aggregation', () => {
      asyncContext.run({ bypass: true }, () => {
        triggerAggregateHook();
        
        expect(pipelineArray).toHaveLength(0);
      });
    });
  });

  describe('Document Creation Interception (save)', () => {
    let mockDocument;
    let nextCallback;

    beforeEach(() => {
      tenantEnforcementPlugin(mockSchema);
      mockDocument = {
        name: 'Test Document'
      };
      nextCallback = jest.fn();
    });

    const triggerSaveHook = (doc, next) => {
      const hook = registeredHooks['save'][0];
      return hook.call(doc, next);
    };

    it('should automatically assign tenantId to the new document', () => {
      const mockTenantId = new mongoose.Types.ObjectId().toString();
      
      asyncContext.run({ tenantId: mockTenantId }, () => {
        triggerSaveHook(mockDocument, nextCallback);
        
        expect(mockDocument.tenantId).toBe(mockTenantId);
        expect(nextCallback).toHaveBeenCalledWith(); // Called without errors
      });
    });

    it('should NOT overwrite tenantId if the document already has one', () => {
      const mockTenantId = new mongoose.Types.ObjectId().toString();
      const explicitTenantId = new mongoose.Types.ObjectId().toString();
      
      mockDocument.tenantId = explicitTenantId;
      
      asyncContext.run({ tenantId: mockTenantId }, () => {
        triggerSaveHook(mockDocument, nextCallback);
        
        expect(mockDocument.tenantId).toBe(explicitTenantId);
        expect(nextCallback).toHaveBeenCalledWith();
      });
    });

    it('should pass MissingTenantError to next() if no context exists', () => {
      triggerSaveHook(mockDocument, nextCallback);
      
      expect(nextCallback).toHaveBeenCalledTimes(1);
      const errorArg = nextCallback.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(MissingTenantError);
      expect(errorArg.message).toBe('Database save attempted without a tenant context.');
    });

    it('should bypass enforcement if bypass flag is true during save', () => {
      asyncContext.run({ bypass: true }, () => {
        triggerSaveHook(mockDocument, nextCallback);
        
        expect(mockDocument.tenantId).toBeUndefined();
        expect(nextCallback).toHaveBeenCalledWith();
      });
    });
  });

  describe('Bulk Insertion Interception (insertMany)', () => {
    let mockDocuments;
    let nextCallback;

    beforeEach(() => {
      tenantEnforcementPlugin(mockSchema);
      mockDocuments = [
        { name: 'Doc 1' },
        { name: 'Doc 2', tenantId: 'existing-tenant-id' }
      ];
      nextCallback = jest.fn();
    });

    const triggerInsertManyHook = (docs, next) => {
      const hook = registeredHooks['insertMany'][0];
      // Mongoose insertMany hook signature: function(next, docs)
      return hook.call(null, next, docs);
    };

    it('should automatically assign tenantId to all inserted documents lacking one', () => {
      const mockTenantId = new mongoose.Types.ObjectId().toString();
      
      asyncContext.run({ tenantId: mockTenantId }, () => {
        triggerInsertManyHook(mockDocuments, nextCallback);
        
        expect(mockDocuments[0].tenantId).toBe(mockTenantId);
        // Should not overwrite existing tenantId
        expect(mockDocuments[1].tenantId).toBe('existing-tenant-id');
        expect(nextCallback).toHaveBeenCalledWith();
      });
    });

    it('should pass MissingTenantError to next() if no context exists on insertMany', () => {
      triggerInsertManyHook(mockDocuments, nextCallback);
      
      expect(nextCallback).toHaveBeenCalledTimes(1);
      const errorArg = nextCallback.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(MissingTenantError);
      expect(errorArg.message).toBe('Database insertMany attempted without a tenant context.');
    });

    it('should bypass enforcement if bypass flag is true during insertMany', () => {
      asyncContext.run({ bypass: true }, () => {
        triggerInsertManyHook(mockDocuments, nextCallback);
        
        expect(mockDocuments[0].tenantId).toBeUndefined();
        expect(nextCallback).toHaveBeenCalledWith();
      });
    });
  });
});
