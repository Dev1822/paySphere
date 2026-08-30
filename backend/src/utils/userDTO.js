const BaseDTO = require('./baseDTO');

class UserDTO extends BaseDTO {
  static toClient(user) {
    if (!user) return null;
    const obj = this.removeInternalFields(user);

    // Remove sensitive fields
    delete obj.password;
    delete obj.passwordHistory;
    delete obj.mfaSecret;
    delete obj.lockUntil;
    delete obj.failedLoginAttempts;
    delete obj.tokenVersion;

    return obj;
  }
}

module.exports = UserDTO;
