const amqp = require("amqplib");
const axios = require("axios");
const RetryStrategy = require("./strategies/retry-strategy");
const redisService = require("./services/redis-service");

// Connect to RabbitMQ Docker container
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost";
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_MAX_RETRIES = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendCallback(jobId, callbackUrl, payload, finalStatus) {
  try {
    const response = await axios.post(callbackUrl, payload);
    await redisService.updateJobStatus(jobId, finalStatus, {
      callbackStatus: "sent",
      callbackStatusCode: response.status,
      callbackError: null,
    });
    console.log(`Sent callback to ${callbackUrl}`);
  } catch (error) {
    await redisService.updateJobStatus(jobId, finalStatus, {
      callbackStatus: "failed",
      callbackError: error.message,
      callbackStatusCode: error.response ? error.response.status : null,
    });
    console.error(`Failed to send callback to ${callbackUrl}:`, error.message);
  }
}

async function processRequest(message) {
  const {
    id: jobId,
    targetUrl,
    method = "GET",
    headers = {},
    payload,
    callbackUrl,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
  } = message;

  let attempts = 0;
  let statusCode = null;
  let success = false;
  let responseData;
  let errorMessage = null;

  await redisService.ensureJobExists(jobId, {
    status: "in_progress",
    attempts: 0,
  });

  while (attempts < maxRetries) {
    attempts += 1;
    const attemptAt = new Date().toISOString();

    try {
      const response = await axios({
        url: targetUrl,
        method,
        headers,
        data: payload,
        validateStatus: () => true,
      });

      statusCode = response.status;
      responseData = response.data;

      if (RetryStrategy.shouldRetry(statusCode)) {
        errorMessage = `Retryable status ${statusCode} received`;

        if (attempts < maxRetries) {
          const delay = RetryStrategy.getDelay(attempts, retryDelay);
          await redisService.logAttempt(jobId, {
            attempt: attempts,
            statusCode,
            success: false,
            error: errorMessage,
            timestamp: attemptAt,
          });
          console.warn(
            `Attempt ${attempts}/${maxRetries} failed with status ${statusCode}. Retrying in ${delay}ms`
          );
          await wait(delay);
          continue;
        }
      }

      success = statusCode >= 200 && statusCode < 300;
      if (!success) {
        errorMessage = `Request completed with non-success status ${statusCode}`;
      }

      await redisService.logAttempt(jobId, {
        attempt: attempts,
        statusCode,
        success,
        error: success ? undefined : errorMessage,
        response: success ? responseData : undefined,
        timestamp: attemptAt,
      });
      break;
    } catch (error) {
      statusCode = error.response ? error.response.status : null;
      errorMessage = error.message;

      if (
        statusCode &&
        RetryStrategy.shouldRetry(statusCode) &&
        attempts < maxRetries
      ) {
        const delay = RetryStrategy.getDelay(attempts, retryDelay);
        await redisService.logAttempt(jobId, {
          attempt: attempts,
          statusCode,
          success: false,
          error: errorMessage,
          timestamp: attemptAt,
        });
        console.warn(
          `Attempt ${attempts}/${maxRetries} failed with status ${statusCode}. Retrying in ${delay}ms`
        );
        await wait(delay);
        continue;
      }

      if (!statusCode && attempts < maxRetries) {
        const delay = RetryStrategy.getDelay(attempts, retryDelay);
        await redisService.logAttempt(jobId, {
          attempt: attempts,
          success: false,
          error: errorMessage,
          timestamp: attemptAt,
        });
        console.warn(
          `Attempt ${attempts}/${maxRetries} failed (${error.message}). Retrying in ${delay}ms`
        );
        await wait(delay);
        continue;
      }

      break;
    }
  }

  const callbackPayload = {
    jobId,
    targetUrl,
    method,
    attempts,
    maxRetries,
    success,
    statusCode,
    response: success ? responseData : undefined,
    error: success ? undefined : errorMessage,
    completedAt: new Date().toISOString(),
  };

  const finalStatus = success ? "completed" : "failed";

  await redisService.updateJobStatus(jobId, finalStatus, {
    error: success ? undefined : errorMessage,
    lastResponse: success ? JSON.stringify(responseData) : undefined,
  });

  console.log("Callback response:", callbackPayload);
  await sendCallback(jobId, callbackUrl, callbackPayload, finalStatus);
}

async function initWorker() {
  try {
    console.log("Connecting to RabbitMQ");
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    const queue = "request-queue";
    await channel.assertQueue(queue, { durable: false });

    console.log("Connected to RabbitMQ");
    console.log("Listening for messages in queue: " + queue);

    channel.prefetch(1);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const message = JSON.parse(msg.content.toString());

          await processRequest(message);

          channel.ack(msg);
        } catch (error) {
          console.error("Error processing message:", error);
          channel.nack(msg, false, false);
        }
      }
    });

    // Handle connection errors
    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed");
      console.log("Attempting to reconnect...");
      setTimeout(() => initWorker(), 5000);
    });
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error.message);
    console.error("Make sure RabbitMQ is runninhg");
    console.error("Retrying in 5 seconds");

    setTimeout(() => {
      initWorker();
    }, 5000);
  }
}

console.log("Request processing worker started");
initWorker();
