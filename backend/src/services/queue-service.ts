import amqp, { Channel, ChannelModel } from "amqplib";

export interface JobMessage {
  id: string;
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  payload?: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;
}

export interface QueueServiceOptions {
  amqpClient?: any;
  queueName?: string;
}

export interface Job {
  id: string;
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  payload?: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;
}

class QueueService {
  private amqpClient: any;
  private queueName: string;
  private connection: ChannelModel | null = null;
  public channel: Channel | null = null;

  constructor({
    amqpClient = amqp,
  queueName = "request-queue",
  }: QueueServiceOptions = {}) {
    this.amqpClient = amqpClient;
    this.queueName = queueName;
  }

  async connect(
    rabbitmqUrl: string = process.env.RABBITMQ_URL || "amqp://localhost:5672"
  ): Promise<void> {
    try {
      this.connection = await this.amqpClient.connect(rabbitmqUrl);

      if (!this.connection) {
        throw new Error("Failed to establish connection");
      }

      this.channel = await this.connection.createChannel();

      // Add null check for channel
      if (!this.channel) {
        throw new Error("Failed to create channel");
      }

      await this.channel.assertQueue(this.queueName, {
        durable: false,
      });

      console.info("Connected to RabbitMQ");
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  async publishJob(job: Job): Promise<boolean> {
    if (!this.channel) {
      throw new Error("Queue channel not initialized");
    }

    const message: JobMessage = {
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

  async close(): Promise<void> {
    // Close channel if it exists
    if (this.channel) {
      try {
        await this.channel.close();
        this.channel = null;
      } catch (error) {
        console.error("Error closing channel:", error);
      }
    }

    // Close connection if it exists
    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = null;
      } catch (error) {
        console.error("Error closing connection:", error);
      }
    }
  }

  // Optional: Add method to check connection status
  isConnected(): boolean {
    return !!(this.connection && this.channel);
  }
}

// Create default instance
const defaultQueueService = new QueueService();

// Export both the class and default instance
export { QueueService };
export default defaultQueueService;

// Export factory function
export const createQueueService = (
  options?: QueueServiceOptions
): QueueService => new QueueService(options);
