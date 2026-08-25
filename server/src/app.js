const cors = require("cors");
const express = require("express");
const { ZodError } = require("zod");
const { authRouter } = require("./routes/authRoutes");
const { aiGameRouter } = require("./routes/aiGameRoutes");
const { gameRouter } = require("./routes/gameRoutes");
const { coachRouter } = require("./routes/coachRoutes");
const { coachBookingRouter } = require("./routes/coachBookingRoutes");
const { coachApplicationRouter } = require("./routes/coachApplicationRoutes");
const { coachDashboardRouter } = require("./routes/coachDashboardRoutes");
const { meRouter } = require("./routes/meRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "FutureChess server is running" });
});

app.use("/auth", authRouter);
app.use("/games", gameRouter);
app.use("/ai-games", aiGameRouter);
app.use("/coaches", coachRouter);
app.use("/coach-bookings", coachBookingRouter);
app.use("/coach-applications", coachApplicationRouter);
app.use("/coach", coachDashboardRouter);
app.use("/me", meRouter);

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation error",
        issues: err.issues,
      },
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";
  const code = err.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
});

module.exports = { app };
