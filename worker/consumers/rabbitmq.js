const amqp = require("amqplib");
const requestProcessor = require("../processors/request-processor");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost";
const QUEUE_NAME = "request-queue";

class RabbitMQConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log("Connecting to RabbitMQ");
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(QUEUE_NAME, { durable: true });
      this.channel.prefetch(1);

      this.isConnected = true;

      this.setupEventHandlers();
      console.log("Connected to RabbitMQ");
      console.log("Listening for messages in queue: " + QUEUE_NAME);

      return true;
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error.message);
      this.isConnected = false;
      throw error;
    }
  }

  setupEventHandlers() {
    this.connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
      this.isConnected = false;
    });

    this.connection.on("close", () => {
      console.log("RabbitMQ connection closed");
      this.isConnected = false;
      this.handleReconnection();
    });
  }

  async startConsuming() {
    if (!this.isConnected) {
      throw new Error("Not connected to RabbitMQ");
    }

    this.channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        await this.handleMessage(msg);
      }
    });
  }

  async handleMessage(msg) {
    try {
      const message = JSON.parse(msg.content.toString());
      await requestProcessor.process(message);
      this.channel.ack(msg);
    } catch (error) {
      console.error("Error processing message:", error);
      this.channel.nack(msg, false, false);
    }
  }

  handleReconnection() {
    console.log("Attempting to reconnect in 5 seconds...");
    setTimeout(() => this.reconnect(), 5000);
  }

  async reconnect() {
    try {
      await this.connect();
      await this.startConsuming();
    } catch (error) {
      this.handleReconnection();
    }
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}

module.exports = new RabbitMQConsumer();
