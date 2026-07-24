const requireBody = (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    if (req.body === undefined || req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Request body is required" });
    }
  }
  next();
};

module.exports = requireBody;
