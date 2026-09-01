const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'src', 'models');
if (fs.existsSync(modelsDir)) {
  const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js'));

  modelFiles.forEach((file) => {
    const modelName = file.replace(/\.js$/, '');
    const modelPath = `./src/models/${modelName}`;
    jest.doMock(
      modelPath,
      () => {
        const mockQuery = {
          populate: jest.fn(function () {
            return this;
          }),
          select: jest.fn(function () {
            return this;
          }),
          sort: jest.fn(function () {
            return this;
          }),
          limit: jest.fn(function () {
            return this;
          }),
          skip: jest.fn(function () {
            return this;
          }),
          lean: jest.fn(function () {
            return this;
          }),
          exec: jest.fn().mockResolvedValue(null),
          then: function (resolve) {
            resolve(null);
          },
        };

        const mockQueryArray = {
          ...mockQuery,
          exec: jest.fn().mockResolvedValue([]),
          then: function (resolve) {
            resolve([]);
          },
        };

        const mockQueryObject = {
          ...mockQuery,
          exec: jest
            .fn()
            .mockResolvedValue({
              _id: 'dummy',
              companyName: 'Dummy Co',
              tenantId: 'tenant-1',
              ok: true,
              date: new Date(),
              rates: [],
              save: jest.fn().mockResolvedValue(true),
            }),
          then: function (resolve) {
            resolve({
              _id: 'dummy',
              companyName: 'Dummy Co',
              tenantId: 'tenant-1',
              ok: true,
              date: new Date(),
              rates: [],
              save: jest.fn().mockResolvedValue(true),
            });
          },
          save: jest.fn().mockResolvedValue(true),
        };

        const mockModel = {
          find: jest.fn().mockReturnValue(mockQueryArray),
          findOne: jest.fn().mockReturnValue(mockQueryObject),
          findById: jest.fn().mockReturnValue(mockQueryObject),
          create: jest.fn().mockImplementation((docs) => {
            if (Array.isArray(docs))
              return Promise.resolve(docs.map(() => ({})));
            return Promise.resolve({});
          }),
          updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
          updateMany: jest.fn().mockResolvedValue({ nModified: 1 }),
          deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
          deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
          exists: jest.fn().mockResolvedValue(false),
          countDocuments: jest.fn().mockResolvedValue(0),
          aggregate: jest.fn().mockResolvedValue([]),
          bulkWrite: jest.fn().mockResolvedValue({}),
          findOneAndUpdate: jest.fn().mockReturnValue(mockQueryObject),
          findByIdAndUpdate: jest.fn().mockReturnValue(mockQueryObject),
          findByIdAndDelete: jest.fn().mockReturnValue(mockQueryObject),
          findOneAndDelete: jest.fn().mockReturnValue(mockQueryObject),
          insertMany: jest.fn().mockResolvedValue([]),
        };

        const actual = jest.requireActual(modelPath);

        return new Proxy(mockModel, {
          get(target, prop) {
            if (prop in target) return target[prop];
            if (prop in actual) {
              const val = actual[prop];
              // If the exported property is a Mongoose model, return the mock
              if (val && (val.modelName || val.schema)) {
                return new Proxy(mockModel, {
                  get(innerTarget, innerProp) {
                    if (innerProp in innerTarget) return innerTarget[innerProp];
                    if (innerProp === '__esModule') return false;
                    if (typeof innerProp === 'symbol') return undefined;
                    return jest.fn().mockReturnValue(mockQueryObject);
                  },
                });
              }
              return val;
            }
            if (prop === '__esModule') return false;
            if (typeof prop === 'symbol') return undefined;
            console.log(
              `[jest.setup.js] accessed unmocked model property: ${String(prop)}`,
            );
            return jest.fn().mockReturnValue(mockQueryObject);
          },
        });
      },
      { virtuals: true },
    );
  });
}
