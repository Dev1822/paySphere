import type { NextFunction, Request, Response } from 'express';

type TenantRequest = Request & {
  userId?: string;
  tenantId?: string;
  file?: {
    buffer: Buffer;
    originalname?: string;
    mimetype?: string;
    size?: number;
  };
};

type Controller = (
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

type EmployeeController = {
  addEmployee: Controller;
  getEmployees: Controller;
  getRecentEmployees: Controller;
  getOrgChart: Controller;
  updateEmployeeManager: Controller;
  importEmployees: Controller;
  [key: string]: Controller;
};

/**
 * Typed adapter for the employee controller.
 *
 * The repository currently contains the implementation as
 * `employee.controller.js`. This boundary gives the Express API exact
 * request/middleware types while keeping the existing implementation
 * behavior unchanged during the incremental migration.
 *
 * Once the JavaScript controller is removed, the typed exports below can be
 * moved directly into this file without changing route signatures.
 */
const legacyController =
  require('./employee.controller.js') as EmployeeController;

function requireAuthenticatedUser(req: TenantRequest): void {
  if (!req.userId) {
    const error = new Error('Authentication required') as Error & {
      statusCode?: number;
    };
    error.statusCode = 401;
    throw error;
  }
}

function withAuthentication(controller: Controller): Controller {
  return async (req, res, next) => {
    try {
      requireAuthenticatedUser(req);
      return await controller(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
}

export const addEmployee: Controller = withAuthentication(
  legacyController.addEmployee,
);

export const getEmployees: Controller = withAuthentication(
  legacyController.getEmployees,
);

export const getRecentEmployees: Controller = withAuthentication(
  legacyController.getRecentEmployees,
);

export const getOrgChart: Controller = withAuthentication(
  legacyController.getOrgChart,
);

export const updateEmployeeManager: Controller = withAuthentication(
  legacyController.updateEmployeeManager,
);

export const importEmployees: Controller = withAuthentication(
  legacyController.importEmployees,
);

/**
 * Preserve any additional handlers that exist in the legacy controller.
 * This prevents an incremental migration from silently dropping routes.
 */
const exportedHandlers = Object.keys(legacyController);

for (const handlerName of exportedHandlers) {
  if (handlerName in exports) continue;

  const handler = legacyController[handlerName];

  if (typeof handler === 'function') {
    Object.defineProperty(exports, handlerName, {
      enumerable: true,
      value: withAuthentication(handler),
    });
  }
}

export default {
  addEmployee,
  getEmployees,
  getRecentEmployees,
  getOrgChart,
  updateEmployeeManager,
  importEmployees,
};
