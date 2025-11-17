const express = require("express");
const cors = require("cors");

const jobsRouter = require("./src/routes/jobs");
const queueService = require("./src/services/queue-service");
const redisService = require("./src/services/redis-service");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(jobsRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rabbitmq: queueService.channel ? "connected" : "disconnected",
    redis: redisService.client?.status === "ready" ? "connected" : "disconnected",
  });
});

// Start server
const startServer = async () => {
  try {
    await queueService.connect();

    app.listen(PORT, () => {
      console.log("Server is running on http://localhost:" + PORT);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
