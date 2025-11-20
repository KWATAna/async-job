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

  async hset(key: string, value: unknown) {
    await this.client.hset(key, JSON.stringify(value));
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (ttlSeconds <= 0) {
      return false;
    }
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }
}
