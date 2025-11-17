const express = require("express");
const amqp = require("amqplib");
const Redis = require("ioredis");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

// Connect to RabbitMQ & Redis container
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Middleware
app.use(cors());
app.use(express.json());

// init rabbitmq & redis
let channel = null;
let redisService = null;

async function initRabbitMQ() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    const queue = "request-queue";
    await channel.assertQueue(queue, { durable: false });
    console.log("Connected to RabbitMQ");

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
    });

    connection.on("close", () => {
      console.log(" RabbitMQ connection closed");
    });

    return channel;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error.message);
    return null;
  }
}

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
    const body = req.body;

    // Send message to RabbitMQ queue
    if (channel) {
      const message = {
        targetUrl: body.targetUrl,
        method: body.method,
        headers: body.headers,
        payload: body.payload,
        callbackUrl: body.callbackUrl,
        maxRetries: body.maxRetries,
        retryDelay: body.retryDelay,
        createdAt: body.createdAt,
      };

      channel.sendToQueue(
        "request-queue",
        Buffer.from(JSON.stringify(message))
      );
    } else {
      console.warn("RabbitMQ not connected");
    }

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
    await initRabbitMQ();
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
