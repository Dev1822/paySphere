const lifecycleEventService = require('../services/lifecycleEvent.service');

exports.getEmployeeTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    const filters = {};
    if (req.query.category) {
      filters.category = req.query.category;
    }

    // For non-HR/Admin roles (like employee self-service), we might want to restrict to isVisible: true
    if (req.query.isVisible !== undefined) {
      filters.isVisible = req.query.isVisible === 'true';
    }

    const timeline = await lifecycleEventService.getTimeline(
      id,
      req.tenantId,
      filters,
      page,
      limit,
    );

    res.status(200).json(timeline);
  } catch (error) {
    next(error);
  }
};

exports.backfillTimeline = async (req, res, next) => {
  try {
    const result = await lifecycleEventService.backfillFromExisting(
      req.tenantId,
    );
    res
      .status(200)
      .json({ message: 'Backfill completed', processed: result.processed });
  } catch (error) {
    next(error);
  }
};
