import { Injectable } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { Job } from './entities/job.entity';
import { RedisService } from '../redis/redis.service';
import { JobPublisher } from './job.publisher';
import { v4 as uuidv4 } from 'uuid';

export interface IJobRequest {
  id: string;
  targetUrl: string;
  method: string;
  headers: string;
  status: 'queued' | 'failed' | 'completed';
  payload: any;
  attempts: number;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;
}

@Injectable()
export class JobService {
  constructor(
    private readonly redisService: RedisService,
    private readonly jobPublisher: JobPublisher,
  ) {}

  private jobKey(id: string) {
    return `job:${id}`;
  }

  private attemptsKey(jobId: string): string {
    return `${this.jobKey(jobId)}:attempts`;
  }

  async createJob(dto: CreateJobDto): Promise<Job> {
    const now = new Date();

    const job: Job = {
      id: uuidv4(),
      ...dto,
      method: dto.method || 'GET',
      status: 'queued',
      attempts: 0,
      headers: JSON.stringify(dto.headers),
      payload: dto.payload ? JSON.stringify(dto.payload) : '',
      callbackUrl: dto.callbackUrl,
      maxRetries: dto.maxRetries || 3,
      retryDelay: dto.retryDelay || 0,
      createdAt: now.toISOString(),
    };
    // persist
    await this.persistInitialJob(job);

    // publish
    const published: boolean = this.jobPublisher.publishJobCreated(job);

    // update in case it failed to publish to queuesx
    if (!published) {
      await this.updateJobStatus(
        job.id,
        'failed',
        'Failed to publish job to queue',
      );

      throw new Error('Failed to publish job to queue');
    } else {
      console.log('Job published to queue:', job.id);
    }

    return job;
  }

  async getJob(id: string): Promise<Job | null> {
    const job = await this.redisService.get<Job>(this.jobKey(id));
    return job;
  }

  async persistInitialJob(job: Job) {
    await this.storeJob(job.id, {
      id: job.id,
      status: 'queued',
      attempts: 0,
      targetUrl: job.targetUrl,
      method: job.method,
      headers: JSON.stringify(job.headers),
      payload: job.payload ? JSON.stringify(job.payload) : '',
      callbackUrl: job.callbackUrl,
      maxRetries: job.maxRetries,
      retryDelay: job.retryDelay,
      createdAt: job.createdAt,
    });
  }

  async storeJob(jobId: string, jobData: Job): Promise<void> {
    const key = this.jobKey(jobId);

    const dataToStore: Record<string, any> = {
      ...jobData,
      attempts: (jobData.attempts || 0).toString(),
      updatedAt: new Date().toISOString(),
    };

    if (jobData.headers) {
      dataToStore.headers = JSON.stringify(jobData.headers);
    }
    if (jobData.payload) {
      dataToStore.payload = JSON.stringify(jobData.payload);
    }
    if (jobData.lastResponse) {
      dataToStore.lastResponse = JSON.stringify(jobData.lastResponse);
    }

    await this.redisService.hset(key, dataToStore);
    await this.redisService.expire(key, 24 * 60 * 60);
    await this.redisService.expire(this.attemptsKey(jobId), 24 * 60 * 60);
  }

  async updateJobStatus(
    jobId: string,
    status: string,
    error: string | null = null,
    response: any = null,
  ): Promise<void> {
    const key = this.jobKey(jobId);
    const updateData: Record<string, string> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (error) {
      updateData.error = error;
    }

    if (response !== null && response !== undefined) {
      updateData.lastResponse = JSON.stringify(response);
    }

    await this.redisService.hset(key, updateData);
  }
}
