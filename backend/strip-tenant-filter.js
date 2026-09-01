module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let dirty = false;

  // 1. Remove require statements for tenantFilter, sameTenant, requireTenant
  root.find(j.VariableDeclarator).forEach((path) => {
    if (
      path.node.init &&
      path.node.init.type === 'CallExpression' &&
      path.node.init.callee.name === 'require' &&
      path.node.init.arguments.length > 0 &&
      typeof path.node.init.arguments[0].value === 'string' &&
      path.node.init.arguments[0].value.includes('tenantScope')
    ) {
      if (path.node.id.type === 'ObjectPattern') {
        const initialLen = path.node.id.properties.length;
        const properties = path.node.id.properties.filter(
          (prop) =>
            prop.key.name !== 'tenantFilter' && 
            prop.key.name !== 'sameTenant' && 
            prop.key.name !== 'requireTenant'
        );
        
        if (properties.length === 0) {
          // Remove the entire require statement
          j(path.parent).remove();
          dirty = true;
        } else if (properties.length !== initialLen) {
          path.node.id.properties = properties;
          dirty = true;
        }
      }
    }
  });

  // 2. Replace tenantFilter(req, <expr>) with <expr> and tenantFilter(req) with {}
  root.find(j.CallExpression, { callee: { name: 'tenantFilter' } }).forEach((path) => {
    dirty = true;
    if (path.node.arguments.length > 1) {
      j(path).replaceWith(path.node.arguments[1]);
    } else {
      j(path).replaceWith(j.objectExpression([]));
    }
  });

  // 3. Remove `{ tenantId: req.tenantId }`
  root.find(j.Property, { key: { name: 'tenantId' } }).forEach((path) => {
    if (
      path.node.value.type === 'MemberExpression' &&
      path.node.value.object.name === 'req' &&
      path.node.value.property.name === 'tenantId'
    ) {
      j(path).remove();
      dirty = true;
    }
  });

  return dirty ? root.toSource({ quote: 'single' }) : null;
};
