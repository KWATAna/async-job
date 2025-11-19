import Redis from "ioredis";

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

class RedisService {
  public client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    this.client.on("error", (error: Error) => {
      console.error("Redis error:", error);
    });

    this.client.on("connect", () => {
      console.info("Connected to Redis");
    });
  }

  private jobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  private attemptsKey(jobId: string): string {
    return `${this.jobKey(jobId)}:attempts`;
  }

  async storeJob(jobId: string, jobData: JobData): Promise<void> {
    const key = this.jobKey(jobId);

    const dataToStore: Record<string, any> = {
      ...jobData,
      attempts: (jobData.attempts || 0).toString(),
      updatedAt: new Date().toISOString(),
    };

    // Stringify object fields for Redis storage
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

  async addAttempt(jobId: string, attemptData: AttemptData): Promise<void> {
    const attemptsKey = this.attemptsKey(jobId);
    await this.client.rpush(attemptsKey, JSON.stringify(attemptData));
    await this.client.hincrby(this.jobKey(jobId), "attempts", 1);
  }

  async updateJobStatus(
    jobId: string,
    status: string,
    error: string | null = null,
    response: any = null
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

    await this.client.hset(key, updateData);
  }

  async getJob(jobId: string): Promise<StoredJob | null> {
    const key = this.jobKey(jobId);
    const job = await this.client.hgetall(key);

    if (!job || Object.keys(job).length === 0) {
      return null;
    }

    const attemptsRaw = await this.client.lrange(
      this.attemptsKey(jobId),
      0,
      -1
    );

    const attempts: AttemptData[] = attemptsRaw.map((a: string) => {
      try {
        return JSON.parse(a) as AttemptData;
      } catch (e) {
        return { timestamp: new Date().toISOString(), error: a } as AttemptData;
      }
    });

    // Parse JSON fields back to objects
    const parsedJob: any = { ...job };

    ["lastResponse", "headers", "payload"].forEach((field: string) => {
      if (parsedJob[field]) {
        try {
          parsedJob[field] = JSON.parse(parsedJob[field]);
        } catch (e) {
          // keep as string if parsing fails
        }
      }
    });

    // Convert string numbers back to numbers
    if (parsedJob.attempts) {
      parsedJob.attempts = parseInt(parsedJob.attempts, 10);
    }
    if (parsedJob.maxRetries) {
      parsedJob.maxRetries = parseInt(parsedJob.maxRetries, 10);
    }
    if (parsedJob.retryDelay) {
      parsedJob.retryDelay = parseInt(parsedJob.retryDelay, 10);
    }

    return {
      ...parsedJob,
      attemptsLog: attempts,
    } as StoredJob;
  }

  // Optional: Add method to check if Redis is ready
  isReady(): boolean {
    return this.client.status === "ready";
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export default new RedisService();
