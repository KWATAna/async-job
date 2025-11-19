const JobRequest = require("../models/job-request");
const jobService = require("../services/job-service");

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

      const job = await jobService.createJob(value);

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
      const job = await jobService.getJob(jobId);

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
