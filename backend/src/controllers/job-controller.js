const JobRequest = require("../models/job-request");
const queueService = require("../services/queue-service");
const redisService = require("../services/redis-service");

class JobController {
  async createJob(req, res) {
    try {
      const { error, value } = JobRequest.validationSchema().validate(req.body);
      if (error) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.details,
        });
      }

      const job = new JobRequest(value);

      if (!queueService.channel) {
        await queueService.connect();
      }

      await redisService.storeJob(job.id, {
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

      const published = await queueService.publishJob(job);

      if (!published) {
        await redisService.updateJobStatus(
          job.id,
          "failed",
          "Failed to publish job to queue"
        );

        return res.status(500).json({
          error: "Failed to queue job",
        });
      }

      res.status(202).json({
        jobId: job.id,
        status: "queued",
        message: "Job accepted for processing",
      });
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }

  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const job = await redisService.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          error: "Job not found",
        });
      }

      res.json(job);
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}

module.exports = new JobController();
