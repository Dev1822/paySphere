const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const morgan = require("morgan");
const userRoutes = require("./routes/user.routes");
const employeeRoutes = require("./routes/employee.routes");
const payrollRoutes = require("./routes/payroll.routes");
const reportsRoutes = require("./routes/reports.routes");
const logger = require("./utils/logger");

const app = express();
app.use(cookieParser());

const errorHandler = require("./middlewares/error.middleware");

// Security headers
app.use(helmet({ crossOriginOpenerPolicy: false }));

// Rate limiting trust proxy configuration
app.set("trust proxy", 1);

// HTTP request logging via morgan + winston
app.use(morgan("combined", { stream: logger.stream }));

// CORS configuration — restrict to frontend origin
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors(corsOptions));

const { generalRateLimiter } = require("./middlewares/rateLimiter.middleware");
const requireBody = require("./middlewares/requireBody.middleware");

// Require request body for state-changing methods
app.use("/api", requireBody);

// Routes
app.get("/", (req, res) => res.send("PaySphere API is running..."));
app.use("/api", generalRateLimiter);
app.use("/api/auth", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/reports", reportsRoutes);

// CORS error handler — return 403 for blocked origins
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS not allowed" });
  }
  next(err);
});

// Multer error handler — return 400 for file upload issues
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ message: "File upload error" });
  }
  next(err);
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
