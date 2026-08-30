const customFieldService = require('../services/customField.service');

exports.getDefinitions = async (req, res, next) => {
  try {
    const { entityType } = req.query;
    if (!entityType) {
      return res
        .status(400)
        .json({ message: 'entityType query parameter is required' });
    }
    const definitions = await customFieldService.getDefinitions(
      req.tenantId,
      entityType,
    );
    res.status(200).json(definitions);
  } catch (error) {
    next(error);
  }
};

exports.createDefinition = async (req, res, next) => {
  try {
    const definition = await customFieldService.createDefinition(
      req.tenantId,
      req.body,
    );
    res.status(201).json(definition);
  } catch (error) {
    if (error.message.includes('Maximum of 50')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res
        .status(409)
        .json({
          message:
            'A custom field with this key already exists for this entity type.',
        });
    }
    next(error);
  }
};

exports.updateDefinition = async (req, res, next) => {
  try {
    const definition = await customFieldService.updateDefinition(
      req.tenantId,
      req.params.id,
      req.body,
    );
    res.status(200).json(definition);
  } catch (error) {
    if (error.message === 'Custom field definition not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('Cannot change fieldType')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteDefinition = async (req, res, next) => {
  try {
    await customFieldService.deleteDefinition(req.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Custom field definition not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};
