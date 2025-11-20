import JobRequest from "../models/job-request";
import queueService from "./queue-service";
import redisService from "./redis-service";

class JobService {
  async createJob(jobPayload: any) {
    const job = new JobRequest(jobPayload);

    await this.ensureQueueConnection();
    await this.persistInitialJob(job);

    const published = await queueService.publishJob(job);

  if (!published) {
    await redisService.updateJobStatus(
      job.id,
      "failed",
      "Failed to publish job to queue"
    );

    throw new Error("Failed to publish job to queue");
  }

    return job;
  }

  async ensureQueueConnection() {
    if (!queueService.channel) {
      await queueService.connect();
    }
  }

  async persistInitialJob(job: JobRequest) {
    await redisService.storeJob(job.id, {
      id: job.id,
      status: "queued",
      attempts: 0,
      targetUrl: job.targetUrl,
      method: job.method,
      headers: JSON.stringify(job.headers),
      payload: job.payload ? JSON.stringify(job.payload) : "",
      callbackUrl: job.callbackUrl,
      maxRetries: job.maxRetries,
      retryDelay: job.retryDelay,
      createdAt: job.createdAt.toISOString(),
    });
  }

  async getJob(jobId: any) {
    return redisService.getJob(jobId);
  }
}

export default new JobService();
