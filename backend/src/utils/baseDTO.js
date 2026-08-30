class BaseDTO {
  static removeInternalFields(doc) {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    delete obj.__v;
    delete obj.tenantId;
    delete obj.createdAt;
    delete obj.updatedAt;
    return obj;
  }
}

module.exports = BaseDTO;
