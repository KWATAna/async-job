const express = require("express");
const Redis = require("ioredis");
const cors = require("cors");
const JobRequest = require("./src/models/job-request");
const queueService = require("./src/services/queue-service");

const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Middleware
app.use(cors());
app.use(express.json());

// init rabbitmq & redis
let channel = null;
let redisService = null;

async function initRedis() {
  try {
    const client = new Redis(REDIS_URL);
    redisService = client;

    client.on("error", (error) => {
      console.error("Redis error:", error);
    });

    client.on("connect", () => {
      console.info("Connected to Redis");
    });

    return client;
  } catch (error) {
    console.error("Failed to connect to Redis:", error.message);
    return null;
  }
}

// Routes
app.post("/api/jobs", async (req, res) => {
  try {
    const { error, value } = JobRequest.validationSchema().validate(req.body);

    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details,
      });
    }

    // Send message to RabbitMQ queue
    const job = new JobRequest(value);
    const published = await queueService.publishJob(job);

    res.json({
      jobId: uuidv4(),
      status: "queued",
      message: "Job accepted for processing",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rabbitmq: channel ? "connected" : "disconnected",
    redis: redisService.status === "ready" ? "connected" : "disconnected",
  });
});

// Start server
const startServer = async () => {
  try {
    await queueService.connect();
    // await initRabbitMQ();
    await initRedis();

    app.listen(PORT, () => {
      console.log("Server is running on http://localhost:" + PORT);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
