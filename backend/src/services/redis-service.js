const Redis = require("ioredis");

class RedisService {
  constructor() {
    this.client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    this.client.on("error", (error) => {
      console.error("Redis error:", error);
    });

    this.client.on("connect", () => {
      console.info("Connected to Redis");
    });
  }

  jobKey(jobId) {
    return `job:${jobId}`;
  }

  attemptsKey(jobId) {
    return `${this.jobKey(jobId)}:attempts`;
  }

  async storeJob(jobId, jobData) {
    const key = this.jobKey(jobId);
    await this.client.hset(key, {
      ...jobData,
      attempts: jobData.attempts || 0,
      updatedAt: new Date().toISOString(),
    });

    await this.client.expire(key, 24 * 60 * 60);
    await this.client.expire(this.attemptsKey(jobId), 24 * 60 * 60);
  }

  async addAttempt(jobId, attemptData) {
    const attemptsKey = this.attemptsKey(jobId);
    await this.client.rpush(attemptsKey, JSON.stringify(attemptData));
    await this.client.hincrby(this.jobKey(jobId), "attempts", 1);
  }

  async updateJobStatus(jobId, status, error = null, response = null) {
    const key = this.jobKey(jobId);
    const updateData = {
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

  async getJob(jobId) {
    const key = this.jobKey(jobId);
    const job = await this.client.hgetall(key);
    if (!Object.keys(job).length) {
      return null;
    }

    const attemptsRaw = await this.client.lrange(
      this.attemptsKey(jobId),
      0,
      -1
    );
    const attempts = attemptsRaw.map((a) => {
      try {
        return JSON.parse(a);
      } catch (e) {
        return a;
      }
    });

    ["lastResponse", "headers", "payload"].forEach((field) => {
      if (job[field]) {
        try {
          job[field] = JSON.parse(job[field]);
        } catch (e) {
          // keep as string if parsing fails
        }
      }
    });

    return {
      ...job,
      attemptsLog: attempts,
    };
  }
}

module.exports = new RedisService();
