const rabbitMQConsumer = require("./consumers/rabbitmq");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startApplication() {
  try {
    await rabbitMQConsumer.connect();
    await rabbitMQConsumer.startConsuming();
    console.log("Request processing worker started successfully");
  } catch (error) {
    console.error("Failed to start application:", error.message);
    console.log("Retrying in 5 seconds...");
    setTimeout(startApplication, 5000);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Shutting down gracefully...");
  await rabbitMQConsumer.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. Shutting down gracefully...");
  await rabbitMQConsumer.close();
  process.exit(0);
});

startApplication();