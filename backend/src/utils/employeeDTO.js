const BaseDTO = require('./baseDTO');

class EmployeeDTO extends BaseDTO {
  static toClient(employee) {
    if (!employee) return null;
    const obj = this.removeInternalFields(employee);
    // Add any specific employee field removals here if needed in the future
    return obj;
  }
}

module.exports = EmployeeDTO;
