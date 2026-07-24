const express = require("express");
const { signup, login, getSettings, updateSettings, updatePassword, googleAuth, forgotPassword, resetPassword, disconnectGoogle, deleteAccount } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const { authRateLimiter, writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const router = express.Router();

router.post("/signup", authRateLimiter, signup);
router.post("/login", authRateLimiter, login);
router.post("/google", authRateLimiter, googleAuth);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password/:token", authRateLimiter, resetPassword);
router.post("/refresh", authRateLimiter, require("../controllers/user.controller").refresh);
router.post("/logout", authRateLimiter, require("../controllers/user.controller").logout);

// Settings
router.get("/settings", auth, getSettings);
router.patch("/settings", auth, writeRateLimiter, updateSettings);
router.patch("/security/password", auth, writeRateLimiter, updatePassword);
router.patch("/security/disconnect-google", auth, writeRateLimiter, disconnectGoogle);
router.delete("/security/account", auth, writeRateLimiter, deleteAccount);

module.exports = router;
