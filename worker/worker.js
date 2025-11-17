const amqp = require("amqplib");
const axios = require("axios");

// Connect to RabbitMQ Docker container
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost";

async function processRequest(message) {
  try {
    try {
      await axios.get(message.targetUrl);
      console.log(`Request sent on behalf of user`);
    } catch (statusError) {
      console.error("Failed to update status:", statusError.message);
    }
  } catch (error) {
    console.error(`Error processing request: `, error.message);
    throw error;
  }
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
