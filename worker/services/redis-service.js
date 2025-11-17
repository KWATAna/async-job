const Redis = require("ioredis");

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_REDIS_URL =
  process.env.REDIS_URL || "redis://localhost:6379";

class RedisService {
  constructor(redisUrl = DEFAULT_REDIS_URL, ttlSeconds = DEFAULT_TTL_SECONDS) {
    this.client = new Redis(redisUrl);
    this.ttlSeconds = ttlSeconds;

    this.client.on("error", (error) => {
      console.error("Redis error in worker:", error);
    });

    this.client.on("connect", () => {
      console.info("Worker connected to Redis");
    });
  }

  jobKey(jobId) {
    return `job:${jobId}`;
  }

  attemptsKey(jobId) {
    return `${this.jobKey(jobId)}:attempts`;
  }

  async setTTL(jobId) {
    const key = this.jobKey(jobId);
    await this.client.expire(key, this.ttlSeconds);
    await this.client.expire(this.attemptsKey(jobId), this.ttlSeconds);
  }

  async ensureJobExists(jobId, baseData = {}) {
    if (!jobId) return;

    await this.client.hset(this.jobKey(jobId), {
      jobId,
      ...baseData,
      updatedAt: new Date().toISOString(),
    });

    await this.setTTL(jobId);
  }

  async logAttempt(jobId, attemptData) {
    if (!jobId) return;

    await this.client.rpush(
      this.attemptsKey(jobId),
      JSON.stringify(attemptData)
    );
    await this.client.hincrby(this.jobKey(jobId), "attempts", 1);
    await this.setTTL(jobId);
  }

  async updateJobStatus(jobId, status, extra = {}) {
    if (!jobId) return;

    await this.client.hset(this.jobKey(jobId), {
      status,
      ...extra,
      updatedAt: new Date().toISOString(),
    });
    await this.setTTL(jobId);
  }
}

module.exports = new RedisService();
