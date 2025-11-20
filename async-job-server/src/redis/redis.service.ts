import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

export interface JobData {
  id: string;
  targetUrl: string;
  method: string;
  headers: string;
  payload?: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  status?: string;
  attempts?: number;
  error?: string;
  lastResponse?: any;
  updatedAt?: string;
  createdAt?: string;
}

export interface AttemptData {
  timestamp: string;
  statusCode?: number;
  response?: any;
  error?: string;
  duration?: number;
}

export interface StoredJob extends JobData {
  attempts: number;
  updatedAt: string;
  attemptsLog?: AttemptData[];
}

@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  onModuleInit() {
    this.client.on('error', (error: Error) => {
      console.error('Redis error:', error);
    });

    this.client.on('connect', () => {
      console.info('Connected to Redis');
    });
  }

  private jobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  private attemptsKey(jobId: string): string {
    return `${this.jobKey(jobId)}:attempts`;
  }

  async set(key: string, value: unknown) {
    await this.client.set(key, JSON.stringify(value));
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async storeJob(jobId: string, jobData: JobData): Promise<void> {
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

    await this.client.hset(key, dataToStore);
    await this.client.expire(key, 24 * 60 * 60);
    await this.client.expire(this.attemptsKey(jobId), 24 * 60 * 60);
  }
}
