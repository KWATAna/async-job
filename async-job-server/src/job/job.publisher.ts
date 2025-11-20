import { Injectable } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { Job } from './entities/job.entity';

interface JobMessage {
  id: string;
  targetUrl: string;
  method: string;
  headers: string;
  payload?: unknown; // forces type checking, any disables type checking
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: string;
}

@Injectable()
export class JobPublisher {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  publishJobCreated(job: Job): boolean {
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

    return this.rabbitmqService.publishToJobsQueue(message);
  }
}
