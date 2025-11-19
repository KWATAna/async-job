const amqp = require("amqplib");

class QueueService {
  constructor({ amqpClient = amqp, queueName = "request-queue" } = {}) {
    this.amqpClient = amqpClient;
    this.queueName = queueName;
    this.connection = null;
    this.channel = null;
  }

  async connect(rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672") {
    try {
      this.connection = await this.amqpClient.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(this.queueName, {
        durable: false,
      });

      console.info("Connected to RabbitMQ");
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  async publishJob(job) {
    if (!this.channel) {
      throw new Error("Queue channel not initialized");
    }

    const message = {
      id: job.id,
      targetUrl: job.targetUrl,
      method: job.method,
      headers: job.headers,
      payload: job.payload,
      callbackUrl: job.callbackUrl,
      maxRetries: job.maxRetries,
      retryDelay: job.retryDelay,
      createdAt: job.createdAt,
    };

    const success = this.channel.sendToQueue(
      this.queueName,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    if (success) {
      console.info(`Job ${job.id} published to queue`);
      return true;
    } else {
      console.error(`Failed to publish job ${job.id} to queue`);
      return false;
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

const defaultQueueService = new QueueService();

module.exports = defaultQueueService;
module.exports.QueueService = QueueService;
module.exports.createQueueService = (options) => new QueueService(options);
