import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;

  private readonly queueName = 'request-queue';

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.queueName, {
      durable: true,
    });
    console.info('Connected to RabbitMQ');
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  //  TODO publish message to the jobs queue, extend it later to handle non default exchanges
  publishToJobsQueue(message: unknown): boolean {
    // await channel.confirmSelect();
    const buffer = Buffer.from(JSON.stringify(message));
    const success = this.channel.sendToQueue(this.queueName, buffer, {
      persistent: true,
    });

    if (success) {
      return true;
    } else {
      return false;
    }

    /*
        await new Promise((resolve, reject) => {
            channel.waitForConfirms((err) => (err ? reject(err) : resolve()));
            });
    */
  }
}
